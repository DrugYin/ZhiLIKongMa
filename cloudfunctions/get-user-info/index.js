/**
 * 获取用户信息云函数
 * 功能：获取当前登录用户信息
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()

    // 查询用户信息
    const userRes = await db.collection('users')
      .where({ _openid: OPENID })
      .get()

    if (userRes.data.length === 0) {
      return {
        success: true,
        is_registered: false,
        data: null
      }
    }

    const user = userRes.data[0]

    // 返回用户信息（不包含敏感字段）
    return {
      success: true,
      is_registered: true,
      data: {
        _id: user._id,
        user_name: user.user_name,
        avatar_url: user.avatar_url,
        phone: user.phone,
        school: user.school,
        grade: user.grade,
        birthday: user.birthday,
        address: user.address,
        roles: user.roles,
        current_role: user.current_role,
        points: user.points,
        total_points: user.total_points,
        status: user.status,
        teacher_subject: user.teacher_subject,
        teacher_project: user.teacher_project,
        create_time: user.create_time,
        update_time: user.update_time
      }
    }

  } catch (error) {
    console.error('[get-user-info] Error:', error)
    return {
      success: false,
      message: '获取用户信息失败',
      error: error.message
    }
  }
}