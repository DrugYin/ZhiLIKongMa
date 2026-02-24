// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const { openid, account, password } = event
  if (!openid || !account || !password) {
    return {
      code: 400,
      success: false,
      msg: '参数错误'
    }
  }
  try {
    const res = await cloud.database().collection('teachers').where({
      account: account
    }).get()
    if (!res || res.data.length <= 0) {
      return {
        code: 400,
        success: false,
        msg: '教师不存在'
      }
    }
    const teacher = res.data[0]
    if (teacher.password !== password) {
      return {
        code: 400,
        success: false,
        msg: '密码错误'
      }
    }
    const needImprove = !teacher.userName || !teacher.projectId
    return {
      code: 200,
      success: true,
      data: {
        avatarUrl: teacher.avatarUrl || '/assets/default-avatar.png',
        userName: teacher.userName || '',
        projectId: teacher.projectId || '',
        _id: teacher._id,
        openid: teacher.openid || '',
        phone: teacher.phone || '',
        needImprove: needImprove
      },
      msg: '登录成功'
    }
  } catch (e) {
    return {
      code: 500,
      success: false,
      msg: '登录失败'
    }
  }
}