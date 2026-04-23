const cloud = require('wx-server-sdk');
const { getCurrentUser } = require('/opt/auth');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

async function isUserMemberOfClass(user, openid, classId) {
  if (user && user.class_id === classId) {
    return true;
  }

  const membershipRes = await db.collection('class_memberships').where({
    class_id: classId,
    student_openid: openid
  }).count();

  return membershipRes.total > 0;
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const classId = String(event.class_id || '').trim();

    if (!classId) {
      return {
        success: false,
        message: '班级ID不能为空',
        error_code: 400
      };
    }

    const user = await getCurrentUser(db, OPENID);
    const classRes = await db.collection('classes').doc(classId).get();
    const classInfo = classRes.data || null;

    if (!classInfo || classInfo.status === 'deleted') {
      return {
        success: false,
        message: '班级不存在',
        error_code: 404
      };
    }

    const isTeacherOwner = classInfo.teacher_openid === OPENID;
    const isMember = user ? await isUserMemberOfClass(user, OPENID, classId) : false;
    if (!isTeacherOwner && !isMember) {
      return {
        success: false,
        message: '无权查看该班级详情',
        error_code: 403
      };
    }

    const pendingCountRes = isTeacherOwner
      ? await db.collection('class_join_applications').where({
        class_id: classId,
        status: 'pending'
      }).count()
      : { total: 0 };

    return {
      success: true,
      message: '获取班级详情成功',
      data: {
        ...classInfo,
        pending_application_count: pendingCountRes.total
      }
    };
  } catch (error) {
    console.error('[get-class-detail] Error:', error);
    return {
      success: false,
      message: '获取班级详情失败',
      error: error.message,
      error_code: 500
    };
  }
};
