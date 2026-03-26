/**
 * 更新用户信息云函数
 * 功能：更新用户个人信息
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
    const {
      user_name,
      phone,
      school,
      grade,
      birthday,
      address,
      avatar_url
    } = event

    // 1. 检查用户是否存在
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

    // 2. 构建更新数据（只更新提供的字段）
    const updateData = {
      update_time: new Date()
    }

    if (user_name !== undefined) {
      if (user_name.length < 2 || user_name.length > 20) {
        return {
          success: false,
          message: '用户名长度应为2-20个字符',
          error_code: 400
        }
      }
      updateData.user_name = user_name
    }

    if (phone !== undefined) {
      const phoneRegex = /^1[3-9]\d{9}$/
      if (!phoneRegex.test(phone)) {
        return {
          success: false,
          message: '手机号格式不正确',
          error_code: 400
        }
      }
      updateData.phone = phone
    }

    if (school !== undefined) {
      updateData.school = school
    }

    if (grade !== undefined) {
      updateData.grade = grade
    }

    if (birthday !== undefined) {
      updateData.birthday = birthday
    }

    if (address !== undefined) {
      updateData.address = address
    }

    if (avatar_url !== undefined) {
      updateData.avatar_url = avatar_url
    }

    // 3. 更新用户信息
    await db.collection('users')
      .where({ _openid: OPENID })
      .update({
        data: updateData
      })

    return {
      success: true,
      message: '更新成功'
    }

  } catch (error) {
    console.error('[update-user] Error:', error)
    return {
      success: false,
      message: '更新用户信息失败',
      error: error.message
    }
  }
}