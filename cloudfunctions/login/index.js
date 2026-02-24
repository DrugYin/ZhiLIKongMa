// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const { openid, role } = event
  if (!openid || !role) {
    return {
      code: 400,
      success: false,
      msg: '参数错误'
    }
  }
  try {
    if (role === 'student') {
      const res = await cloud.database().collection('students').where({
        openid: openid
      }).get()
      if (!res || res.data.length <= 0) {
        return {
          code: 401,
          success: false,
          msg: '学生不存在'
        }
      }
      return {
        code: 200,
        success: true,
        data: res.data[0],
        msg: '登录成功'
      }
    } else {
      const res = await cloud.database().collection('teachers').where({
        openid: openid
      }).get()
      if (!res || res.data.length <= 0) {
        return {
          code: 401,
          success: false,
          msg: '教师不存在'
        }
      }
      return {
        code: 200,
        success: true,
        data: res.data[0],
        msg: '登录成功'
      }
    }
  } catch (e) {
    return {
      code: 500,
      success: false,
      msg: '登录失败' + e
    }
  }
}