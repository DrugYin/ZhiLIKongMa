const cloud = require('wx-server-sdk');
const { getCurrentUser } = require('../_shared/auth');
const { getAllMembershipsByStudent, buildJoinedClassIds } = require('../_shared/membership');
const { canStudentAccessTask } = require('../_shared/task-access');
const { success, failure } = require('../_shared/response');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const PAGE_SIZE = 100;

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const taskId = String(event.task_id || '').trim();

    if (!taskId) {
      return failure('任务ID不能为空', 400);
    }

    const user = await getCurrentUser(db, OPENID);
    if (!user) {
      return failure('请先完成注册', 401);
    }

    let taskInfo = null;
    try {
      const taskRes = await db.collection('tasks').doc(taskId).get();
      taskInfo = taskRes.data || null;
    } catch (error) {
      taskInfo = null;
    }

    if (!taskInfo || taskInfo.is_deleted) {
      return failure('任务不存在', 404);
    }

    if (taskInfo.teacher_openid === OPENID) {
      return success('获取任务详情成功', taskInfo);
    }

    const memberships = await getAllMembershipsByStudent(db, OPENID, {
      _id: true,
      class_id: true
    }, PAGE_SIZE);
    const joinedClassIds = buildJoinedClassIds(user, memberships);

    if (!canStudentAccessTask(taskInfo, joinedClassIds)) {
      return failure('无权查看该任务详情', 403);
    }

    return success('获取任务详情成功', taskInfo);
  } catch (error) {
    console.error('[get-task-detail] Error:', error);
    return failure('获取任务详情失败', 500, {
      error: error.message
    });
  }
};
