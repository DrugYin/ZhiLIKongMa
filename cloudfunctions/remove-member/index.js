const cloud = require('wx-server-sdk');
const { getCurrentUser } = require('/opt/auth');
const { writeOperationLog } = require('/opt/operation-log');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

async function getMembership(classId, openid) {
  const res = await db.collection('class_memberships').where({
    class_id: classId,
    student_openid: openid
  }).limit(1).get();
  return res.data[0] || null;
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const classId = String(event.class_id || '').trim();
    const memberOpenid = String(event.member_openid || '').trim();

    if (!classId || !memberOpenid) {
      return {
        success: false,
        message: '参数不完整',
        error_code: 400
      };
    }

    const teacher = await getCurrentUser(db, OPENID);
    if (!teacher || !Array.isArray(teacher.roles) || !teacher.roles.includes('teacher')) {
      return {
        success: false,
        message: '仅教师可以移除成员',
        error_code: 403
      };
    }

    const classRes = await db.collection('classes').doc(classId).get();
    const classInfo = classRes.data || null;
    if (!classInfo) {
      return {
        success: false,
        message: '班级不存在',
        error_code: 404
      };
    }

    if (classInfo.teacher_openid !== OPENID) {
      return {
        success: false,
        message: '无权管理该班级成员',
        error_code: 403
      };
    }

    const memberRes = await db.collection('users').where({
      _openid: memberOpenid
    }).limit(1).get();
    const member = memberRes.data[0];
    const membership = await getMembership(classId, memberOpenid);
    const isLegacyMember = Boolean(member && member.class_id === classId);

    if (!membership && !isLegacyMember) {
      return {
        success: false,
        message: '成员不存在或不在该班级中',
        error_code: 404
      };
    }

    const now = new Date();
    const tasks = [];

    if (membership) {
      tasks.push(db.collection('class_memberships').doc(membership._id).remove());
    }

    if (isLegacyMember) {
      tasks.push(
        db.collection('users').doc(member._id).update({
          data: {
            class_id: _.remove(),
            class_name: _.remove(),
            class_code: _.remove(),
            join_class_time: _.remove(),
            update_time: now
          }
        })
      );
    } else if (member && member._id) {
      tasks.push(
        db.collection('users').doc(member._id).update({
          data: {
            update_time: now
          }
        })
      );
    }

    await Promise.all(tasks);

    await db.collection('classes').doc(classId).update({
      data: {
        member_count: _.inc(-1),
        update_time: now
      }
    });

    await writeOperationLog(db, {
      openid: OPENID,
      userType: 'teacher',
      action: 'remove_class_member',
      targetType: 'class',
      targetId: classId,
      detail: {
        member_openid: memberOpenid,
        member_name: member ? (member.user_name || member.nick_name || '') : ''
      },
      now,
      contextLabel: 'remove-member'
    });

    return {
      success: true,
      message: '移除成员成功',
      data: {
        class_id: classId,
        member_openid: memberOpenid
      }
    };
  } catch (error) {
    console.error('[remove-member] Error:', error);
    return {
      success: false,
      message: '移除成员失败',
      error: error.message,
      error_code: 500
    };
  }
};
