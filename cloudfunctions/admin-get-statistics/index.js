/**
 * 后台运营统计云函数
 * 功能：聚合用户、班级、任务、提交、审核和积分等运营指标
 */

const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const app = tcb.init({
  env: process.env.TCB_ENV || process.env.SCB_ENV || process.env.CLOUDBASE_ENV || 'zhi-li-kong-ma-7gy2aqcr1add21a7'
})
const auth = app.auth()

const PAGE_SIZE = 100
const CHINA_UTC_OFFSET_HOURS = 8
const RANGE_DAYS_MAP = {
  '7d': 7,
  '14d': 14,
  '30d': 30
}

function success(message, data) {
  return {
    success: true,
    message,
    data
  }
}

function failure(message, errorCode, extra = {}) {
  return {
    success: false,
    message,
    error_code: errorCode,
    ...extra
  }
}

function normalizeRangeType(value) {
  const rangeType = String(value || '7d').trim()
  return RANGE_DAYS_MAP[rangeType] ? rangeType : '7d'
}

function getChinaNow() {
  return new Date(Date.now() + CHINA_UTC_OFFSET_HOURS * 60 * 60 * 1000)
}

function createChinaDate(year, monthIndex, day, hour = 0, minute = 0, second = 0, millisecond = 0) {
  return new Date(Date.UTC(year, monthIndex, day, hour - CHINA_UTC_OFFSET_HOURS, minute, second, millisecond))
}

