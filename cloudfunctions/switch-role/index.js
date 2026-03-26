/**
 * 切换用户角色云函数
 * 功能：切换当前用户的角色视图
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { role } = event

    // 1. 验证目标角色参数
    if (!role || !['student', 'teacher'].includes(role)) {
      return {
        success: false,
        message: '无效的目标角色',
        error_code: 400
      }
    }

    // 2. 查询用户信息
    const userRes = await db.collection('users')
      .where({ _openid: OPENID })
      .get()

    if (userRes.data.length === 0) {
      return {
        success: false,
        message: '用户不存在',
        error_code: 404
      }
    }

    const user = userRes.data[0]

    // 3. 检查用户是否拥有目标角色
    if (!user.roles || !user.roles.includes(role)) {
      return {
        success: false,
        message: `您没有${role === 'teacher' ? '教师' : '学生'}角色权限，请先申请`,
        need_apply: role === 'teacher',
        error_code: 403
      }
    }

    // 4. 检查当前角色是否已经是目标角色
    if (user.current_role === role) {
      return {
        success: true,
        message: '当前已是该角色',
        data: {
          current_role: user.current_role,
          roles: user.roles
        }
      }
    }

    // 5. 更新当前角色
    await db.collection('users')
      .where({ _openid: OPENID })
      .update({
        data: {
          current_role: role,
          update_time: new Date()
        }
      })

    return {
      success: true,
      message: '角色切换成功',
      data: {
        current_role: role,
        roles: user.roles
      }
    }

  } catch (error) {
    console.error('[switch-role] Error:', error)
    return {
      success: false,
      message: '角色切换失败',
      error: error.message
    }
  }
}