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

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const page = Math.max(Number(event.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(event.page_size || 20), 1), 50);
    const role = event.role || 'teacher';

    if (role === 'teacher') {
      const user = await getCurrentUser(OPENID);
      if (!user || !Array.isArray(user.roles) || !user.roles.includes('teacher')) {
        return {
          success: false,
          message: '仅教师可以查看班级列表',
          error_code: 403
        };
      }

      const query = db.collection('classes').where({
        teacher_openid: OPENID,
        status: _.neq('deleted')
      });
      const totalRes = await query.count();
      const listRes = await query
        .orderBy('create_time', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();

      return {
        success: true,
        message: '获取班级列表成功',
        data: {
          list: listRes.data,
          page,
          page_size: pageSize,
          total: totalRes.total,
          has_more: page * pageSize < totalRes.total
        }
      };
    }

    const user = await getCurrentUser(OPENID);
    const currentClassId = user && user.class_id ? user.class_id : '';
    if (!currentClassId) {
      return {
        success: true,
        message: '当前未加入班级',
        data: {
          list: [],
          page: 1,
          page_size: 0,
          total: 0,
          has_more: false
        }
      };
    }

    const classRes = await db.collection('classes').doc(currentClassId).get();
    const classInfo = classRes.data || null;

    return {
      success: true,
      message: '获取班级列表成功',
      data: {
        list: classInfo ? [classInfo] : [],
        page: 1,
        page_size: classInfo ? 1 : 0,
        total: classInfo ? 1 : 0,
        has_more: false
      }
    };
  } catch (error) {
    console.error('[get-classes] Error:', error);
    return {
      success: false,
      message: '获取班级列表失败',
      error: error.message,
      error_code: 500
    };
  }
};
