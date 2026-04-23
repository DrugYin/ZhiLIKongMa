const cloud = require('wx-server-sdk');
const { verifyTeacherRole } = require('../_shared/auth');
const { writeOperationLog } = require('../_shared/operation-log');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const TASK_TYPES = new Set(['class', 'public']);
const TASK_VISIBILITIES = new Set(['class_only', 'public']);
const TASK_STATUSES = new Set(['draft', 'published', 'closed']);

async function getOwnedClass(openid, classId) {
  if (!classId) {
    return null;
  }

  try {
    const res = await db.collection('classes').doc(classId).get();
    const classInfo = res.data || null;

    if (!classInfo || classInfo.status === 'deleted') {
      return null;
    }

    return classInfo.teacher_openid === openid ? classInfo : null;
  } catch (error) {
    return null;
  }
}

function hasField(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeImages(images) {
  if (!Array.isArray(images)) {
    return [];
  }

  return images.map((item) => normalizeString(item)).filter(Boolean);
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) {
    return [];
  }

  return files.reduce((result, item) => {
    const fileId = normalizeString(item && item.file_id);
    if (!fileId) {
      return result;
    }

    result.push({
      file_id: fileId,
      file_name: normalizeString(item.file_name),
      file_size: Math.max(Number(item.file_size || 0), 0)
    });
    return result;
  }, []);
}

function normalizeDifficulty(value) {
  const difficulty = Number(value);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    return null;
  }
  return difficulty;
}

function normalizePoints(value) {
  const points = Number(value);
  if (!Number.isInteger(points) || points < 0) {
    return null;
  }
  return points;
}

function normalizeTaskType(value) {
  const taskType = normalizeString(value);
  return TASK_TYPES.has(taskType) ? taskType : '';
}

function normalizeVisibility(taskType, value) {
  if (taskType === 'public') {
    return 'public';
  }

  const visibility = normalizeString(value);
  return TASK_VISIBILITIES.has(visibility) ? visibility : 'class_only';
}

function normalizeStatus(value) {
  const status = normalizeString(value);
  return TASK_STATUSES.has(status) ? status : '';
}

function parseLocalDateTime(dateText, timeText) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const deadline = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    Number.isNaN(deadline.getTime())
    || deadline.getFullYear() !== year
    || deadline.getMonth() !== month - 1
    || deadline.getDate() !== day
    || deadline.getHours() !== hour
    || deadline.getMinutes() !== minute
  ) {
    return null;
  }

  return deadline;
}

