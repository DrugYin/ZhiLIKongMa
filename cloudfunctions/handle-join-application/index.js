const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return res.data[0] || null;
}

async function writeOperationLog(openid, userType, action, targetId, detail, now) {
  try {
    await db.collection('operation_logs').add({
      data: {
        user_openid: openid,
        user_type: userType,
        action,
        target_type: 'class',
        target_id: targetId,
        detail,
        create_time: now
      }
    });
  } catch (error) {
    console.error('[handle-join-application] writeOperationLog Error:', error);
  }
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

    const teacher = await getCurrentUser(OPENID);
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

    if (action === 'approve') {
      if (student.class_id) {
        return {
          success: false,
          message: '该学生已加入其他班级',
          error_code: 409
        };
      }

      if (classInfo.member_count >= classInfo.max_members) {
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
      await db.collection('users').doc(student._id).update({
        data: {
          class_id: classInfo._id,
          class_name: classInfo.class_name,
          class_code: classInfo.class_code,
          join_class_time: now,
          update_time: now
        }
      });

      await db.collection('classes').doc(classInfo._id).update({
        data: {
          member_count: _.inc(1),
          update_time: now
        }
      });

      await db.collection('class_join_applications').where({
        student_openid: application.student_openid,
        status: 'pending',
        _id: _.neq(applicationId)
      }).update({
        data: {
          status: 'rejected',
          review_remark: '学生已加入其他班级',
          review_by: OPENID,
          review_time: now,
          update_time: now
        }
      });
    }

    await writeOperationLog(
      OPENID,
      'teacher',
      action === 'approve' ? 'join_class_approve' : 'join_class_reject',
      classInfo._id,
      {
        application_id: applicationId,
        student_openid: application.student_openid,
        review_remark: reviewRemark
      },
      now
    );

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
