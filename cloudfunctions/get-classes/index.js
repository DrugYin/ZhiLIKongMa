const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const DEFAULT_SORT_FIELD = 'create_time';
const DEFAULT_SORT_ORDER = 'desc';
const PAGE_SIZE = 100;
const CLASS_BATCH_SIZE = 20;
const ALLOWED_SORT_FIELDS = new Set([
  'create_time',
  'update_time',
  'class_name',
  'member_count'
]);

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return res.data[0] || null;
}

function normalizeSortField(sortField) {
  const value = String(sortField || DEFAULT_SORT_FIELD).trim();
  return ALLOWED_SORT_FIELDS.has(value) ? value : DEFAULT_SORT_FIELD;
}

function normalizeSortOrder(sortOrder) {
  return String(sortOrder || DEFAULT_SORT_ORDER).trim().toLowerCase() === 'asc'
    ? 'asc'
    : 'desc';
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
        class_id: true,
        join_class_time: true
      }).get()
    );
  }

  if (!tasks.length) {
    return [];
  }

  const list = await Promise.all(tasks);
  return list.reduce((result, item) => result.concat(item.data || []), []);
}

function chunkList(list, chunkSize) {
  const result = [];

  for (let index = 0; index < list.length; index += chunkSize) {
    result.push(list.slice(index, index + chunkSize));
  }

  return result;
}

async function getClassesByIds(classIds = []) {
  const tasks = chunkList(classIds, CLASS_BATCH_SIZE).map((batchIds) => (
    db.collection('classes').where({
      _id: _.in(batchIds)
    }).get()
  ));

  if (!tasks.length) {
    return [];
  }

  const list = await Promise.all(tasks);
  return list.reduce((result, item) => result.concat(item.data || []), []);
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const page = Math.max(Number(event.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(event.page_size || 20), 1), 50);
    const role = event.role || 'teacher';
    const sortField = normalizeSortField(event.sort_by);
    const sortOrder = normalizeSortOrder(event.sort_order);

    if (role === 'teacher') {
      const user = await getCurrentUser(OPENID);
      if (!user || !Array.isArray(user.roles) || !user.roles.includes('teacher')) {
        return {
          success: false,
          message: '仅教师可以查看班级列表',
          error_code: 403
        };
      }

      const query = db.collection('classes').where({
        teacher_openid: OPENID,
        status: _.neq('deleted')
      });
      const totalRes = await query.count();
      const listRes = await query
        .orderBy(sortField, sortOrder)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();

      return {
        success: true,
        message: '获取班级列表成功',
        data: {
          list: listRes.data,
          page,
          page_size: pageSize,
          total: totalRes.total,
          has_more: page * pageSize < totalRes.total
        }
      };
    }

    const user = await getCurrentUser(OPENID);
    const memberships = user ? await getAllMembershipsByStudent(OPENID) : [];
    const membershipMap = memberships.reduce((result, item) => {
      if (!item.class_id || result[item.class_id]) {
        return result;
      }

      result[item.class_id] = {
        class_id: item.class_id,
        join_class_time: item.join_class_time || null
      };
      return result;
    }, {});

    if (user && user.class_id && !membershipMap[user.class_id]) {
      membershipMap[user.class_id] = {
        class_id: user.class_id,
        join_class_time: user.join_class_time || null
      };
    }

    const classIds = Object.keys(membershipMap);
    if (!classIds.length) {
      return {
        success: true,
        message: '当前未加入班级',
        data: {
          list: [],
          page: 1,
          page_size: 0,
          total: 0,
          has_more: false
        }
      };
    }

    const classInfoList = await getClassesByIds(classIds);
    const classMap = classInfoList.reduce((result, item) => {
      if (!item || !item._id) {
        return result;
      }

      result[item._id] = item;
      return result;
    }, {});
    const classList = classIds.reduce((result, classId) => {
      const classInfo = classMap[classId];
      if (!classInfo || classInfo.status === 'deleted') {
        return result;
      }

      result.push({
        ...classInfo,
        join_class_time: membershipMap[classId].join_class_time || null
      });
      return result;
    }, []);

    classList.sort((left, right) => {
      const leftTime = new Date(left.join_class_time || left.create_time || 0).getTime();
      const rightTime = new Date(right.join_class_time || right.create_time || 0).getTime();
      return rightTime - leftTime;
    });

    return {
      success: true,
      message: '获取班级列表成功',
      data: {
        list: classList,
        page: 1,
        page_size: classList.length,
        total: classList.length,
        has_more: false
      }
    };
  } catch (error) {
    console.error('[get-classes] Error:', error);
    return {
      success: false,
      message: '获取班级列表失败',
      error: error.message,
      error_code: 500
    };
  }
};
