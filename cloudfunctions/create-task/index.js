const cloud = require('wx-server-sdk');
const { verifyTeacherRole } = require('/opt/auth');
const { writeOperationLog } = require('/opt/operation-log');
const { createClassTaskNotification, safeCreateNotification } = require('/opt/notification');

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
  return TASK_STATUSES.has(status) ? status : 'draft';
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

    if (!teacher) {
      return {
        success: false,
        message: '仅教师可以创建任务',
        error_code: 403
      };
    }

    const title = normalizeString(event.title);
    const description = normalizeString(event.description);
    const taskType = normalizeTaskType(event.task_type);
    const difficulty = normalizeDifficulty(event.difficulty);
    let defaultPoints = 10
    if (event.points === undefined) {
      try {
        const configRes = await db.collection('system_config')
          .where({ config_key: 'points_per_task' })
          .get()
        if (configRes.data.length > 0) {
          defaultPoints = configRes.data[0].config_value
        }
      } catch (e) {
        console.log('[create-task] 获取配置失败，使用默认值:', e.message)
      }
    }
    const points = normalizePoints(event.points === undefined ? defaultPoints : event.points);
    const status = normalizeStatus(event.status);
    const category = normalizeString(event.category);
    const projectCode = normalizeString(event.project_code);
    const projectName = normalizeString(event.project_name);
    const coverImage = normalizeString(event.cover_image);
    const images = normalizeImages(event.images);
    const files = normalizeFiles(event.files);
    const deadlineConfig = buildDeadline(
      normalizeString(event.deadline_date),
      normalizeString(event.deadline_time)
    );

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

    if (difficulty === null) {
      return {
        success: false,
        message: '任务难度需为 1-5 的整数',
        error_code: 400
      };
    }

    if (points === null) {
      return {
        success: false,
        message: '任务积分需为大于等于 0 的整数',
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
      classId = normalizeString(event.class_id);
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
          message: '班级不存在或无权在该班级下创建任务',
          error_code: 403
        };
      }

      className = classInfo.class_name || '';
    }

    const visibility = normalizeVisibility(taskType, event.visibility);
    const now = new Date();
    const publishTime = status === 'published' ? now : null;
    const taskData = {
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
      teacher_openid: OPENID,
      teacher_name: teacher.user_name || teacher.nick_name || '',
      status,
      publish_time: publishTime,
      create_time: now,
      update_time: now,
      is_deleted: false
    };

    const result = await db.collection('tasks').add({
      data: taskData
    });

    if (taskType === 'class') {
      await adjustClassTaskStats(classId, 1, status === 'published' ? 1 : 0, now);

      if (status === 'published') {
        await safeCreateNotification(() => createClassTaskNotification(db, {
          taskId: result._id,
          classId,
          className,
          taskTitle: title,
          senderOpenid: OPENID,
          senderName: teacher.user_name || teacher.nick_name || '',
          now
        }), 'create-task class_task_published');
      }
    }

    await writeOperationLog(db, {
      openid: OPENID,
      userType: 'teacher',
      action: 'create_task',
      targetType: 'task',
      targetId: result._id,
      detail: {
        title,
        task_type: taskType,
        visibility,
        class_id: classId,
        difficulty,
        status
      },
      now,
      contextLabel: 'create-task'
    });

    return {
      success: true,
      message: '创建任务成功',
      data: {
        _id: result._id,
        ...taskData
      }
    };
  } catch (error) {
    console.error('[create-task] Error:', error);
    return {
      success: false,
      message: '创建任务失败',
      error: error.message,
      error_code: 500
    };
  }
};
