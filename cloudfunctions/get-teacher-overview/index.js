const cloud = require('wx-server-sdk')
const { verifyTeacherRole } = require('/opt/auth')
const { chunkList } = require('/opt/membership')
const { success, failure } = require('/opt/response')
const {
  buildOverview,
  buildRecentActivities,
  getWeekRange,
  sanitizeUser
} = require('./helpers')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const PAGE_SIZE = 100
const QUERY_BATCH_SIZE = 20

const CLASS_FIELDS = {
  _id: true,
  class_name: true,
  member_count: true,
  update_time: true,
  create_time: true
}

async function getTeacherClasses(openid) {
  const queryData = {
    teacher_openid: openid,
    status: _.neq('deleted')
  }
  const totalRes = await db.collection('classes').where(queryData).count()
  const total = Number(totalRes.total || 0)
  const requests = []

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    requests.push(
      db.collection('classes')
        .where(queryData)
        .orderBy('update_time', 'desc')
        .skip(skip)
        .limit(PAGE_SIZE)
        .field(CLASS_FIELDS)
        .get()
    )
  }

  if (!requests.length) {
    return []
  }

  const pages = await Promise.all(requests)
  return pages.reduce((result, item) => result.concat(item.data || []), [])
}

async function getApplicationStats(classIds) {
  const requests = chunkList(classIds, QUERY_BATCH_SIZE).map(async (batchIds) => {
    const queryData = {
      class_id: _.in(batchIds),
      status: 'pending'
    }
    const [countRes, latestRes] = await Promise.all([
      db.collection('class_join_applications').where(queryData).count(),
      db.collection('class_join_applications')
        .where(queryData)
        .orderBy('create_time', 'desc')
        .limit(1)
        .field({
          _id: true,
          class_id: true,
          class_name: true,
          student_name: true,
          create_time: true,
          update_time: true
        })
        .get()
    ])

    return {
      count: Number(countRes.total || 0),
      latest: latestRes.data && latestRes.data[0] || null
    }
  })

  if (!requests.length) {
    return { count: 0, latest: null }
  }

  const batchResults = await Promise.all(requests)
  return batchResults.reduce((result, item) => {
    result.count += item.count
    const currentTime = new Date(result.latest && (result.latest.create_time || result.latest.update_time) || 0).getTime()
    const nextTime = new Date(item.latest && (item.latest.create_time || item.latest.update_time) || 0).getTime()
    if (item.latest && nextTime > currentTime) {
      result.latest = item.latest
    }
    return result
  }, { count: 0, latest: null })
}

async function getWeeklySubmittedStudentCount(openid, range) {
  const res = await db.collection('submissions')
    .aggregate()
    .match({
      teacher_openid: openid,
      student_openid: _.neq(''),
      submit_time: _.gte(range.start).and(_.lt(range.end))
    })
    .group({ _id: '$student_openid' })
    .count('total')
    .end()
  return Number(res.list && res.list[0] && res.list[0].total || 0)
}

async function getLatestPendingSubmission(openid) {
  const res = await db.collection('submissions').where({
    teacher_openid: openid,
    status: 'pending'
  })
    .orderBy('submit_time', 'desc')
    .limit(1)
    .field({
      _id: true,
      task_id: true,
      task_title: true,
      student_name: true,
      submit_time: true
    })
    .get()
  return res.data && res.data[0] || null
}

async function getLatestTask(openid) {
  const res = await db.collection('tasks').where({
    teacher_openid: openid,
    is_deleted: _.neq(true)
  })
    .orderBy('update_time', 'desc')
    .limit(1)
    .field({
      _id: true,
      title: true,
      update_time: true,
      create_time: true
    })
    .get()
  return res.data && res.data[0] || null
}

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) {
      return failure('无法获取用户身份', 401)
    }
    const teacher = await verifyTeacherRole(db, OPENID)

    if (!teacher) {
      return failure('仅教师可以查看教师首页', 403)
    }

    const classes = await getTeacherClasses(OPENID)
    const classIds = classes.map((item) => item._id).filter(Boolean)
    const range = getWeekRange()
    const [
      taskCountRes,
      pendingSubmissionCountRes,
      applicationStats,
      submittedStudentCount,
      latestSubmission,
      latestTask
    ] = await Promise.all([
      db.collection('tasks').where({
        teacher_openid: OPENID,
        is_deleted: _.neq(true)
      }).count(),
      db.collection('submissions').where({
        teacher_openid: OPENID,
        status: 'pending'
      }).count(),
      getApplicationStats(classIds),
      getWeeklySubmittedStudentCount(OPENID, range),
      getLatestPendingSubmission(OPENID),
      getLatestTask(OPENID)
    ])

    const overview = buildOverview(
      classes,
      taskCountRes.total,
      pendingSubmissionCountRes.total,
      applicationStats.count
    )
    const completionRate = overview.student_count > 0
      ? Math.min(100, Math.round((submittedStudentCount / overview.student_count) * 100))
      : 0

    return success('获取教师首页数据成功', {
      user_info: sanitizeUser(teacher),
      overview: {
        class_count: overview.class_count,
        task_count: overview.task_count,
        student_count: overview.student_count,
        pending_submission_count: overview.pending_submission_count,
        pending_application_count: overview.pending_application_count
      },
      weekly_stats: {
        submitted_student_count: submittedStudentCount,
        completion_rate: completionRate
      },
      recent_activities: buildRecentActivities({
        latestSubmission,
        latestApplication: applicationStats.latest,
        latestTask,
        latestClass: classes[0] || null
      })
    })
  } catch (error) {
    console.error('[get-teacher-overview] Error:', error)
    return failure('获取教师首页数据失败', 500, {
      error: error.message
    })
  }
}
