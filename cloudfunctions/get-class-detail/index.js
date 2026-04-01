const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return res.data[0] || null;
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

    const user = await getCurrentUser(OPENID);
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
    const isMember = user && user.class_id === classId;
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
