/**
 * 后台提交记录管理云函数
 * 功能：全局查询 submissions 集合，并提供管理员审核与积分回滚能力
 */

const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')
const { writeAdminOperationLog } = require('/opt/admin-operation-log')
const { addPointsLog, POINTS_SOURCE, POINTS_TYPE } = require('/opt/points-log')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const app = tcb.init({
  env: process.env.TCB_ENV || process.env.SCB_ENV || process.env.CLOUDBASE_ENV || 'zhi-li-kong-ma-7gy2aqcr1add21a7'
})
const auth = app.auth()

const SUBMISSION_COLLECTION = 'submissions'
const USER_COLLECTION = 'users'
const TASK_COLLECTION = 'tasks'
const PAGE_SIZE = 100
const VALID_STATUSES = ['pending', 'approved', 'rejected']

function success(message, data = {}) {
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
    return failure('请先登录', 401)
  }

  const res = await db.collection(USER_COLLECTION)
    .where({
      admin_auth_uid: uid
    })
    .limit(1)
    .get()
  const user = res.data[0]

  if (!user || !hasRole(user, 'admin')) {
    return failure('当前账号没有后台管理员权限', 403)
  }

  if (user.status === 'disabled' || user.admin_status === 'disabled') {
    return failure('当前管理员账号已被禁用', 403)
  }

  return {
    success: true,
    uid,
    user
  }
}

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizePage(value) {
  const page = Number(value || 1)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function normalizePageSize(value) {
  const pageSize = Number(value || 20)
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    return 20
  }

  return Math.min(pageSize, 100)
}

function normalizeStatus(value) {
  const status = normalizeString(value)
  return VALID_STATUSES.includes(status) ? status : ''
}

function normalizeScore(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const score = Number(value)
  return Number.isNaN(score) || score < 0 ? null : score
}

function normalizePoints(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const points = Number(value)
  return Number.isInteger(points) && points >= 0 ? points : null
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map(normalizeString).filter(Boolean)
}

function normalizeFiles(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.reduce((result, item) => {
    if (!item || typeof item !== 'object') {
      return result
    }

    const fileId = normalizeString(item.file_id)
    if (!fileId) {
      return result
    }

    result.push({
      file_id: fileId,
      file_name: normalizeString(item.file_name) || fileId,
      file_size: Math.max(Number(item.file_size || 0), 0)
    })
    return result
  }, [])
}

async function fetchAll(collectionName, queryData = {}) {
  const query = Object.keys(queryData).length
    ? db.collection(collectionName).where(queryData)
    : db.collection(collectionName)
  const totalRes = await query.count()
  const total = totalRes.total || 0
  const tasks = []

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      query
        .skip(skip)
        .limit(PAGE_SIZE)
        .get()
    )
  }

  if (!tasks.length) {
    return []
  }

  const pages = await Promise.all(tasks)
  return pages.reduce((result, item) => result.concat(item.data || []), [])
}

async function getSubmissionById(submissionId) {
  if (!submissionId) {
    return null
  }

  try {
    const res = await db.collection(SUBMISSION_COLLECTION).doc(submissionId).get()
    return res.data || null
  } catch (error) {
    return null
  }
}

async function getTaskById(taskId) {
  if (!taskId) {
    return null
  }

  try {
    const res = await db.collection(TASK_COLLECTION).doc(taskId).get()
    return res.data || null
  } catch (error) {
    return null
  }
}

function normalizeSubmissionDoc(doc = {}) {
  return {
    ...doc,
    task_id: doc.task_id || '',
    task_title: doc.task_title || '',
    project_code: doc.project_code || '',
    project_name: doc.project_name || '',
    student_openid: doc.student_openid || '',
    student_name: doc.student_name || '',
    class_id: doc.class_id || '',
    class_name: doc.class_name || '',
    teacher_openid: doc.teacher_openid || '',
    teacher_name: doc.teacher_name || '',
    description: doc.description || '',
    images: Array.isArray(doc.images) ? doc.images : [],
    files: normalizeFiles(doc.files),
    status: normalizeStatus(doc.status) || 'pending',
    score: doc.score === undefined ? null : doc.score,
    feedback: doc.feedback || '',
    feedback_images: Array.isArray(doc.feedback_images) ? doc.feedback_images : [],
    feedback_files: normalizeFiles(doc.feedback_files),
    is_overtime: Boolean(doc.is_overtime),
    points_earned: Number(doc.points_earned || 0),
    submit_no: Number(doc.submit_no || 1),
    submit_time: doc.submit_time || doc.create_time || null,
    review_time: doc.review_time || null,
    update_time: doc.update_time || doc.create_time || null
  }
}

