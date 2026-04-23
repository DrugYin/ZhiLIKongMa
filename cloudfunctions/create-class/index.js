const cloud = require('wx-server-sdk');
const { verifyTeacherRole } = require('../_shared/auth');
const { writeOperationLog } = require('../_shared/operation-log');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

function generateClassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function createUniqueClassCode() {
  for (let i = 0; i < 10; i += 1) {
    const classCode = generateClassCode();
    const res = await db.collection('classes').where({ class_code: classCode }).count();
    if (res.total === 0) {
      return classCode;
    }
  }
  throw new Error('班级邀请码生成失败，请重试');
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const teacher = await verifyTeacherRole(db, OPENID);

    if (!teacher) {
      return {
        success: false,
        message: '仅教师可以创建班级',
        error_code: 403
      };
    }

    const className = String(event.class_name || '').trim();
    const projectCode = String(event.project_code || '').trim();
    const projectName = String(event.project_name || '').trim();
    const classTime = String(event.class_time || '').trim();
    const location = String(event.location || '').trim();
    const description = String(event.description || '').trim();
    const maxMembers = Number(event.max_members || 50);

    if (!className) {
      return {
        success: false,
        message: '班级名称不能为空',
        error_code: 400
      };
    }

    if (!Number.isInteger(maxMembers) || maxMembers <= 0) {
      return {
        success: false,
        message: '班级人数上限不合法',
        error_code: 400
      };
    }

    const classCode = await createUniqueClassCode();
    const now = new Date();
    const classData = {
      class_name: className,
      class_code: classCode,
      teacher_openid: OPENID,
      teacher_name: teacher.user_name || teacher.nick_name || '',
      project_code: projectCode,
      project_name: projectName,
      class_time: classTime,
      location,
      description,
      max_members: maxMembers,
      member_count: 0,
      status: 'active',
      create_time: now,
      update_time: now
    };

    const result = await db.collection('classes').add({
      data: classData
    });

    await writeOperationLog(db, {
      openid: OPENID,
      userType: 'teacher',
      action: 'create_class',
      targetType: 'class',
      targetId: result._id,
      detail: {
        class_name: className,
        class_code: classCode,
        class_time: classTime,
        location,
        max_members: maxMembers
      },
      now,
      contextLabel: 'create-class'
    });

    return {
      success: true,
      message: '创建班级成功',
      data: {
        _id: result._id,
        ...classData
      }
    };
  } catch (error) {
    console.error('[create-class] Error:', error);
    return {
      success: false,
      message: '创建班级失败',
      error: error.message,
      error_code: 500
    };
  }
};
