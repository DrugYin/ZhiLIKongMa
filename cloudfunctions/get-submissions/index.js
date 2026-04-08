const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const PAGE_SIZE = 100

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get()
  return res.data[0] || null
}

async function getTaskById(taskId) {
  try {
    const res = await db.collection('tasks').doc(taskId).get()
    return res.data || null
  } catch (error) {
    return null
  }
}

async function getAllMembershipsByStudent(openid) {
  const totalRes = await db.collection('class_memberships').where({
    student_openid: openid
  }).count()
  const total = totalRes.total || 0
  const requests = []

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    requests.push(
      db.collection('class_memberships').where({
        student_openid: openid
      }).skip(skip).limit(PAGE_SIZE).field({
        class_id: true
      }).get()
    )
  }

  if (!requests.length) {
    return []
  }

  const list = await Promise.all(requests)
  return list.reduce((result, item) => result.concat(item.data || []), [])
}

function normalizeString(value) {
  return String(value || '').trim()
}

function canStudentAccessTask(task, joinedClassIds) {
  if (!task || task.is_deleted || task.status !== 'published') {
    return false
  }

  if (task.task_type === 'public') {
    return true
  }

  if (task.task_type === 'class' && task.visibility === 'public') {
    return true
  }

  return task.task_type === 'class'
    && task.visibility === 'class_only'
    && joinedClassIds.includes(task.class_id)
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const user = await getCurrentUser(OPENID)

    if (!user) {
      return {
        success: false,
        message: '请先完成注册',
        error_code: 401
      }
    }

    const taskId = normalizeString(event.task_id)
    const status = normalizeString(event.status)
    const page = Math.max(Number(event.page || 1), 1)
    const pageSize = Math.min(Math.max(Number(event.page_size || 20), 1), 50)
    const queryData = {
      student_openid: OPENID
    }

    if (taskId) {
      const taskInfo = await getTaskById(taskId)

      if (!taskInfo || taskInfo.is_deleted) {
        return {
          success: false,
          message: '任务不存在',
          error_code: 404
        }
      }

      const memberships = await getAllMembershipsByStudent(OPENID)
      const joinedClassIds = memberships.map((item) => item.class_id).filter(Boolean)

      if (user.class_id && !joinedClassIds.includes(user.class_id)) {
        joinedClassIds.push(user.class_id)
      }

      if (!canStudentAccessTask(taskInfo, joinedClassIds) && taskInfo.teacher_openid !== OPENID) {
        return {
          success: false,
          message: '无权查看该任务的提交记录',
          error_code: 403
        }
      }

      queryData.task_id = taskId
    }

    if (status) {
      queryData.status = status
    }

    const query = db.collection('submissions').where(queryData)
    const totalRes = await query.count()
    const listRes = await query
      .orderBy('submit_time', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    return {
      success: true,
      message: '获取提交记录成功',
      data: {
        list: listRes.data || [],
        page,
        page_size: pageSize,
        total: totalRes.total || 0,
        has_more: page * pageSize < (totalRes.total || 0)
      }
    }
  } catch (error) {
    console.error('[get-submissions] Error:', error)
    return {
      success: false,
      message: '获取提交记录失败',
      error: error.message,
      error_code: 500
    }
  }
}
