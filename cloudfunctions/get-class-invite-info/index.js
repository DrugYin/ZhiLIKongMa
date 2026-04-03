const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event) => {
  try {
    const classCode = String(event.class_code || '').trim().toUpperCase();

    if (!classCode) {
      return {
        success: false,
        message: '班级邀请码不能为空',
        error_code: 400
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

    const memberCount = Number(classInfo.member_count || 0);
    const maxMembers = Number(classInfo.max_members || 0);

    return {
      success: true,
      message: '获取班级邀请信息成功',
      data: {
        _id: classInfo._id,
        class_name: classInfo.class_name || '',
        class_code: classInfo.class_code || classCode,
        teacher_name: classInfo.teacher_name || '',
        project_code: classInfo.project_code || '',
        project_name: classInfo.project_name || '',
        class_time: classInfo.class_time || '',
        location: classInfo.location || '',
        description: classInfo.description || '',
        member_count: memberCount,
        max_members: maxMembers,
        is_full: maxMembers > 0 ? memberCount >= maxMembers : false
      }
    };
  } catch (error) {
    console.error('[get-class-invite-info] Error:', error);
    return {
      success: false,
      message: '获取班级邀请信息失败',
      error: error.message,
      error_code: 500
    };
  }
};