function buildDeadline(deadlineDate, deadlineTime) {
  if (!deadlineDate && !deadlineTime) {
    return {
      deadline_date: '',
      deadline_time: '',
      deadline: null
    };
  }

  if (!deadlineDate || !deadlineTime) {
    return null;
  }

  const deadline = parseLocalDateTime(deadlineDate, deadlineTime);
  if (!deadline) {
    return null;
  }

  return {
    deadline_date: deadlineDate,
    deadline_time: deadlineTime,
    deadline: `${deadlineDate} ${deadlineTime}`
  };
}

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
    const taskId = normalizeString(event.task_id);

    if (!teacher) {
      return {
        success: false,
        message: '仅教师可以更新任务',
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
        message: '无权修改该任务',
        error_code: 403
      };
    }

    const title = hasField(event, 'title') ? normalizeString(event.title) : taskInfo.title;
    const description = hasField(event, 'description') ? normalizeString(event.description) : (taskInfo.description || '');
    const taskType = hasField(event, 'task_type') ? normalizeTaskType(event.task_type) : taskInfo.task_type;
    const difficulty = hasField(event, 'difficulty') ? normalizeDifficulty(event.difficulty) : Number(taskInfo.difficulty || 0);
    const points = hasField(event, 'points') ? normalizePoints(event.points) : Number(taskInfo.points || 0);
    const rawStatus = hasField(event, 'status') ? normalizeStatus(event.status) : taskInfo.status;
    const category = hasField(event, 'category') ? normalizeString(event.category) : (taskInfo.category || '');
    const projectCode = hasField(event, 'project_code') ? normalizeString(event.project_code) : (taskInfo.project_code || '');
    const projectName = hasField(event, 'project_name') ? normalizeString(event.project_name) : (taskInfo.project_name || '');
    const coverImage = hasField(event, 'cover_image') ? normalizeString(event.cover_image) : (taskInfo.cover_image || '');
    const images = hasField(event, 'images') ? normalizeImages(event.images) : (Array.isArray(taskInfo.images) ? taskInfo.images : []);
    const files = hasField(event, 'files') ? normalizeFiles(event.files) : (Array.isArray(taskInfo.files) ? taskInfo.files : []);
    const deadlineDate = hasField(event, 'deadline_date') ? normalizeString(event.deadline_date) : normalizeString(taskInfo.deadline_date);
    const deadlineTime = hasField(event, 'deadline_time') ? normalizeString(event.deadline_time) : normalizeString(taskInfo.deadline_time);
    const deadlineConfig = buildDeadline(deadlineDate, deadlineTime);

    if (!title) {
      return {
        success: false,
        message: '任务标题不能为空',
        error_code: 400
      };
    }

    if (!taskType) {
      return {
        success: false,
        message: '任务类型不合法',
        error_code: 400
      };
    }

    if (difficulty === null || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
      return {
        success: false,
        message: '任务难度需为 1-5 的整数',
        error_code: 400
      };
    }

    if (points === null || !Number.isInteger(points) || points < 0) {
      return {
        success: false,
        message: '任务积分需为大于等于 0 的整数',
        error_code: 400
      };
    }

    if (!rawStatus) {
      return {
        success: false,
        message: '任务状态不合法',
        error_code: 400
      };
    }

    if (deadlineConfig === null) {
      return {
        success: false,
        message: '截止日期和截止时间需同时填写且格式正确',
        error_code: 400
      };
    }

    let classInfo = null;
    let classId = '';
    let className = '';

    if (taskType === 'class') {
      classId = hasField(event, 'class_id') ? normalizeString(event.class_id) : normalizeString(taskInfo.class_id);

      if (!classId) {
        return {
          success: false,
          message: '班级任务必须选择所属班级',
          error_code: 400
        };
      }

      classInfo = await getOwnedClass(OPENID, classId);
      if (!classInfo) {
        return {
          success: false,
          message: '班级不存在或无权在该班级下维护任务',
          error_code: 403
        };
      }

      className = classInfo.class_name || '';
    }

    const visibility = normalizeVisibility(taskType, hasField(event, 'visibility') ? event.visibility : taskInfo.visibility);
    const now = new Date();
    const publishTime = rawStatus === 'published' ? (taskInfo.publish_time || now) : null;

    const updateData = {
      title,
      description,
      cover_image: coverImage,
      images,
      files,
      project_code: projectCode || (classInfo ? classInfo.project_code || '' : ''),
      project_name: projectName || (classInfo ? classInfo.project_name || '' : ''),
      category,
      difficulty,
      points,
      deadline_date: deadlineConfig.deadline_date,
      deadline_time: deadlineConfig.deadline_time,
      deadline: deadlineConfig.deadline,
      task_type: taskType,
      visibility,
      class_id: classId,
      class_name: className,
      status: rawStatus,
      publish_time: publishTime,
      update_time: now
    };

    await db.collection('tasks').doc(taskId).update({
      data: updateData
    });

    const previousClassId = taskInfo.task_type === 'class' ? normalizeString(taskInfo.class_id) : '';
    const nextClassId = taskType === 'class' ? classId : '';
    const previousPublished = taskInfo.task_type === 'class' && taskInfo.status === 'published' ? 1 : 0;
    const nextPublished = taskType === 'class' && rawStatus === 'published' ? 1 : 0;
    const previousTotal = taskInfo.task_type === 'class' ? 1 : 0;
    const nextTotal = taskType === 'class' ? 1 : 0;

    if (previousClassId === nextClassId) {
      await adjustClassTaskStats(nextClassId, nextTotal - previousTotal, nextPublished - previousPublished, now);
    } else {
      await adjustClassTaskStats(previousClassId, -previousTotal, -previousPublished, now);
      await adjustClassTaskStats(nextClassId, nextTotal, nextPublished, now);
    }

    await writeOperationLog(db, {
      openid: OPENID,
      userType: 'teacher',
      action: 'update_task',
      targetType: 'task',
      targetId: taskId,
      detail: {
        title,
        task_type: taskType,
        visibility,
        class_id: classId,
        difficulty,
        status: rawStatus
      },
      now,
      contextLabel: 'update-task'
    });

    return {
      success: true,
      message: '更新任务成功',
      data: {
        ...taskInfo,
        ...updateData,
        _id: taskId
      }
    };
  } catch (error) {
    console.error('[update-task] Error:', error);
    return {
      success: false,
      message: '更新任务失败',
      error: error.message,
      error_code: 500
    };
  }
};