function matchKeyword(item, keyword) {
  if (!keyword) {
    return true
  }

  const normalizedKeyword = keyword.toLowerCase()
  const searchText = [
    item.task_title,
    item.project_name,
    item.project_code,
    item.student_name,
    item.student_openid,
    item.class_name,
    item.teacher_name,
    item.description,
    item.feedback
  ].join(' ').toLowerCase()

  return searchText.includes(normalizedKeyword)
}

function compareBySubmitTime(left, right) {
  const leftTime = new Date(left.submit_time || left.create_time || 0).getTime()
  const rightTime = new Date(right.submit_time || right.create_time || 0).getTime()
  if (leftTime !== rightTime) {
    return rightTime - leftTime
  }

  return String(left._id || '').localeCompare(String(right._id || ''))
}

function buildQueryData(event = {}) {
  const queryData = {}
  const status = normalizeStatus(event.status)
  const taskId = normalizeString(event.task_id)
  const projectCode = normalizeString(event.project_code)
  const classId = normalizeString(event.class_id)
  const teacherOpenid = normalizeString(event.teacher_openid)
  const studentOpenid = normalizeString(event.student_openid)

  if (status) {
    queryData.status = status
  }

  if (taskId) {
    queryData.task_id = taskId
  }

  if (projectCode) {
    queryData.project_code = projectCode
  }

  if (classId) {
    queryData.class_id = classId
  }

  if (teacherOpenid) {
    queryData.teacher_openid = teacherOpenid
  }

  if (studentOpenid) {
    queryData.student_openid = studentOpenid
  }

  return queryData
}

async function listSubmissions(event = {}) {
  const keyword = normalizeString(event.keyword)
  const overtime = normalizeString(event.overtime)
  const page = normalizePage(event.page)
  const pageSize = normalizePageSize(event.page_size || event.pageSize)
  const allSubmissions = await fetchAll(SUBMISSION_COLLECTION, buildQueryData(event))

  const filtered = allSubmissions
    .map(normalizeSubmissionDoc)
    .filter((item) => overtime === 'yes' ? item.is_overtime : true)
    .filter((item) => overtime === 'no' ? !item.is_overtime : true)
    .filter((item) => matchKeyword(item, keyword))
    .sort(compareBySubmitTime)

  const start = (page - 1) * pageSize
  const list = filtered.slice(start, start + pageSize)

  return success('获取提交记录成功', {
    list,
    total: filtered.length,
    page,
    page_size: pageSize,
    summary: {
      pending: filtered.filter((item) => item.status === 'pending').length,
      approved: filtered.filter((item) => item.status === 'approved').length,
      rejected: filtered.filter((item) => item.status === 'rejected').length,
      overtime: filtered.filter((item) => item.is_overtime).length
    }
  })
}

async function getSubmission(event = {}) {
  const submissionId = normalizeString(event.submission_id || event._id || event.id)
  const submission = await getSubmissionById(submissionId)

  if (!submission) {
    return failure('提交记录不存在', 404)
  }

  return success('获取提交详情成功', {
    submission: normalizeSubmissionDoc(submission)
  })
}

async function adjustStudentPoints(openid, delta, now) {
  if (!openid || !delta) {
    return
  }

  await db.collection(USER_COLLECTION).where({
    _openid: openid
  }).update({
    data: {
      points: _.inc(delta),
      total_points: _.inc(delta),
      update_time: now
    }
  })
}

function getCreditedPoints(submission = {}) {
  return submission.status === 'approved'
    ? Number(submission.points_earned || 0)
    : 0
}

async function writeOperationLog(action, submission, admin, beforeSubmission = null) {
  await writeAdminOperationLog(db, {
    module: 'submissions',
    action,
    targetId: submission._id,
    targetKey: submission.task_title || submission._id,
    admin,
    detail: {
      task_id: submission.task_id,
      task_title: submission.task_title || '',
      student_openid: submission.student_openid,
      student_name: submission.student_name || '',
      before_status: beforeSubmission ? beforeSubmission.status : '',
      after_status: submission.status,
      before_points: beforeSubmission ? Number(beforeSubmission.points_earned || 0) : 0,
      after_points: Number(submission.points_earned || 0),
      score: submission.score,
      feedback: submission.feedback || ''
    },
    contextLabel: 'admin-manage-submissions'
  })
}

