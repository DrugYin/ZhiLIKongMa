/**
 * 用户注册云函数
 * 功能：注册新用户
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const DEFAULT_AVATAR_URL = '/assets/default-avatar.png'

function normalizeAvatarUrl(avatarUrl) {
  const value = String(avatarUrl || '').trim()
  return value || DEFAULT_AVATAR_URL
}

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const {
      user_name,
      nick_name,
      avatar_url,
      phone,
      school,
      grade,
      birthday,
      address
    } = event

    // 1. 检查用户是否已注册
    const existUser = await db.collection('users')
      .where({ _openid: OPENID })
      .get()

    if (existUser.data.length > 0) {
      return {
        success: false,
        message: '用户已注册',
        error_code: 409
      }
    }

    // 2. 验证必填参数
    if (!user_name || !phone) {
      return {
        success: false,
        message: '用户名和手机号为必填项',
        error_code: 400
      }
    }

    // 3. 获取注册赠送积分配置
    let registerPoints = 0 // 默认值
    try {
      const configRes = await db.collection('system_config')
        .where({ config_key: 'points_register_gift' })
        .get()
      if (configRes.data.length > 0) {
        registerPoints = configRes.data[0].config_value
      }
    } catch (e) {
      console.log('[register] 获取配置失败，使用默认值:', e.message)
    }

    // 4. 创建用户记录
    const now = new Date()
    const normalizedAvatarUrl = normalizeAvatarUrl(avatar_url)
    const userData = {
      _openid: OPENID,
      user_name: user_name,
      nick_name: nick_name || '',
      avatar_url: normalizedAvatarUrl,
      phone: phone,
      school: school || '',
      grade: grade || '',
      birthday: birthday || '',
      address: address || '',
      
      // 角色与权限
      roles: ['student'],
      current_role: 'student',
      
      // 教师信息（初始为空）
      teacher_project: '编程',
      teacher_project_code: 'programming',
      
      // 积分信息
      points: registerPoints,
      total_points: registerPoints,
      
      // 状态信息
      status: 'active',
      is_registered: true,
      
      // 时间戳
      create_time: now,
      update_time: now
    }

    const result = await db.collection('users').add({
      data: userData
    })

    // 5. 记录操作日志
    try {
      await db.collection('operation_logs').add({
        data: {
          user_openid: OPENID,
          user_type: 'student',
          action: 'register',
          target_type: 'user',
          target_id: result._id,
          detail: {
            user_name: user_name,
            points: registerPoints
          },
          create_time: now
        }
      })
    } catch (logError) {
      console.error('[register] 记录日志失败:', logError)
    }

    return {
      success: true,
      message: '注册成功',
      data: {
        _id: result._id,
        user_name: user_name,
        avatar_url: normalizedAvatarUrl,
        roles: ['student'],
        current_role: 'student',
        points: registerPoints
      }
    }

  } catch (error) {
    console.error('[register] Error:', error)
    return {
      success: false,
      message: '注册失败',
      error: error.message,
      error_code: 500
    }
  }
}