function formatDateKey(date) {
  const chinaDate = new Date(date.getTime() + CHINA_UTC_OFFSET_HOURS * 60 * 60 * 1000)
  const year = chinaDate.getUTCFullYear()
  const month = String(chinaDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(chinaDate.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildDayRanges(days) {
  const now = getChinaNow()
  const year = now.getUTCFullYear()
  const monthIndex = now.getUTCMonth()
  const currentDate = now.getUTCDate()
  const ranges = []

  for (let index = days - 1; index >= 0; index -= 1) {
    const start = createChinaDate(year, monthIndex, currentDate - index, 0, 0, 0, 0)
    const end = createChinaDate(year, monthIndex, currentDate - index, 23, 59, 59, 999)
    ranges.push({
      label: formatDateKey(start),
      start,
      end
    })
  }

  return ranges
}

function buildRange(days) {
  const dayRanges = buildDayRanges(days)
  return {
    start: dayRanges[0].start,
    end: dayRanges[dayRanges.length - 1].end,
    dayRanges
  }
}

function getDateValue(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getDateKeyFromValue(value) {
  const date = getDateValue(value)
  return date ? formatDateKey(date) : ''
}

async function safeCount(collectionName, queryData = {}) {
  try {
    const query = Object.keys(queryData).length
      ? db.collection(collectionName).where(queryData)
      : db.collection(collectionName)
    const res = await query.count()
    return res.total || 0
  } catch (error) {
    console.warn(`[admin-get-statistics] count ${collectionName} failed:`, error.message)
    return 0
  }
}

async function fetchAll(collectionName, queryData = {}, fields = {}) {
  try {
    const query = Object.keys(queryData).length
      ? db.collection(collectionName).where(queryData)
      : db.collection(collectionName)
    const totalRes = await query.count()
    const total = totalRes.total || 0
    const tasks = []

    for (let skip = 0; skip < total; skip += PAGE_SIZE) {
      let pageQuery = query.skip(skip).limit(PAGE_SIZE)
      if (Object.keys(fields).length) {
        pageQuery = pageQuery.field(fields)
      }
      tasks.push(pageQuery.get())
    }

    if (!tasks.length) {
      return []
    }

    const list = await Promise.all(tasks)
    return list.reduce((result, item) => result.concat(item.data || []), [])
  } catch (error) {
    console.warn(`[admin-get-statistics] fetch ${collectionName} failed:`, error.message)
    return []
  }
}

function hasRole(user, role) {
  return Array.isArray(user.roles) && user.roles.includes(role)
}

async function getCallerUid() {
  const identity = auth.getUserInfo() || {}
  return identity.uid || identity.user_id || identity.sub || ''
}

async function verifyAdmin() {
  const uid = await getCallerUid()
  if (!uid) {
    return {
      success: false,
      message: '请先登录',
      error_code: 401
    }
  }

  const res = await db.collection('users')
    .where({
      admin_auth_uid: uid
    })
    .limit(1)
    .get()
  const user = res.data[0]

  if (!user || !hasRole(user, 'admin')) {
    return {
      success: false,
      message: '当前账号没有后台管理员权限',
      error_code: 403
    }
  }

  if (user.status === 'disabled' || user.admin_status === 'disabled') {
    return {
      success: false,
      message: '当前管理员账号已被禁用',
      error_code: 403
    }
  }

  return {
    success: true,
    user
  }
}

function sumPoints(submissions = []) {
  return submissions.reduce((sum, item) => sum + Number(item.points_earned || 0), 0)
}

function buildOverview({
  userCount,
  studentCount,
  teacherCount,
  classCount,
  taskCount,
  submissionCount,
  pendingSubmissionCount,
  approvedSubmissionCount,
  rejectedSubmissionCount,
  weeklyApprovedSubmissions
}) {
  const reviewedCount = approvedSubmissionCount + rejectedSubmissionCount
  const weeklyPoints = sumPoints(weeklyApprovedSubmissions)

  return {
    user_count: userCount,
    student_count: studentCount,
    teacher_count: teacherCount,
    class_count: classCount,
    task_count: taskCount,
    submission_count: submissionCount,
    pending_submission_count: pendingSubmissionCount,
    approved_submission_count: approvedSubmissionCount,
    rejected_submission_count: rejectedSubmissionCount,
    weekly_points: weeklyPoints,
    approval_rate: reviewedCount ? Number(((approvedSubmissionCount / reviewedCount) * 100).toFixed(1)) : 0
  }
}

function buildTrend(dayRanges, submissions = []) {
  const trendMap = dayRanges.reduce((result, item) => {
    result[item.label] = {
      date: item.label,
      submitted_count: 0,
      approved_count: 0,
      points: 0
    }
    return result
  }, {})

  submissions.forEach((item) => {
    const submitDateKey = getDateKeyFromValue(item.submit_time || item.create_time)
    if (trendMap[submitDateKey]) {
      trendMap[submitDateKey].submitted_count += 1
    }

    if (item.status === 'approved') {
      const reviewDateKey = getDateKeyFromValue(item.review_time || item.update_time)
      if (trendMap[reviewDateKey]) {
        trendMap[reviewDateKey].approved_count += 1
        trendMap[reviewDateKey].points += Number(item.points_earned || 0)
      }
    }
  })

  return dayRanges.map((item) => trendMap[item.label])
}

exports.main = async (event = {}) => {
  try {
    const adminCheck = await verifyAdmin()
    if (!adminCheck.success) {
      return adminCheck
    }

    const rangeType = normalizeRangeType(event.range_type)
    const days = RANGE_DAYS_MAP[rangeType]
    const { start, end, dayRanges } = buildRange(days)
    const rangeSubmissionQuery = {
      submit_time: _.gte(start).and(_.lte(end))
    }
    const weeklyApprovedQuery = {
      status: 'approved',
      review_time: _.gte(start).and(_.lte(end))
    }

    const [
      users,
      classCount,
      taskCount,
      submissionCount,
      pendingSubmissionCount,
      approvedSubmissionCount,
      rejectedSubmissionCount,
      weeklyApprovedSubmissions,
      rangeSubmissions
    ] = await Promise.all([
      fetchAll('users', {}, {
        roles: true,
        status: true
      }),
      safeCount('classes', { status: _.neq('deleted') }),
      safeCount('tasks', { is_deleted: _.neq(true) }),
      safeCount('submissions'),
      safeCount('submissions', { status: 'pending' }),
      safeCount('submissions', { status: 'approved' }),
      safeCount('submissions', { status: 'rejected' }),
      fetchAll('submissions', weeklyApprovedQuery, {
        points_earned: true,
        review_time: true,
        status: true
      }),
      fetchAll('submissions', rangeSubmissionQuery, {
        submit_time: true,
        create_time: true,
        update_time: true,
        review_time: true,
        status: true,
        points_earned: true
      })
    ])

    const activeUsers = users.filter((item) => item.status !== 'disabled')
    const studentCount = activeUsers.filter((item) => hasRole(item, 'student')).length
    const teacherCount = activeUsers.filter((item) => hasRole(item, 'teacher')).length
    const overview = buildOverview({
      userCount: users.length,
      studentCount,
      teacherCount,
      classCount,
      taskCount,
      submissionCount,
      pendingSubmissionCount,
      approvedSubmissionCount,
      rejectedSubmissionCount,
      weeklyApprovedSubmissions
    })

    return success('获取运营统计成功', {
      range_type: rangeType,
      range: {
        start,
        end
      },
      overview,
      trend: buildTrend(dayRanges, rangeSubmissions),
      updated_at: new Date()
    })
  } catch (error) {
    console.error('[admin-get-statistics] Error:', error)
    return failure('获取运营统计失败', 500, {
      error: error.message
    })
  }
}
