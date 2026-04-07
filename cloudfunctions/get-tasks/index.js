const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const PAGE_SIZE = 100;
const TASK_TYPES = new Set(['class', 'public']);
const TASK_VISIBILITIES = new Set(['class_only', 'public']);
const TASK_STATUSES = new Set(['draft', 'published', 'closed']);
const ALLOWED_SORT_FIELDS = new Set([
  'create_time',
  'update_time',
  'publish_time',
  'deadline',
  'difficulty',
  'points'
]);

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return res.data[0] || null;
}

async function verifyTeacherRole(openid) {
  const user = await getCurrentUser(openid);
  return user && Array.isArray(user.roles) && user.roles.includes('teacher') ? user : null;
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

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeTaskType(value) {
  const taskType = normalizeString(value);
  return TASK_TYPES.has(taskType) ? taskType : '';
}

function normalizeVisibility(value) {
  const visibility = normalizeString(value);
  return TASK_VISIBILITIES.has(visibility) ? visibility : '';
}

function normalizeStatus(value) {
  const status = normalizeString(value);
  return TASK_STATUSES.has(status) ? status : '';
}

function normalizeSortField(value) {
  const sortField = normalizeString(value) || 'create_time';
  return ALLOWED_SORT_FIELDS.has(sortField) ? sortField : 'create_time';
}

function normalizeSortOrder(value) {
  return normalizeString(value).toLowerCase() === 'asc' ? 'asc' : 'desc';
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

async function getAllTasksByQuery(queryData, sortField, sortOrder) {
  const query = db.collection('tasks').where(queryData);
  const totalRes = await query.count();
  const total = totalRes.total || 0;
  const requests = [];

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    requests.push(
      query
        .orderBy(sortField, sortOrder)
        .skip(skip)
        .limit(PAGE_SIZE)
        .get()
    );
  }

  if (!requests.length) {
    return [];
  }

  const result = await Promise.all(requests);
  return result.reduce((list, item) => list.concat(item.data || []), []);
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const user = await getCurrentUser(OPENID);

    if (!user) {
      return {
        success: false,
        message: '请先完成注册',
        error_code: 401
      };
    }

    const page = Math.max(Number(event.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(event.page_size || 20), 1), 50);
    const requestedRole = normalizeString(event.role || user.current_role || 'student');
    const taskType = normalizeTaskType(event.task_type);
    const visibility = normalizeVisibility(event.visibility);
    const status = normalizeStatus(event.status);
    const classId = normalizeString(event.class_id);
    const sortField = normalizeSortField(event.sort_by);
    const sortOrder = normalizeSortOrder(event.sort_order);

    if (requestedRole === 'teacher') {
      const teacher = await verifyTeacherRole(OPENID);
      if (!teacher) {
        return {
          success: false,
          message: '仅教师可以查看教师任务列表',
          error_code: 403
        };
      }

      const queryData = {
        teacher_openid: OPENID,
        is_deleted: _.neq(true)
      };

      if (taskType) {
        queryData.task_type = taskType;
      }

      if (visibility) {
        queryData.visibility = visibility;
      }

      if (status) {
        queryData.status = status;
      }

      if (classId) {
        queryData.class_id = classId;
      }

      const query = db.collection('tasks').where(queryData);
      const totalRes = await query.count();
      const listRes = await query
        .orderBy(sortField, sortOrder)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();

      return {
        success: true,
        message: '获取任务列表成功',
        data: {
          list: listRes.data,
          page,
          page_size: pageSize,
          total: totalRes.total,
          has_more: page * pageSize < totalRes.total
        }
      };
    }

    const memberships = await getAllMembershipsByStudent(OPENID);
    const joinedClassIds = memberships.map((item) => item.class_id).filter(Boolean);

    if (user.class_id && !joinedClassIds.includes(user.class_id)) {
      joinedClassIds.push(user.class_id);
    }

    const queryData = {
      is_deleted: _.neq(true),
      status: 'published'
    };

    if (taskType) {
      queryData.task_type = taskType;
    }

    if (visibility) {
      queryData.visibility = visibility;
    }

    if (classId) {
      queryData.class_id = classId;
    }

    const allTasks = await getAllTasksByQuery(queryData, sortField, sortOrder);
    const visibleTasks = allTasks.filter((item) => canStudentAccessTask(item, joinedClassIds));
    const total = visibleTasks.length;
    const start = (page - 1) * pageSize;
    const list = visibleTasks.slice(start, start + pageSize);

    return {
      success: true,
      message: '获取任务列表成功',
      data: {
        list,
        page,
        page_size: pageSize,
        total,
        has_more: start + pageSize < total
      }
    };
  } catch (error) {
    console.error('[get-tasks] Error:', error);
    return {
      success: false,
      message: '获取任务列表失败',
      error: error.message,
      error_code: 500
    };
  }
};
