const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const PAGE_SIZE = 100;

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
    console.error('[update-class] writeOperationLog Error:', error);
  }
}

async function getAllUsersInClass(classId) {
  const totalRes = await db.collection('users').where({
    class_id: classId
  }).count();
  const total = totalRes.total || 0;
  const tasks = [];

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      db.collection('users').where({
        class_id: classId
      }).skip(skip).limit(PAGE_SIZE).field({
        _id: true
      }).get()
    );
  }

  if (!tasks.length) {
    return [];
  }

  const list = await Promise.all(tasks);
  return list.reduce((result, item) => result.concat(item.data || []), []);
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const teacher = await verifyTeacherRole(OPENID);
    const classId = String(event.class_id || '').trim();

    if (!teacher) {
      return {
        success: false,
        message: '仅教师可以更新班级',
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
        message: '班级不存在',
        error_code: 404
      };
    }

    if (classInfo.teacher_openid !== OPENID) {
      return {
        success: false,
        message: '无权修改该班级',
        error_code: 403
      };
    }

    const className = String(event.class_name || '').trim();
    const projectCode = String(event.project_code || '').trim();
    const projectName = String(event.project_name || '').trim();
    const classTime = String(event.class_time || '').trim();
    const location = String(event.location || '').trim();
    const description = String(event.description || '').trim();
    const maxMembers = Number(event.max_members || 0);

    if (!className) {
      return {
        success: false,
        message: '班级名称不能为空',
        error_code: 400
      };
    }

    if (!projectCode) {
      return {
        success: false,
        message: '所属项目不能为空',
        error_code: 400
      };
    }

    if (!Number.isInteger(maxMembers) || maxMembers <= 0) {
      return {
        success: false,
        message: '班级人数上限不合法',
        error_code: 400
      };
    }

    if (maxMembers < Number(classInfo.member_count || 0)) {
      return {
        success: false,
        message: '人数上限不能小于当前成员人数',
        error_code: 409
      };
    }

    const now = new Date();
    const updateData = {
      class_name: className,
      project_code: projectCode,
      project_name: projectName,
      class_time: classTime,
      location,
      description,
      max_members: maxMembers,
      update_time: now
    };

    await db.collection('classes').doc(classId).update({
      data: updateData
    });

    const legacyMembers = await getAllUsersInClass(classId);
    if (legacyMembers.length) {
      await Promise.all(legacyMembers.map((member) => db.collection('users').doc(member._id).update({
        data: {
          class_name: className,
          update_time: now
        }
      })));
    }

    await db.collection('class_join_applications').where({
      class_id: classId
    }).update({
      data: {
        class_name: className,
        class_code: classInfo.class_code,
        update_time: now
      }
    });

    await writeOperationLog(OPENID, 'teacher', 'update_class', classId, {
      class_name: className,
      project_code: projectCode,
      class_time: classTime,
      location,
      max_members: maxMembers
    }, now);

    return {
      success: true,
      message: '更新班级成功',
      data: {
        ...classInfo,
        ...updateData,
        _id: classId
      }
    };
  } catch (error) {
    console.error('[update-class] Error:', error);
    return {
      success: false,
      message: '更新班级失败',
      error: error.message,
      error_code: 500
    };
  }
};
