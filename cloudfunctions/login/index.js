/**
 * 用户登录云函数
 * 功能：获取用户 openid
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  // 获取用户 openid
  const openid = cloud.getWXContext().OPENID
  try {
    return {
      code: 200,
      success: true,
      message: '登录成功',
      data: {
        openid: openid
      }
    }
  } catch (e) {
    return {
      code: 500,
      success: false,
      message: '登录失败',
      error: e
    }
  }
  
}