const cloud = require('wx-server-sdk');
const { getCurrentUser } = require('../_shared/auth');
const { getAllMembershipsByStudent, getClassesByIds } = require('../_shared/membership');
const { success, failure } = require('../_shared/response');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const PAGE_SIZE = 100;

async function getAllPendingApplications(openid) {
  const totalRes = await db.collection('class_join_applications').where({
    student_openid: openid,
    status: 'pending'
  }).count();
  const total = totalRes.total || 0;
  const tasks = [];

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      db.collection('class_join_applications').where({
        student_openid: openid,
        status: 'pending'
      }).orderBy('update_time', 'desc').skip(skip).limit(PAGE_SIZE).get()
    );
  }

  if (!tasks.length) {
    return [];
  }

  const list = await Promise.all(tasks);
  return list.reduce((result, item) => result.concat(item.data || []), []);
}

async function buildJoinedClasses(user, openid) {
  const memberships = await getAllMembershipsByStudent(db, openid, {
    _id: true,
    class_id: true,
    join_class_time: true
  }, PAGE_SIZE);
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

  if (user.class_id && !membershipMap[user.class_id]) {
    membershipMap[user.class_id] = {
      class_id: user.class_id,
      join_class_time: user.join_class_time || null,
      class_name: user.class_name || '',
      class_code: user.class_code || ''
    };
  }

  const classIds = Object.keys(membershipMap);
  const classInfoList = await getClassesByIds(db, _, classIds);
  const classMap = classInfoList.reduce((result, item) => {
    if (item && item._id) {
      result[item._id] = item;
    }
    return result;
  }, {});
  const joinedClasses = [];

  for (const classId of classIds) {
    const classInfo = classMap[classId] || null;
    if (!classInfo || classInfo.status === 'deleted') {
      continue;
    }

    const memberCount = Number(classInfo.member_count || 0);
    const maxMembers = Number(classInfo.max_members || 0);
    const membership = membershipMap[classId];

    joinedClasses.push({
      _id: classId,
      class_name: classInfo.class_name || membership.class_name || '',
      class_code: classInfo.class_code || membership.class_code || '',
      teacher_name: classInfo.teacher_name || '',
      project_code: classInfo.project_code || '',
      project_name: classInfo.project_name || '',
      class_time: classInfo.class_time || '',
      location: classInfo.location || '',
      description: classInfo.description || '',
      member_count: memberCount,
      max_members: maxMembers,
      join_class_time: membership.join_class_time || null
    });
  }

  return joinedClasses.sort((left, right) => {
    const leftTime = new Date(left.join_class_time || 0).getTime();
    const rightTime = new Date(right.join_class_time || 0).getTime();
    return rightTime - leftTime;
  });
}

async function buildPendingApplications(openid) {
  const applications = await getAllPendingApplications(openid);
  const classInfoList = await getClassesByIds(
    db,
    _,
    applications.map((item) => item.class_id).filter(Boolean)
  );
  const classMap = classInfoList.reduce((result, item) => {
    if (item && item._id) {
      result[item._id] = item;
    }
    return result;
  }, {});
  const pendingList = [];

  for (const item of applications) {
    const classInfo = classMap[item.class_id] || null;
    if (!classInfo || classInfo.status === 'deleted') {
      continue;
    }

    const memberCount = Number(classInfo.member_count || 0);
    const maxMembers = Number(classInfo.max_members || 0);

    pendingList.push({
      _id: item._id,
      class_id: item.class_id,
      class_name: item.class_name || classInfo.class_name || '',
      class_code: item.class_code || classInfo.class_code || '',
      teacher_name: classInfo.teacher_name || '',
      project_code: classInfo.project_code || '',
      project_name: classInfo.project_name || '',
      class_time: classInfo.class_time || '',
      location: classInfo.location || '',
      description: classInfo.description || '',
      member_count: memberCount,
      max_members: maxMembers,
      apply_reason: item.apply_reason || '',
      create_time: item.create_time || null,
      update_time: item.update_time || null
    });
  }

  return pendingList.sort((left, right) => {
    const leftTime = new Date(left.update_time || left.create_time || 0).getTime();
    const rightTime = new Date(right.update_time || right.create_time || 0).getTime();
    return rightTime - leftTime;
  });
}

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext();
    const user = await getCurrentUser(db, OPENID);

    if (!user) {
      return {
        ...success('获取班级状态成功', {
          status: 'guest',
          joined_class: null,
          joined_classes: [],
          joined_class_count: 0,
          pending_application: null,
          pending_applications: [],
          pending_application_count: 0
        }),
        is_registered: false
      };
    }

    const [joinedClasses, pendingApplications] = await Promise.all([
      buildJoinedClasses(user, OPENID),
      buildPendingApplications(OPENID)
    ]);

    const status = joinedClasses.length
      ? 'joined'
      : (pendingApplications.length ? 'pending' : 'none');

    return {
      ...success('获取班级状态成功', {
        status,
        joined_class: joinedClasses[0] || null,
        joined_classes: joinedClasses,
        joined_class_count: joinedClasses.length,
        pending_application: pendingApplications[0] || null,
        pending_applications: pendingApplications,
        pending_application_count: pendingApplications.length
      }),
      is_registered: true
    };
  } catch (error) {
    console.error('[get-my-class-status] Error:', error);
    return failure('获取班级状态失败', 500, {
      error: error.message
    });
  }
};
