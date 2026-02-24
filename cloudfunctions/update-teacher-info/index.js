// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const { openid, teacherInfo } = event
  if (!openid || !teacherInfo) {
    return {
      code: 400,
      success: false,
      msg: '参数错误'
    }
  }
  try {
    const res = await cloud.database().collection('teachers').where({
      _id: teacherInfo._id
    }).get()
    
    if (!res || res.data.length <= 0) {
      return {
        code: 401,
        success: false,
        msg: '教师不存在'
      }
    }
    let teacher = res.data[0]
    await cloud.database().collection('teachers').doc(teacher._id).update({
      data: {
        name: teacherInfo.name,
        phone: teacherInfo.phone,
        projectId: teacherInfo.projectId,
        project: teacherInfo.project,
        openid: openid
      }
    })

    teacher = await cloud.database().collection('teachers').doc(teacher._id).get()

    return {
      code: 200,
      success: true,
      data: teacher.data[0],
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