async function reviewSubmission(event = {}, admin) {
  const payload = event.submission || event
  const submissionId = normalizeString(payload.submission_id || payload._id || payload.id)
  const status = normalizeStatus(payload.status)
  const feedback = normalizeString(payload.feedback)
  const score = normalizeScore(payload.score)
  const customPoints = normalizePoints(payload.points_earned)
  const feedbackImages = normalizeStringArray(payload.feedback_images)
  const feedbackFiles = normalizeFiles(payload.feedback_files)

  if (!submissionId) {
    return failure('提交记录ID不能为空', 400)
  }

  if (!status) {
    return failure('审核状态不合法', 400)
  }

  if (score === null && payload.score !== '' && payload.score !== null && payload.score !== undefined) {
    return failure('评分需为大于等于 0 的数字', 400)
  }

  if (customPoints === null && payload.points_earned !== '' && payload.points_earned !== null && payload.points_earned !== undefined) {
    return failure('获得积分需为大于等于 0 的整数', 400)
  }

  const current = await getSubmissionById(submissionId)
  if (!current) {
    return failure('提交记录不存在', 404)
  }

  const normalizedCurrent = normalizeSubmissionDoc(current)
  const taskInfo = await getTaskById(normalizedCurrent.task_id)
  const now = new Date()
  const pointsEarned = status === 'approved'
    ? (customPoints !== null
        ? customPoints
        : Number(taskInfo?.points || normalizedCurrent.points_earned || 0))
    : 0
  const reviewFeedback = feedback || (status === 'approved'
    ? '完成的很好，继续保持！'
    : status === 'rejected'
      ? '当前提交未通过，请补充说明或附件后再次提交。'
      : '')

  const nextSubmission = {
    ...normalizedCurrent,
    status,
    score,
    feedback: reviewFeedback,
    feedback_images: feedbackImages,
    feedback_files: feedbackFiles,
    review_time: status === 'pending' ? null : now,
    review_admin_id: admin.user._id,
    review_admin_name: admin.user.user_name || admin.user.nick_name || '管理员',
    points_earned: pointsEarned,
    update_time: now
  }

  const pointDelta = getCreditedPoints(nextSubmission) - getCreditedPoints(normalizedCurrent)
  await db.collection(SUBMISSION_COLLECTION).doc(submissionId).update({
    data: {
      status: nextSubmission.status,
      score: nextSubmission.score,
      feedback: nextSubmission.feedback,
      feedback_images: nextSubmission.feedback_images,
      feedback_files: nextSubmission.feedback_files,
      review_time: nextSubmission.review_time,
      review_admin_id: nextSubmission.review_admin_id,
      review_admin_name: nextSubmission.review_admin_name,
      points_earned: nextSubmission.points_earned,
      update_time: nextSubmission.update_time
    }
  })

  await adjustStudentPoints(normalizedCurrent.student_openid, pointDelta, now)

  // 记录积分变动日志
  if (pointDelta !== 0) {
    try {
      // 获取用户当前积分
      const userRes = await db.collection(USER_COLLECTION).where({
        _openid: normalizedCurrent.student_openid
      }).get()
      const currentPoints = userRes.data.length > 0 ? (userRes.data[0].points || 0) : 0
      const beforePoints = currentPoints - pointDelta

      await addPointsLog(db, {
        user_openid: normalizedCurrent.student_openid,
        type: pointDelta > 0 ? POINTS_TYPE.INCOME : POINTS_TYPE.EXPENSE,
        amount: Math.abs(pointDelta),
        before_points: beforePoints,
        after_points: currentPoints,
        source: pointDelta > 0 ? POINTS_SOURCE.ADMIN_GRANT : POINTS_SOURCE.ROLLBACK,
        source_id: submissionId,
        remark: pointDelta > 0
          ? `管理员审核通过奖励：${normalizedCurrent.task_title || '未命名任务'}`
          : `积分回滚：${normalizedCurrent.task_title || '未命名任务'}`,
        operator_openid: admin.uid
      })
    } catch (pointsLogError) {
      console.error('[admin-manage-submissions] 记录积分变动日志失败:', pointsLogError)
    }
  }

  await writeOperationLog('review', {
    ...nextSubmission,
    _id: submissionId
  }, admin, normalizedCurrent)

  return success('审核提交记录成功', {
    submission: {
      ...nextSubmission,
      _id: submissionId
    },
    point_delta: pointDelta
  })
}

exports.main = async (event = {}) => {
  try {
    const adminCheck = await verifyAdmin()
    if (!adminCheck.success) {
      return adminCheck
    }

    const action = normalizeString(event.action || 'list')
    if (action === 'list') {
      return listSubmissions(event)
    }

    if (action === 'get') {
      return getSubmission(event)
    }

    if (action === 'review') {
      return reviewSubmission(event, adminCheck)
    }

    return failure('不支持的提交记录操作', 400)
  } catch (error) {
    console.error('[admin-manage-submissions] Error:', error)
    return failure(error.message || '提交记录操作失败', 500)
  }
}
