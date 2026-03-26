/**
 * 获取用户角色列表云函数
 * 功能：获取当前用户拥有的所有角色
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
      .field({
        roles: true,
        current_role: true
      })
      .get()

    if (userRes.data.length === 0) {
      return {
        success: false,
        message: '用户不存在',
        error_code: 404
      }
    }

    const user = userRes.data[0]

    return {
      success: true,
      data: {
        roles: user.roles || ['student'],
        current_role: user.current_role || 'student'
      }
    }

  } catch (error) {
    console.error('[get-user-roles] Error:', error)
    return {
      success: false,
      message: '获取用户角色失败',
      error: error.message
    }
  }
}