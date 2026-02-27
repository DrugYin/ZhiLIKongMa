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
    
    if (!res || res.data.length <= 0) {
      return {
        code: 401,
        success: false,
        msg: '学生不存在'
      }
    }
    const student = res.data[0]
    await cloud.database().collection('students').doc(student._id).update({
      data: {
        ...userInfo
      }
    })
    const result = await cloud.database().collection('students').doc(student._id).get()
    return {
      code: 200,
      success: true,
      data: result.data,
      msg: '更新成功'
    }
    
  } catch (e) {
    return {
      code: 500,
      success: false,
      msg: '更新失败' + e
    }
  }
}