const cloud = require('wx-server-sdk');
const { getCurrentUser } = require('../_shared/auth');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

async function isUserMemberOfClass(user, openid, classId) {
  if (user && user.class_id === classId) {
    return true;
  }

  const membershipRes = await db.collection('class_memberships').where({
    class_id: classId,
    student_openid: openid
  }).count();

  return membershipRes.total > 0;
}

async function getAllMembershipDocs(classId) {
  const query = db.collection('class_memberships').where({
    class_id: classId
  });
  const totalRes = await query.count();
  const total = totalRes.total || 0;
  const pageSize = 100;
  const tasks = [];

  for (let skip = 0; skip < total; skip += pageSize) {
    tasks.push(
      query
        .skip(skip)
        .limit(pageSize)
        .field({
          _id: true,
          class_id: true,
          student_openid: true,
          join_class_time: true
        })
        .get()
    );
  }

  if (!tasks.length) {
    return [];
  }

  const list = await Promise.all(tasks);
  return list.reduce((result, item) => result.concat(item.data || []), []);
}

async function getAllLegacyMembers(classId) {
  const query = db.collection('users').where({
    class_id: classId
  });
  const totalRes = await query.count();
  const total = totalRes.total || 0;
  const pageSize = 100;
  const tasks = [];

  for (let skip = 0; skip < total; skip += pageSize) {
    tasks.push(
      query
        .skip(skip)
        .limit(pageSize)
        .field({
          _id: true,
          _openid: true,
          user_name: true,
          nick_name: true,
          avatar_url: true,
          grade: true,
          phone: true,
          join_class_time: true,
          points: true,
          total_points: true
        })
        .get()
    );
  }

  if (!tasks.length) {
    return [];
  }

  const list = await Promise.all(tasks);
  return list.reduce((result, item) => result.concat(item.data || []), []);
}

async function getUsersByOpenids(openids = []) {
  if (!openids.length) {
    return [];
  }

  const pageSize = 100;
  const tasks = [];

  for (let index = 0; index < openids.length; index += pageSize) {
    const chunk = openids.slice(index, index + pageSize);
    tasks.push(
      db.collection('users').where({
        _openid: _.in(chunk)
      }).field({
        _id: true,
        _openid: true,
        user_name: true,
        nick_name: true,
        avatar_url: true,
        grade: true,
        phone: true,
        points: true,
        total_points: true
      }).get()
    );
  }

  const list = await Promise.all(tasks);
  return list.reduce((result, item) => result.concat(item.data || []), []);
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const classId = String(event.class_id || '').trim();
    const page = Math.max(Number(event.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(event.page_size || 20), 1), 50);

    if (!classId) {
      return {
        success: false,
        message: '班级ID不能为空',
        error_code: 400
      };
    }

    const currentUser = await getCurrentUser(db, OPENID);
    const classRes = await db.collection('classes').doc(classId).get();
    const classInfo = classRes.data || null;
    if (!classInfo) {
      return {
        success: false,
        message: '班级不存在',
        error_code: 404
      };
    }

    const isTeacherOwner = classInfo.teacher_openid === OPENID;
    const isMember = currentUser ? await isUserMemberOfClass(currentUser, OPENID, classId) : false;
    if (!isTeacherOwner && !isMember) {
      return {
        success: false,
        message: '无权查看班级成员',
        error_code: 403
      };
    }

    const [membershipDocs, legacyMembers] = await Promise.all([
      getAllMembershipDocs(classId),
      getAllLegacyMembers(classId)
    ]);

    const memberMap = legacyMembers.reduce((result, item) => {
      result[item._openid] = {
        ...item,
        join_class_time: item.join_class_time || null
      };
      return result;
    }, {});

    const membershipOpenids = membershipDocs
      .map((item) => item.student_openid)
      .filter((item) => item && !memberMap[item]);

    if (membershipOpenids.length) {
      const userList = await getUsersByOpenids(membershipOpenids);

      userList.forEach((item) => {
        memberMap[item._openid] = {
          ...item,
          join_class_time: null
        };
      });
    }

    membershipDocs.forEach((item) => {
      if (!item.student_openid) {
        return;
      }

      const current = memberMap[item.student_openid] || {
        _openid: item.student_openid
      };

      memberMap[item.student_openid] = {
        ...current,
        join_class_time: item.join_class_time || current.join_class_time || null
      };
    });

    const mergedMembers = Object.values(memberMap)
      .sort((left, right) => {
        const leftTime = new Date(left.join_class_time || 0).getTime();
        const rightTime = new Date(right.join_class_time || 0).getTime();
        return leftTime - rightTime;
      });

    const total = mergedMembers.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pagedList = mergedMembers.slice(startIndex, endIndex);

    return {
      success: true,
      message: '获取班级成员成功',
      data: {
        list: pagedList,
        page,
        page_size: pageSize,
        total,
        has_more: endIndex < total
      }
    };
  } catch (error) {
    console.error('[get-class-members] Error:', error);
    return {
      success: false,
      message: '获取班级成员失败',
      error: error.message,
      error_code: 500
    };
  }
};
