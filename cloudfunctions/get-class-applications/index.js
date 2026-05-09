const cloud = require('wx-server-sdk');
const { getCurrentUser } = require('/opt/auth');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

function normalizeStatus(value) {
  const status = String(value || '').trim();
  return ['pending', 'approved', 'rejected'].includes(status) ? status : '';
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const classId = String(event.class_id || '').trim();
    const statusFilter = String(event.status || 'pending').trim();
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
    if (!currentUser || !Array.isArray(currentUser.roles) || !currentUser.roles.includes('teacher')) {
      return {
        success: false,
        message: '仅教师可以查看入班申请',
        error_code: 403
      };
    }

    const classRes = await db.collection('classes').doc(classId).get();
    const classInfo = classRes.data || null;
    if (!classInfo || classInfo.status === 'deleted') {
      return {
        success: false,
        message: '班级不存在',
        error_code: 404
      };
    }

    if (classInfo.teacher_openid !== OPENID) {
      return {
        success: false,
        message: '无权查看该班级申请',
        error_code: 403
      };
    }

    const normalizedStatus = normalizeStatus(statusFilter);
    const queryCondition = {
      class_id: classId
    };

    if (statusFilter !== 'all') {
      queryCondition.status = normalizedStatus || 'pending';
    }

    const query = db.collection('class_join_applications').where(queryCondition);

    const totalRes = await query.count();

    const countOnly = event.count_only === true || event.count_only === 'true';
    if (countOnly) {
      return {
        success: true,
        message: '获取入班申请成功',
        data: {
          list: [],
          page,
          page_size: pageSize,
          total: totalRes.total,
          has_more: false
        }
      };
    }

    const listRes = await query
      .orderBy('create_time', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .field({
        _id: true,
        class_id: true,
        class_code: true,
        class_name: true,
        student_openid: true,
        student_name: true,
        apply_reason: true,
        status: true,
        review_remark: true,
        review_by: true,
        review_time: true,
        create_time: true,
        update_time: true
      })
      .get();

    const openids = Array.from(new Set(
      listRes.data
        .map((item) => item.student_openid)
        .filter(Boolean)
    ));

    let studentMap = {};

    if (openids.length) {
      const studentRes = await db.collection('users').where({
        _openid: _.in(openids)
      }).field({
        _openid: true,
        user_name: true,
        nick_name: true,
        avatar_url: true,
        grade: true,
        phone: true
      }).get();

      studentMap = studentRes.data.reduce((result, item) => {
        result[item._openid] = item;
        return result;
      }, {});
    }

    const list = listRes.data.map((item) => {
      const student = studentMap[item.student_openid] || {};

      return {
        ...item,
        student_name: item.student_name || student.user_name || student.nick_name || '',
        student_user_name: student.user_name || '',
        student_nick_name: student.nick_name || '',
        student_avatar: student.avatar_url || '',
        student_grade: student.grade || '',
        student_phone: student.phone || ''
      };
    });

    return {
      success: true,
      message: '获取入班申请成功',
      data: {
        list,
        page,
        page_size: pageSize,
        total: totalRes.total,
        has_more: page * pageSize < totalRes.total
      }
    };
  } catch (error) {
    console.error('[get-class-applications] Error:', error);
    return {
      success: false,
      message: '获取入班申请失败',
      error: error.message,
      error_code: 500
    };
  }
};
