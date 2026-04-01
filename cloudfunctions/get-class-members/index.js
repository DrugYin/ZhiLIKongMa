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
    const page = Math.max(Number(event.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(event.page_size || 20), 1), 50);

    if (!classId) {
      return {
        success: false,
        message: '班级ID不能为空',
        error_code: 400
      };
    }

    const currentUser = await getCurrentUser(OPENID);
    const classRes = await db.collection('classes').doc(classId).get();
    const classInfo = classRes.data || null;
    if (!classInfo) {
      return {
        success: false,
        message: '班级不存在',
        error_code: 404
      };
    }

    const isTeacherOwner = classInfo.teacher_openid === OPENID;
    const isMember = currentUser && currentUser.class_id === classId;
    if (!isTeacherOwner && !isMember) {
      return {
        success: false,
        message: '无权查看班级成员',
        error_code: 403
      };
    }

    const query = db.collection('users').where({
      class_id: classId
    });
    const totalRes = await query.count();
    const listRes = await query
      .orderBy('join_class_time', 'asc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .field({
        _id: true,
        _openid: true,
        user_name: true,
        nick_name: true,
        avatar_url: true,
        grade: true,
        phone: true,
        join_class_time: true,
        points: true,
        total_points: true
      })
      .get();

    return {
      success: true,
      message: '获取班级成员成功',
      data: {
        list: listRes.data,
        page,
        page_size: pageSize,
        total: totalRes.total,
        has_more: page * pageSize < totalRes.total
      }
    };
  } catch (error) {
    console.error('[get-class-members] Error:', error);
    return {
      success: false,
      message: '获取班级成员失败',
      error: error.message,
      error_code: 500
    };
  }
};
