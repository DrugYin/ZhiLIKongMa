// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const { _id } = event
  if (!_id) {
    return {
      code: 400,
      success: false,
      msg: '参数错误'
    }
  }
  try {
    const res = await cloud.database().collection('teachers').where({
      _id: _id
    }).get()

    if (!res || res.data.length <= 0) {
      return {
        code: 401,
        success: false,
        msg: '教师不存在'
      }
    }

    const teacher = res.data[0]
    return {
      code: 200,
      success: true,
      data: teacher,
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