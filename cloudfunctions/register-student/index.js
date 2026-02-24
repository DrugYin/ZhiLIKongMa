// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const { openid, userInfo } = event
  if (!openid || !userInfo) {
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
    
    if (res && res.data.length > 0) {
      return {
        code: 400,
        success: false,
        msg: '学生已存在'
      }
    }

    await cloud.database().collection('students').add({
      data: {
        ...userInfo,
        openid: openid
      }
    })

    const studentRes = await cloud.database().collection('students').where({
      openid: openid
    }).get()

    return {
      code: 200,
      success: true,
      data: studentRes.data[0],
      msg: '注册成功'
    }

  } catch (e) {
    return {
      code: 500,
      success: false,
      msg: '登录失败'
    }
  }
}