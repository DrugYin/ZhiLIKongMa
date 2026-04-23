const cloud = require('wx-server-sdk');
const { getCurrentUser } = require('/opt/auth');
const { writeOperationLog } = require('/opt/operation-log');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

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
    const classCode = String(event.class_code || '').trim().toUpperCase();
    const applyReason = String(event.apply_reason || '').trim();

    if (!classCode) {
      return {
        success: false,
        message: '班级邀请码不能为空',
        error_code: 400
      };
    }

    const user = await getCurrentUser(db, OPENID);
    if (!user) {
      return {
        success: false,
        message: '请先完成注册',
        error_code: 401
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

    const currentMembership = await getMembership(classInfo._id, OPENID);
    if ((user && user.class_id === classInfo._id) || currentMembership) {
      return {
        success: false,
        message: '你已加入当前班级，请勿重复申请',
        error_code: 409
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
      class_id: classInfo._id,
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

    await writeOperationLog(db, {
      openid: OPENID,
      userType: 'student',
      action: 'join_class_apply',
      targetType: 'class',
      targetId: classInfo._id,
      detail: {
        class_id: classInfo._id,
        application_id: result._id,
        class_code: classInfo.class_code
      },
      now,
      contextLabel: 'join-class'
    });

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
