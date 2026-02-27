// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const { openid } = event
  if (!openid) {
    return {
      code: 400,
      success: false,
      msg: '参数错误'
    }
  }
  try {
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

    const student = res.data[0]
    return {
      code: 200,
      success: true,
      data: {
        openid: student.openid,
        avatarUrl: student.avatarUrl,
        address: student.address,
        grade: student.grade,
        school: student.school,
        userName: student.userName,
        points: student.points,
        phone: student.phone
      },
      msg: '获取成功'
    }

  } catch (e) {
    return {
      code: 500,
      success: false,
      msg: '登录失败'
    }
  }
}