const cloud = require('wx-server-sdk')
const { getCurrentUser } = require('/opt/auth')
const { buildJoinedClassIds, chunkList } = require('/opt/membership')
const { success, failure } = require('/opt/response')
const {
  buildWeeklyRank,
  buildWeeklyTask,
  getWeekRange,
  sanitizeUser
} = require('./helpers')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const QUERY_BATCH_SIZE = 20
const QUERY_LIMIT = 100

const TASK_OVERVIEW_FIELDS = {
  _id: true,
  title: true,
  description: true,
  project_code: true,
  project_name: true,
  class_id: true,
  class_name: true,
  task_type: true,
  visibility: true,
  deadline: true,
  publish_time: true,
  create_time: true,
  update_time: true
}

async function getMemberships(openid) {
  const res = await db.collection('class_memberships')
    .where({ student_openid: openid })
    .field({ class_id: true })
    .limit(QUERY_LIMIT)
    .get()
  return res.data || []
}

async function getPendingApplicationCount(openid) {
  const res = await db.collection('class_join_applications').where({
    student_openid: openid,
    status: 'pending'
  }).count()
  return Number(res.total || 0)
}

async function getWeeklyRankingSnapshot() {
  try {
    const res = await db.collection('ranking_snapshots').doc('week').get()
    return res.data || {}
  } catch (error) {
    return {}
  }
}

async function getWeeklyTasks(classIds, range) {
  const queries = chunkList(classIds, QUERY_BATCH_SIZE).map((batchIds) => (
    db.collection('tasks').where({
      class_id: _.in(batchIds),
      status: 'published',
      task_type: 'class',
      is_deleted: _.neq(true),
      publish_time: _.gte(range.start).and(_.lt(range.end))
    })
      .orderBy('publish_time', 'desc')
      .limit(QUERY_LIMIT)
      .field(TASK_OVERVIEW_FIELDS)
      .get()
  ))

  if (!queries.length) {
    return []
  }

  const pages = await Promise.all(queries)
  return pages.reduce((result, item) => result.concat(item.data || []), [])
}

async function getStudentSubmissions(openid, taskIds) {
  const queries = chunkList(taskIds, QUERY_BATCH_SIZE).map((batchIds) => (
    db.collection('submissions').where({
      student_openid: openid,
      task_id: _.in(batchIds)
    })
      .limit(QUERY_LIMIT)
      .field({ task_id: true })
      .get()
  ))

  if (!queries.length) {
    return []
  }

  const pages = await Promise.all(queries)
  return pages.reduce((result, item) => result.concat(item.data || []), [])
}

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) {
      return failure('无法获取用户身份', 401)
    }
    const user = await getCurrentUser(db, OPENID)

    if (!user) {
      return failure('请先完成注册', 401)
    }

    const [memberships, pendingCount, rankingSnapshot] = await Promise.all([
      getMemberships(OPENID),
      getPendingApplicationCount(OPENID),
      getWeeklyRankingSnapshot()
    ])
    const classIds = buildJoinedClassIds(user, memberships)
    const weeklyTasks = await getWeeklyTasks(classIds, getWeekRange())
    const submissions = await getStudentSubmissions(
      OPENID,
      weeklyTasks.map((item) => item._id).filter(Boolean)
    )
    const weeklyTask = buildWeeklyTask(weeklyTasks, submissions)

    return success('获取学生首页数据成功', {
      user_info: sanitizeUser(user),
      class_summary: {
        joined_count: classIds.length,
        pending_count: pendingCount
      },
      weekly_rank: buildWeeklyRank(rankingSnapshot, OPENID),
      weekly_task: {
        total: weeklyTask.total,
        submitted: weeklyTask.submitted,
        latest_pending_task: weeklyTask.latest_pending_task
      }
    })
  } catch (error) {
    console.error('[get-student-overview] Error:', error)
    return failure('获取学生首页数据失败', 500, {
      error: error.message
    })
  }
}
