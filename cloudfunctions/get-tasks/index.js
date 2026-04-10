const cloud = require('wx-server-sdk');
const { getCurrentUser, verifyTeacherRole } = require('../_shared/auth');
const { chunkList, getAllMembershipsByStudent, buildJoinedClassIds } = require('../_shared/membership');
const { canStudentAccessTask } = require('../_shared/task-access');
const { success, failure } = require('../_shared/response');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const PAGE_SIZE = 100;
const QUERY_BATCH_SIZE = 20;
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

function buildStudentQueryConfigs(taskType, visibility, classId, joinedClassIds = []) {
  const shouldIncludePublicTasks = (!taskType || taskType === 'public')
    && (!visibility || visibility === 'public');
  const shouldIncludePublicClassTasks = (!taskType || taskType === 'class')
    && (!visibility || visibility === 'public');
  const shouldIncludeClassOnlyTasks = (!taskType || taskType === 'class')
    && (!visibility || visibility === 'class_only');
  const queryConfigs = [];

  if (shouldIncludePublicTasks) {
    queryConfigs.push({
      type: 'public_task',
      queryData: {
        is_deleted: _.neq(true),
        status: 'published',
        task_type: 'public',
        visibility: 'public',
        ...(classId ? { class_id: classId } : {})
      }
    });
  }

  if (shouldIncludePublicClassTasks) {
    queryConfigs.push({
      type: 'public_class_task',
      queryData: {
        is_deleted: _.neq(true),
        status: 'published',
        task_type: 'class',
        visibility: 'public',
        ...(classId ? { class_id: classId } : {})
      }
    });
  }

  if (shouldIncludeClassOnlyTasks) {
    const visibleClassIds = classId
      ? joinedClassIds.filter((item) => item === classId)
      : joinedClassIds;

    chunkList(visibleClassIds, QUERY_BATCH_SIZE).forEach((batchIds, index) => {
      if (!batchIds.length) {
        return;
      }

      queryConfigs.push({
        type: `class_only_task_${index + 1}`,
        queryData: {
          is_deleted: _.neq(true),
          status: 'published',
          task_type: 'class',
          visibility: 'class_only',
          class_id: _.in(batchIds)
        }
      });
    });
  }

  return queryConfigs;
}

async function fetchQueryCount(queryData) {
  const totalRes = await db.collection('tasks').where(queryData).count();
  return totalRes.total || 0;
}

function normalizeComparableValue(value) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? value : timestamp;
  }

  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? String(value) : timestamp;
}

function compareTaskItem(left, right, sortField, sortOrder) {
  const leftValue = normalizeComparableValue(left && left[sortField]);
  const rightValue = normalizeComparableValue(right && right[sortField]);

  if (leftValue !== rightValue) {
    if (sortOrder === 'asc') {
      return leftValue < rightValue ? -1 : 1;
    }

    return leftValue > rightValue ? -1 : 1;
  }

  const leftCreateTime = normalizeComparableValue(left && left.create_time);
  const rightCreateTime = normalizeComparableValue(right && right.create_time);
  if (leftCreateTime !== rightCreateTime) {
    return rightCreateTime - leftCreateTime;
  }

  return String(left && left._id || '').localeCompare(String(right && right._id || ''));
}

async function buildTaskQueryState(queryData, count) {
  return {
    queryData,
    count,
    query: db.collection('tasks').where(queryData),
    skip: 0,
    buffer: [],
    index: 0,
    exhausted: count <= 0
  };
}

async function ensureTaskBuffer(state, sortField, sortOrder, pageSize) {
  if (!state || state.exhausted || state.index < state.buffer.length) {
    return;
  }

  const listRes = await state.query
    .orderBy(sortField, sortOrder)
    .skip(state.skip)
    .limit(pageSize)
    .get();

  state.buffer = listRes.data || [];
  state.index = 0;
  state.skip += state.buffer.length;
  state.exhausted = state.buffer.length < pageSize || state.skip >= state.count;
}

async function getStudentTaskPage(queryConfigs, sortField, sortOrder, page, pageSize) {
  if (!queryConfigs.length) {
    return {
      list: [],
      total: 0,
      hasMore: false
    };
  }

  const counts = await Promise.all(queryConfigs.map((item) => fetchQueryCount(item.queryData)));
  const total = counts.reduce((sum, count) => sum + count, 0);

  if (!total) {
    return {
      list: [],
      total: 0,
      hasMore: false
    };
  }

  const states = await Promise.all(
    queryConfigs.map((item, index) => buildTaskQueryState(item.queryData, counts[index]))
  );
  const start = (page - 1) * pageSize;
  const list = [];
  const seenTaskIds = new Set();
  let mergedIndex = 0;

  while (list.length < pageSize) {
    await Promise.all(states.map((state) => ensureTaskBuffer(state, sortField, sortOrder, pageSize)));

    const candidates = states
      .filter((state) => state.index < state.buffer.length)
      .map((state) => ({
        state,
        item: state.buffer[state.index]
      }));

    if (!candidates.length) {
      break;
    }

    candidates.sort((left, right) => compareTaskItem(left.item, right.item, sortField, sortOrder));
    const current = candidates[0];
    current.state.index += 1;

    if (!current.item || seenTaskIds.has(current.item._id)) {
      continue;
    }

    seenTaskIds.add(current.item._id);

    if (mergedIndex >= start) {
      list.push(current.item);
    }

    mergedIndex += 1;
  }

  return {
    list,
    total,
    hasMore: page * pageSize < total
  };
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const user = await getCurrentUser(db, OPENID);

    if (!user) {
      return failure('请先完成注册', 401);
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
      const teacher = await verifyTeacherRole(db, OPENID);
      if (!teacher) {
        return failure('仅教师可以查看教师任务列表', 403);
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

      return success('获取任务列表成功', {
        list: listRes.data,
        page,
        page_size: pageSize,
        total: totalRes.total,
        has_more: page * pageSize < totalRes.total
      });
    }

    const memberships = await getAllMembershipsByStudent(db, OPENID, {
      _id: true,
      class_id: true
    }, PAGE_SIZE);
    const joinedClassIds = buildJoinedClassIds(user, memberships);

    const studentQueryConfigs = buildStudentQueryConfigs(taskType, visibility, classId, joinedClassIds);
    const studentTaskResult = await getStudentTaskPage(
      studentQueryConfigs,
      sortField,
      sortOrder,
      page,
      pageSize
    );
    const list = studentTaskResult.list.filter((item) => canStudentAccessTask(item, joinedClassIds));

    return success('获取任务列表成功', {
      list,
      page,
      page_size: pageSize,
      total: studentTaskResult.total,
      has_more: studentTaskResult.hasMore
    });
  } catch (error) {
    console.error('[get-tasks] Error:', error);
    return failure('获取任务列表失败', 500, {
      error: error.message
    });
  }
};
