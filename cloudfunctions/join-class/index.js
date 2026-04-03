const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

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
    console.error('[join-class] writeOperationLog Error:', error);
  }
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const classCode = String(event.class_code || '').trim().toUpperCase();
    const applyReason = String(event.apply_reason || '').trim();

    if (!classCode) {
      return {
        success: false,
        message: '班级邀请码不能为空',
        error_code: 400
      };
    }

    const user = await getCurrentUser(OPENID);
    if (!user) {
      return {
        success: false,
        message: '请先完成注册',
        error_code: 401
      };
    }

    if (user.class_id) {
      return {
        success: false,
        message: '你已加入班级，不能重复申请',
        error_code: 409
      };
    }

    const classRes = await db.collection('classes').where({
      class_code: classCode,
      status: 'active'
    }).limit(1).get();
    const classInfo = classRes.data[0];

    if (!classInfo) {
      return {
        success: false,
        message: '班级不存在或已停用',
        error_code: 404
      };
    }

    if (classInfo.member_count >= classInfo.max_members) {
      return {
        success: false,
        message: '班级人数已满',
        error_code: 409
      };
    }

    const pendingRes = await db.collection('class_join_applications').where({
      student_openid: OPENID,
      status: 'pending'
    }).count();

    if (pendingRes.total > 0) {
      return {
        success: false,
        message: '你已提交过申请，请勿重复提交',
        error_code: 409
      };
    }

    const now = new Date();
    const applicationData = {
      class_id: classInfo._id,
      class_code: classInfo.class_code,
      class_name: classInfo.class_name,
      student_openid: OPENID,
      student_name: user.user_name || user.nick_name || '',
      apply_reason: applyReason,
      status: 'pending',
      review_remark: '',
      review_by: '',
      review_time: null,
      create_time: now,
      update_time: now
    };

    const result = await db.collection('class_join_applications').add({
      data: applicationData
    });

    await writeOperationLog(OPENID, 'student', 'join_class_apply', classInfo._id, {
      class_id: classInfo._id,
      application_id: result._id,
      class_code: classInfo.class_code
    }, now);

    return {
      success: true,
      message: '提交入班申请成功',
      data: {
        _id: result._id,
        ...applicationData
      }
    };
  } catch (error) {
    console.error('[join-class] Error:', error);
    return {
      success: false,
      message: '提交入班申请失败',
      error: error.message,
      error_code: 500
    };
  }
};
