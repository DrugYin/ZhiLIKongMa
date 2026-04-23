const cloud = require('wx-server-sdk');
const { verifyTeacherRole } = require('../_shared/auth');
const { writeOperationLog } = require('../_shared/operation-log');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

async function adjustClassTaskStats(classId, totalDelta, publishedDelta, now) {
  if (!classId || (!totalDelta && !publishedDelta)) {
    return;
  }

  const updateData = {
    update_time: now
  };

  if (totalDelta) {
    updateData.task_count = _.inc(totalDelta);
  }

  if (publishedDelta) {
    updateData.published_task_count = _.inc(publishedDelta);
  }

  await db.collection('classes').doc(classId).update({
    data: updateData
  });
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const teacher = await verifyTeacherRole(db, OPENID);
    const taskId = String(event.task_id || '').trim();

    if (!teacher) {
      return {
        success: false,
        message: '仅教师可以删除任务',
        error_code: 403
      };
    }

    if (!taskId) {
      return {
        success: false,
        message: '任务ID不能为空',
        error_code: 400
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

    if (taskInfo.teacher_openid !== OPENID) {
      return {
        success: false,
        message: '无权删除该任务',
        error_code: 403
      };
    }

    const now = new Date();

    await db.collection('tasks').doc(taskId).update({
      data: {
        is_deleted: true,
        delete_time: now,
        status: 'closed',
        update_time: now
      }
    });

    if (taskInfo.task_type === 'class' && taskInfo.class_id) {
      await adjustClassTaskStats(taskInfo.class_id, -1, taskInfo.status === 'published' ? -1 : 0, now);
    }

    await writeOperationLog(db, {
      openid: OPENID,
      userType: 'teacher',
      action: 'delete_task',
      targetType: 'task',
      targetId: taskId,
      detail: {
        title: taskInfo.title || '',
        task_type: taskInfo.task_type || '',
        class_id: taskInfo.class_id || '',
        status: taskInfo.status || ''
      },
      now,
      contextLabel: 'delete-task'
    });

    return {
      success: true,
      message: '删除任务成功',
      data: {
        task_id: taskId
      }
    };
  } catch (error) {
    console.error('[delete-task] Error:', error);
    return {
      success: false,
      message: '删除任务失败',
      error: error.message,
      error_code: 500
    };
  }
};
