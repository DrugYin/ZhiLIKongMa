const cloud = require('wx-server-sdk');
const { getCurrentUser } = require('/opt/auth');
const { writeOperationLog } = require('/opt/operation-log');
const { createSystemNotification, safeCreateNotification } = require('/opt/notification');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

async function getMembership(classId, openid) {
  const res = await db.collection('class_memberships').where({
    class_id: classId,
    student_openid: openid
  }).limit(1).get();
  return res.data[0] || null;
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const applicationId = String(event.application_id || '').trim();
    const action = String(event.action || '').trim();
    const reviewRemark = String(event.review_remark || '').trim();

    if (!applicationId || !['approve', 'reject'].includes(action)) {
      return {
        success: false,
        message: '审批参数不合法',
        error_code: 400
      };
    }

    const teacher = await getCurrentUser(db, OPENID);
    if (!teacher || !Array.isArray(teacher.roles) || !teacher.roles.includes('teacher')) {
      return {
        success: false,
        message: '仅教师可以处理入班申请',
        error_code: 403
      };
    }

    const applicationRes = await db.collection('class_join_applications').doc(applicationId).get();
    const application = applicationRes.data || null;
    if (!application) {
      return {
        success: false,
        message: '申请记录不存在',
        error_code: 404
      };
    }

    if (application.status !== 'pending') {
      return {
        success: false,
        message: '该申请已处理，请勿重复操作',
        error_code: 409
      };
    }

    const classRes = await db.collection('classes').doc(application.class_id).get();
    const classInfo = classRes.data || null;
    if (!classInfo || classInfo.status !== 'active') {
      return {
        success: false,
        message: '班级不存在或已停用',
        error_code: 404
      };
    }

    if (classInfo.teacher_openid !== OPENID) {
      return {
        success: false,
        message: '无权处理该班级申请',
        error_code: 403
      };
    }

    const studentRes = await db.collection('users').where({
      _openid: application.student_openid
    }).limit(1).get();
    const student = studentRes.data[0];
    if (!student) {
      return {
        success: false,
        message: '申请学生不存在',
        error_code: 404
      };
    }

    const membership = await getMembership(classInfo._id, application.student_openid);
    const hasLegacyMembership = student.class_id === classInfo._id;
    const alreadyJoinedCurrentClass = Boolean(membership || hasLegacyMembership);

    if (action === 'approve') {
      if (!alreadyJoinedCurrentClass && classInfo.member_count >= classInfo.max_members) {
        return {
          success: false,
          message: '班级人数已满，无法通过申请',
          error_code: 409
        };
      }
    }

    const now = new Date();

    await db.collection('class_join_applications').doc(applicationId).update({
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        review_remark: reviewRemark,
        review_by: OPENID,
        review_time: now,
        update_time: now
      }
    });

    if (action === 'approve') {
      if (!alreadyJoinedCurrentClass) {
        await db.collection('class_memberships').add({
          data: {
            class_id: classInfo._id,
            student_openid: application.student_openid,
            source_application_id: applicationId,
            join_class_time: now,
            create_time: now,
            update_time: now
          }
        });

        await db.collection('classes').doc(classInfo._id).update({
          data: {
            member_count: _.inc(1),
            update_time: now
          }
        });

        await db.collection('users').doc(student._id).update({
          data: {
            update_time: now
          }
        });
      } else if (student._id) {
        await db.collection('users').doc(student._id).update({
          data: {
            update_time: now
          }
        });
      }
    }

    await writeOperationLog(db, {
      openid: OPENID,
      userType: 'teacher',
      action: action === 'approve' ? 'join_class_approve' : 'join_class_reject',
      targetType: 'class',
      targetId: classInfo._id,
      detail: {
        application_id: applicationId,
        student_openid: application.student_openid,
        review_remark: reviewRemark,
        already_joined_current_class: alreadyJoinedCurrentClass
      },
      now,
      contextLabel: 'handle-join-application'
    });

    await safeCreateNotification(() => createSystemNotification(db, {
      title: '入班申请结果',
      content: `你加入${classInfo.class_name || '未命名'}班级的申请已${action === 'approve' ? '通过' : '被拒绝'}`,
      targetOpenid: application.student_openid,
      notificationType: 'class_join_reviewed',
      actionUrl: action === 'approve'
        ? `/pages/student/class-manage/class-detail/class-detail?class_id=${classInfo._id}`
        : '/pages/student/class-manage/class-manage',
      relatedType: 'class_join_application',
      relatedId: applicationId,
      senderOpenid: OPENID,
      senderName: teacher.user_name || teacher.nick_name || '',
      now
    }), 'handle-join-application class_join_reviewed');

    return {
      success: true,
      message: action === 'approve' ? '通过申请成功' : '拒绝申请成功',
      data: {
        application_id: applicationId,
        class_id: classInfo._id,
        status: action === 'approve' ? 'approved' : 'rejected'
      }
    };
  } catch (error) {
    console.error('[handle-join-application] Error:', error);
    return {
      success: false,
      message: '处理入班申请失败',
      error: error.message,
      error_code: 500
    };
  }
};
