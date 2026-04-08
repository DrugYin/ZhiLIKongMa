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

async function getAllMembershipsByStudent(openid) {
  const totalRes = await db.collection('class_memberships').where({
    student_openid: openid
  }).count();
  const total = totalRes.total || 0;
  const tasks = [];

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      db.collection('class_memberships').where({
        student_openid: openid
      }).skip(skip).limit(PAGE_SIZE).field({
        _id: true,
        class_id: true
      }).get()
    );
  }

  if (!tasks.length) {
    return [];
  }

  const list = await Promise.all(tasks);
  return list.reduce((result, item) => result.concat(item.data || []), []);
}

function canStudentAccessTask(task, joinedClassIds) {
  if (!task || task.is_deleted || task.status !== 'published') {
    return false;
  }

  if (task.task_type === 'public') {
    return true;
  }

  if (task.task_type === 'class' && task.visibility === 'public') {
    return true;
  }

  return task.task_type === 'class'
    && task.visibility === 'class_only'
    && joinedClassIds.includes(task.class_id);
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const taskId = String(event.task_id || '').trim();

    if (!taskId) {
      return {
        success: false,
        message: '任务ID不能为空',
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

    let taskInfo = null;
    try {
      const taskRes = await db.collection('tasks').doc(taskId).get();
      taskInfo = taskRes.data || null;
    } catch (error) {
      taskInfo = null;
    }

    if (!taskInfo || taskInfo.is_deleted) {
      return {
        success: false,
        message: '任务不存在',
        error_code: 404
      };
    }

    if (taskInfo.teacher_openid === OPENID) {
      return {
        success: true,
        message: '获取任务详情成功',
        data: taskInfo
      };
    }

    const memberships = await getAllMembershipsByStudent(OPENID);
    const joinedClassIds = memberships.map((item) => item.class_id).filter(Boolean);

    if (user.class_id && !joinedClassIds.includes(user.class_id)) {
      joinedClassIds.push(user.class_id);
    }

    if (!canStudentAccessTask(taskInfo, joinedClassIds)) {
      return {
        success: false,
        message: '无权查看该任务详情',
        error_code: 403
      };
    }

    return {
      success: true,
      message: '获取任务详情成功',
      data: taskInfo
    };
  } catch (error) {
    console.error('[get-task-detail] Error:', error);
    return {
      success: false,
      message: '获取任务详情失败',
      error: error.message,
      error_code: 500
    };
  }
};
