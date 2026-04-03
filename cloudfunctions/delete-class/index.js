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

async function verifyTeacherRole(openid) {
  const user = await getCurrentUser(openid);
  return user && Array.isArray(user.roles) && user.roles.includes('teacher') ? user : null;
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
    console.error('[delete-class] writeOperationLog Error:', error);
  }
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const teacher = await verifyTeacherRole(OPENID);
    const classId = String(event.class_id || '').trim();

    if (!teacher) {
      return {
        success: false,
        message: '仅教师可以删除班级',
        error_code: 403
      };
    }

    if (!classId) {
      return {
        success: false,
        message: '班级ID不能为空',
        error_code: 400
      };
    }

    const classRes = await db.collection('classes').doc(classId).get();
    const classInfo = classRes.data || null;

    if (!classInfo || classInfo.status === 'deleted') {
      return {
        success: false,
        message: '班级不存在或已删除',
        error_code: 404
      };
    }

    if (classInfo.teacher_openid !== OPENID) {
      return {
        success: false,
        message: '无权删除该班级',
        error_code: 403
      };
    }

    const now = new Date();
    const memberRes = await db.collection('users').where({
      class_id: classId
    }).field({
      _id: true,
      _openid: true,
      user_name: true,
      nick_name: true
    }).get();

    const members = memberRes.data || [];

    await Promise.all(members.map((member) => db.collection('users').doc(member._id).update({
      data: {
        class_id: _.remove(),
        class_name: _.remove(),
        class_code: _.remove(),
        join_class_time: _.remove(),
        update_time: now
      }
    })));

    await db.collection('class_join_applications').where({
      class_id: classId,
      status: 'pending'
    }).update({
      data: {
        status: 'rejected',
        review_remark: '班级已删除',
        review_by: OPENID,
        review_time: now,
        update_time: now
      }
    });

    await db.collection('classes').doc(classId).update({
      data: {
        status: 'deleted',
        member_count: 0,
        update_time: now,
        delete_time: now
      }
    });

    await writeOperationLog(OPENID, 'teacher', 'delete_class', classId, {
      class_name: classInfo.class_name,
      class_code: classInfo.class_code,
      removed_member_count: members.length
    }, now);

    return {
      success: true,
      message: '删除班级成功',
      data: {
        class_id: classId,
        member_count: members.length
      }
    };
  } catch (error) {
    console.error('[delete-class] Error:', error);
    return {
      success: false,
      message: '删除班级失败',
      error: error.message,
      error_code: 500
    };
  }
};
