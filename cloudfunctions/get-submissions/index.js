const cloud = require('wx-server-sdk')
const { getCurrentUser, verifyTeacherRole } = require('/opt/auth')
const { getAllMembershipsByStudent, buildJoinedClassIds } = require('/opt/membership')
const { canStudentAccessTask } = require('/opt/task-access')
const { success, failure } = require('/opt/response')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const PAGE_SIZE = 100

async function getTaskById(taskId) {
  try {
    const res = await db.collection('tasks').doc(taskId).get()
    return res.data || null
  } catch (error) {
    return null
  }
}

function normalizeString(value) {
  return String(value || '').trim()
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const user = await getCurrentUser(db, OPENID)

    if (!user) {
      return failure('请先完成注册', 401)
    }

    const taskId = normalizeString(event.task_id)
    const status = normalizeString(event.status)
    const role = normalizeString(event.role || user.current_role || 'student')
    const classId = normalizeString(event.class_id)
    const page = Math.max(Number(event.page || 1), 1)
    const pageSize = Math.min(Math.max(Number(event.page_size || 20), 1), 50)
    const queryData = {}

    if (role === 'teacher') {
      const teacher = await verifyTeacherRole(db, OPENID)
      if (!teacher) {
        return failure('仅教师可以查看教师提交记录', 403)
      }

      queryData.teacher_openid = OPENID
    } else {
      queryData.student_openid = OPENID
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

      if (role === 'teacher') {
        if (taskInfo.teacher_openid !== OPENID) {
          return failure('无权查看该任务的提交记录', 403)
        }
      } else {
        const memberships = await getAllMembershipsByStudent(db, OPENID, {
          class_id: true
        }, PAGE_SIZE)
        const joinedClassIds = buildJoinedClassIds(user, memberships)

        if (!canStudentAccessTask(taskInfo, joinedClassIds) && taskInfo.teacher_openid !== OPENID) {
          return failure('无权查看该任务的提交记录', 403)
        }
      }

      queryData.task_id = taskId
    }

    if (status) {
      queryData.status = status
    }

    if (classId) {
      queryData.class_id = classId
    }

    const query = db.collection('submissions').where(queryData)
    const totalRes = await query.count()

    const countOnly = event.count_only === true || event.count_only === 'true'
    if (countOnly) {
      return success('获取提交记录成功', {
        list: [],
        page,
        page_size: pageSize,
        total: totalRes.total || 0,
        has_more: false
      })
    }

    const listRes = await query
      .orderBy('submit_time', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    return success('获取提交记录成功', {
      list: listRes.data || [],
      page,
      page_size: pageSize,
      total: totalRes.total || 0,
      has_more: page * pageSize < (totalRes.total || 0)
    })
  } catch (error) {
    console.error('[get-submissions] Error:', error)
    return failure('获取提交记录失败', 500, {
      error: error.message
    })
  }
}
