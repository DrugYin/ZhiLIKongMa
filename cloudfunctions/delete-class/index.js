const cloud = require('wx-server-sdk');
const { verifyTeacherRole } = require('../_shared/auth');
const { writeOperationLog } = require('../_shared/operation-log');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const PAGE_SIZE = 100;

async function getAllUsersInClass(classId) {
  const totalRes = await db.collection('users').where({
    class_id: classId
  }).count();
  const total = totalRes.total || 0;
  const tasks = [];

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      db.collection('users').where({
        class_id: classId
      }).skip(skip).limit(PAGE_SIZE).field({
        _id: true,
        _openid: true,
        user_name: true,
        nick_name: true
      }).get()
    );
  }

  if (!tasks.length) {
    return [];
  }

  const list = await Promise.all(tasks);
  return list.reduce((result, item) => result.concat(item.data || []), []);
}

async function getAllMembershipsInClass(classId) {
  const totalRes = await db.collection('class_memberships').where({
    class_id: classId
  }).count();
  const total = totalRes.total || 0;
  const tasks = [];

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      db.collection('class_memberships').where({
        class_id: classId
      }).skip(skip).limit(PAGE_SIZE).field({
        _id: true,
        student_openid: true
      }).get()
    );
  }

  if (!tasks.length) {
    return [];
  }

  const list = await Promise.all(tasks);
  return list.reduce((result, item) => result.concat(item.data || []), []);
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const teacher = await verifyTeacherRole(db, OPENID);
    const classId = String(event.class_id || '').trim();

    if (!teacher) {
      return {
        success: false,
        message: '仅教师可以删除班级',
        error_code: 403
      };
    }

    if (!classId) {
      return {
        success: false,
        message: '班级ID不能为空',
        error_code: 400
      };
    }

    const classRes = await db.collection('classes').doc(classId).get();
    const classInfo = classRes.data || null;

    if (!classInfo || classInfo.status === 'deleted') {
      return {
        success: false,
        message: '班级不存在或已删除',
        error_code: 404
      };
    }

    if (classInfo.teacher_openid !== OPENID) {
      return {
        success: false,
        message: '无权删除该班级',
        error_code: 403
      };
    }

    const now = new Date();
    const [legacyMembers, memberships] = await Promise.all([
      getAllUsersInClass(classId),
      getAllMembershipsInClass(classId)
    ]);

    await Promise.all(legacyMembers.map((member) => db.collection('users').doc(member._id).update({
      data: {
        class_id: _.remove(),
        class_name: _.remove(),
        class_code: _.remove(),
        join_class_time: _.remove(),
        update_time: now
      }
    })));

    await Promise.all(memberships.map((membership) => (
      db.collection('class_memberships').doc(membership._id).remove()
    )));

    await db.collection('class_join_applications').where({
      class_id: classId,
      status: 'pending'
    }).update({
      data: {
        status: 'rejected',
        review_remark: '班级已删除',
        review_by: OPENID,
        review_time: now,
        update_time: now
      }
    });

    await db.collection('classes').doc(classId).update({
      data: {
        status: 'deleted',
        member_count: 0,
        update_time: now,
        delete_time: now
      }
    });

    await writeOperationLog(db, {
      openid: OPENID,
      userType: 'teacher',
      action: 'delete_class',
      targetType: 'class',
      targetId: classId,
      detail: {
        class_name: classInfo.class_name,
        class_code: classInfo.class_code,
        removed_member_count: Array.from(new Set(
          legacyMembers.map((item) => item._openid).concat(memberships.map((item) => item.student_openid))
        )).length
      },
      now,
      contextLabel: 'delete-class'
    });

    return {
      success: true,
      message: '删除班级成功',
      data: {
        class_id: classId,
        member_count: Array.from(new Set(
          legacyMembers.map((item) => item._openid).concat(memberships.map((item) => item.student_openid))
        )).length
      }
    };
  } catch (error) {
    console.error('[delete-class] Error:', error);
    return {
      success: false,
      message: '删除班级失败',
      error: error.message,
      error_code: 500
    };
  }
};
