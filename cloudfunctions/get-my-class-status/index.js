const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return res.data[0] || null;
}

async function getClassById(classId) {
  if (!classId) {
    return null;
  }

  try {
    const res = await db.collection('classes').doc(classId).get();
    return res.data || null;
  } catch (error) {
    return null;
  }
}

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext();
    const user = await getCurrentUser(OPENID);

    if (!user) {
      return {
        success: true,
        is_registered: false,
        data: {
          status: 'guest',
          joined_class: null,
          pending_application: null
        }
      };
    }

    if (user.class_id) {
      const classInfo = await getClassById(user.class_id);
      const memberCount = Number(classInfo && classInfo.member_count ? classInfo.member_count : 0);
      const maxMembers = Number(classInfo && classInfo.max_members ? classInfo.max_members : 0);

      return {
        success: true,
        is_registered: true,
        data: {
          status: 'joined',
          joined_class: {
            _id: user.class_id,
            class_name: classInfo ? classInfo.class_name : (user.class_name || ''),
            class_code: classInfo ? classInfo.class_code : (user.class_code || ''),
            teacher_name: classInfo ? (classInfo.teacher_name || '') : '',
            project_code: classInfo ? (classInfo.project_code || '') : '',
            project_name: classInfo ? (classInfo.project_name || '') : '',
            class_time: classInfo ? (classInfo.class_time || '') : '',
            location: classInfo ? (classInfo.location || '') : '',
            description: classInfo ? (classInfo.description || '') : '',
            member_count: memberCount,
            max_members: maxMembers,
            join_class_time: user.join_class_time || null
          },
          pending_application: null
        }
      };
    }

    const pendingRes = await db.collection('class_join_applications').where({
      student_openid: OPENID,
      status: 'pending'
    }).orderBy('update_time', 'desc').limit(1).get();
    const pendingApplication = pendingRes.data[0] || null;

    if (pendingApplication) {
      const classInfo = await getClassById(pendingApplication.class_id);
      const memberCount = Number(classInfo && classInfo.member_count ? classInfo.member_count : 0);
      const maxMembers = Number(classInfo && classInfo.max_members ? classInfo.max_members : 0);

      return {
        success: true,
        is_registered: true,
        data: {
          status: 'pending',
          joined_class: null,
          pending_application: {
            _id: pendingApplication._id,
            class_id: pendingApplication.class_id,
            class_name: pendingApplication.class_name || (classInfo ? classInfo.class_name : ''),
            class_code: pendingApplication.class_code || (classInfo ? classInfo.class_code : ''),
            teacher_name: classInfo ? (classInfo.teacher_name || '') : '',
            project_code: classInfo ? (classInfo.project_code || '') : '',
            project_name: classInfo ? (classInfo.project_name || '') : '',
            class_time: classInfo ? (classInfo.class_time || '') : '',
            location: classInfo ? (classInfo.location || '') : '',
            description: classInfo ? (classInfo.description || '') : '',
            member_count: memberCount,
            max_members: maxMembers,
            apply_reason: pendingApplication.apply_reason || '',
            create_time: pendingApplication.create_time || null,
            update_time: pendingApplication.update_time || null
          }
        }
      };
    }

    return {
      success: true,
      is_registered: true,
      data: {
        status: 'none',
        joined_class: null,
        pending_application: null
      }
    };
  } catch (error) {
    console.error('[get-my-class-status] Error:', error);
    return {
      success: false,
      message: '获取班级状态失败',
      error: error.message,
      error_code: 500
    };
  }
};
