/**
 * 后台任务管理云函数
 * 功能：对 tasks 集合提供管理员增删改查能力，并支持查看任务提交记录
 */

const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')
const { writeAdminOperationLog } = require('../_shared/admin-operation-log')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const app = tcb.init({
  env: process.env.TCB_ENV || process.env.SCB_ENV || process.env.CLOUDBASE_ENV || 'zhi-li-kong-ma-7gy2aqcr1add21a7'
})
const auth = app.auth()

const TASK_COLLECTION = 'tasks'
const SUBMISSION_COLLECTION = 'submissions'
const USER_COLLECTION = 'users'
const CLASS_COLLECTION = 'classes'
const PROJECT_COLLECTION = 'projects'
const PAGE_SIZE = 100
const VALID_TASK_TYPES = ['class', 'public']
const VALID_VISIBILITIES = ['class_only', 'public']
const VALID_STATUSES = ['draft', 'published', 'closed']
const VALID_SUBMISSION_STATUSES = ['pending', 'approved', 'rejected']

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

function normalizeStatus(value, fallback = 'draft') {
  const status = normalizeString(value)
  return VALID_STATUSES.includes(status) ? status : fallback
}

function normalizeTaskType(value) {
  const taskType = normalizeString(value)
  return VALID_TASK_TYPES.includes(taskType) ? taskType : ''
}

function normalizeVisibility(taskType, value) {
  if (taskType === 'public') {
    return 'public'
  }

  const visibility = normalizeString(value)
  return VALID_VISIBILITIES.includes(visibility) ? visibility : 'class_only'
}

function normalizeDifficulty(value) {
  const difficulty = Number(value)
  return Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 5 ? difficulty : null
}

function normalizePoints(value) {
  const points = Number(value)
  return Number.isInteger(points) && points >= 0 ? points : null
}

function normalizeMaxSubmissions(value) {
  if (value === '' || value === null || value === undefined) {
    return 0
  }

  const maxSubmissions = Number(value)
  return Number.isInteger(maxSubmissions) && maxSubmissions >= 0 ? maxSubmissions : null
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeString).filter(Boolean)
  }

  return String(value || '')
    .split(/[\n,，]/)
    .map(normalizeString)
    .filter(Boolean)
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

function parseLocalDateTime(dateText, timeText) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText)

  if (!dateMatch || !timeMatch) {
    return null
  }

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  const deadline = new Date(year, month - 1, day, hour, minute, 0, 0)

  if (
    Number.isNaN(deadline.getTime())
    || deadline.getFullYear() !== year
    || deadline.getMonth() !== month - 1
    || deadline.getDate() !== day
    || deadline.getHours() !== hour
    || deadline.getMinutes() !== minute
  ) {
    return null
  }

  return deadline
}

function buildDeadline(deadlineDate, deadlineTime) {
  if (!deadlineDate && !deadlineTime) {
    return {
      deadline_date: '',
      deadline_time: '',
      deadline: null
    }
  }

  if (!deadlineDate || !deadlineTime) {
    return null
  }

  const deadline = parseLocalDateTime(deadlineDate, deadlineTime)
  if (!deadline) {
    return null
  }

  return {
    deadline_date: deadlineDate,
    deadline_time: deadlineTime,
    deadline: `${deadlineDate} ${deadlineTime}`
  }
}

function normalizeDateValue(value) {
  if (!value) {
    return ''
  }

  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return normalizeString(value)
}

function normalizeTimeValue(value) {
  if (!value) {
    return ''
  }

  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
  }

  return normalizeString(value).slice(0, 5)
}

async function fetchAll(collectionName, queryData = {}, fields = {}) {
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

  const pages = await Promise.all(tasks)
  return pages.reduce((result, item) => result.concat(item.data || []), [])
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

async function getClassById(classId) {
  if (!classId) {
    return null
  }

  try {
    const res = await db.collection(CLASS_COLLECTION).doc(classId).get()
    return res.data || null
  } catch (error) {
    return null
  }
}

async function getProjectByCode(projectCode) {
  if (!projectCode) {
    return null
  }

  const res = await db.collection(PROJECT_COLLECTION)
    .where({
      project_code: projectCode
    })
    .limit(1)
    .get()
  return res.data[0] || null
}

async function getTeacherByOpenid(openid) {
  if (!openid) {
    return null
  }

  const res = await db.collection(USER_COLLECTION)
    .where({
      _openid: openid
    })
    .limit(1)
    .get()
  const user = res.data[0]
  return user && hasRole(user, 'teacher') ? user : null
}

function getUserName(user = {}) {
  return user.user_name || user.nick_name || user.nickname || ''
}

async function countSubmissions(taskId) {
  const [total, pending, approved, rejected] = await Promise.all([
    db.collection(SUBMISSION_COLLECTION).where({ task_id: taskId }).count(),
    db.collection(SUBMISSION_COLLECTION).where({ task_id: taskId, status: 'pending' }).count(),
    db.collection(SUBMISSION_COLLECTION).where({ task_id: taskId, status: 'approved' }).count(),
    db.collection(SUBMISSION_COLLECTION).where({ task_id: taskId, status: 'rejected' }).count()
  ])

  return {
    submission_count: total.total || 0,
    pending_submission_count: pending.total || 0,
    approved_submission_count: approved.total || 0,
    rejected_submission_count: rejected.total || 0
  }
}

function normalizeTaskDoc(doc = {}) {
  const taskType = normalizeTaskType(doc.task_type) || 'class'
  return {
    ...doc,
    title: doc.title || '',
    description: doc.description || '',
    cover_image: doc.cover_image || '',
    images: Array.isArray(doc.images) ? doc.images : [],
    files: Array.isArray(doc.files) ? doc.files : [],
    project_code: doc.project_code || '',
    project_name: doc.project_name || '',
    category: doc.category || '',
    difficulty: Number(doc.difficulty || 1),
    points: Number(doc.points || 0),
    max_submissions: Number(doc.max_submissions || 0),
    deadline_date: normalizeDateValue(doc.deadline_date),
    deadline_time: normalizeTimeValue(doc.deadline_time),
    deadline: doc.deadline || null,
    task_type: taskType,
    visibility: normalizeVisibility(taskType, doc.visibility),
    class_id: doc.class_id || '',
    class_name: doc.class_name || '',
    teacher_openid: doc.teacher_openid || '',
    teacher_name: doc.teacher_name || '',
    status: normalizeStatus(doc.status, 'draft'),
    is_deleted: Boolean(doc.is_deleted)
  }
}

function matchKeyword(item, keyword) {
  if (!keyword) {
    return true
  }

  const searchText = [
    item.title,
    item.description,
    item.project_name,
    item.project_code,
    item.category,
    item.class_name,
    item.teacher_name
  ].join(' ').toLowerCase()

  return searchText.includes(keyword.toLowerCase())
}

function compareByTime(left, right) {
  const leftTime = new Date(left.update_time || left.create_time || 0).getTime()
  const rightTime = new Date(right.update_time || right.create_time || 0).getTime()
  if (leftTime !== rightTime) {
    return rightTime - leftTime
  }

  return String(left._id || '').localeCompare(String(right._id || ''))
}

async function enrichTask(task) {
  const normalized = normalizeTaskDoc(task)
  const stats = await countSubmissions(normalized._id)
  return {
    ...normalized,
    ...stats
  }
}

async function listTasks(event = {}) {
  const keyword = normalizeString(event.keyword)
  const projectCode = normalizeString(event.project_code)
  const classId = normalizeString(event.class_id)
  const teacherOpenid = normalizeString(event.teacher_openid)
  const taskType = normalizeTaskType(event.task_type)
  const visibility = normalizeString(event.visibility)
  const status = normalizeString(event.status)
  const page = normalizePage(event.page)
  const pageSize = normalizePageSize(event.page_size || event.pageSize)
  const allTasks = await fetchAll(TASK_COLLECTION, {
    is_deleted: _.neq(true)
  })

  const filtered = allTasks
    .map(normalizeTaskDoc)
    .filter((item) => !projectCode || item.project_code === projectCode)
    .filter((item) => !classId || item.class_id === classId)
    .filter((item) => !teacherOpenid || item.teacher_openid === teacherOpenid)
    .filter((item) => !taskType || item.task_type === taskType)
    .filter((item) => !visibility || item.visibility === visibility)
    .filter((item) => !status || item.status === status)
    .filter((item) => matchKeyword(item, keyword))
    .sort(compareByTime)

  const start = (page - 1) * pageSize
  const pageList = filtered.slice(start, start + pageSize)
  const list = await Promise.all(pageList.map(enrichTask))

  return success('获取任务列表成功', {
    list,
    total: filtered.length,
    page,
    page_size: pageSize
  })
}

async function getTask(event = {}) {
  const taskId = normalizeString(event.task_id || event._id || event.id)
  const taskInfo = await getTaskById(taskId)

  if (!taskInfo || taskInfo.is_deleted) {
    return failure('任务不存在', 404)
  }

  return success('获取任务详情成功', {
    task: await enrichTask(taskInfo)
  })
}

async function normalizeTaskPayload(payload = {}, current = null) {
  const title = normalizeString(payload.title)
  const taskType = normalizeTaskType(payload.task_type)
  const status = normalizeStatus(payload.status, current?.status || 'draft')
  const difficulty = normalizeDifficulty(payload.difficulty)
  const points = normalizePoints(payload.points)
  const maxSubmissions = normalizeMaxSubmissions(payload.max_submissions)
  const images = normalizeStringArray(payload.images)
  const files = normalizeFiles(payload.files)
  const deadlineConfig = buildDeadline(
    normalizeDateValue(payload.deadline_date),
    normalizeTimeValue(payload.deadline_time)
  )

  if (!title) {
    throw new Error('任务标题不能为空')
  }

  if (!taskType) {
    throw new Error('任务类型不合法')
  }

  if (difficulty === null) {
    throw new Error('任务难度需为 1-5 的整数')
  }

  if (points === null) {
    throw new Error('任务积分需为大于等于 0 的整数')
  }

  if (maxSubmissions === null) {
    throw new Error('最大提交次数需为大于等于 0 的整数，0 表示使用系统配置')
  }

  if (deadlineConfig === null) {
    throw new Error('截止日期和截止时间需同时填写且格式正确')
  }

  let classInfo = null
  let project = null
  let teacher = null
  let classId = ''
  let className = ''
  let teacherOpenid = normalizeString(payload.teacher_openid)
  let teacherName = normalizeString(payload.teacher_name)
  let projectCode = normalizeString(payload.project_code)
  let projectName = normalizeString(payload.project_name)

  if (taskType === 'class') {
    classId = normalizeString(payload.class_id)
    if (!classId) {
      throw new Error('班级任务必须选择所属班级')
    }

    classInfo = await getClassById(classId)
    if (!classInfo || classInfo.status === 'deleted') {
      throw new Error('班级不存在或已删除')
    }

    className = classInfo.class_name || ''
    teacherOpenid = classInfo.teacher_openid || ''
    teacherName = classInfo.teacher_name || ''
    projectCode = classInfo.project_code || projectCode
    projectName = classInfo.project_name || projectName
  } else if (!teacherOpenid) {
    throw new Error('公共任务必须选择负责教师')
  }

  if (!projectCode) {
    throw new Error('请选择所属项目')
  }

  project = await getProjectByCode(projectCode)
  if (!project) {
    throw new Error('所选项目不存在')
  }
  projectName = project.project_name || projectName

  teacher = await getTeacherByOpenid(teacherOpenid)
  if (!teacher) {
    throw new Error('负责教师不存在或不是教师角色')
  }
  teacherName = teacherName || getUserName(teacher)

  return {
    title,
    description: normalizeString(payload.description),
    cover_image: normalizeString(payload.cover_image),
    images,
    files,
    project_code: projectCode,
    project_name: projectName,
    category: normalizeString(payload.category),
    difficulty,
    points,
    max_submissions: maxSubmissions,
    deadline_date: deadlineConfig.deadline_date,
    deadline_time: deadlineConfig.deadline_time,
    deadline: deadlineConfig.deadline,
    task_type: taskType,
    visibility: normalizeVisibility(taskType, payload.visibility),
    class_id: classId,
    class_name: className,
    teacher_openid: teacherOpenid,
    teacher_name: teacherName,
    status
  }
}

async function adjustClassTaskStats(classId, totalDelta, publishedDelta, now) {
  if (!classId || (!totalDelta && !publishedDelta)) {
    return
  }

  const updateData = {
    update_time: now
  }

  if (totalDelta) {
    updateData.task_count = _.inc(totalDelta)
  }

  if (publishedDelta) {
    updateData.published_task_count = _.inc(publishedDelta)
  }

  await db.collection(CLASS_COLLECTION).doc(classId).update({
    data: updateData
  })
}

async function syncClassTaskStats(previousTask = null, nextTask = null, now = new Date()) {
  const previousClassId = previousTask && previousTask.task_type === 'class' && !previousTask.is_deleted
    ? normalizeString(previousTask.class_id)
    : ''
  const nextClassId = nextTask && nextTask.task_type === 'class' && !nextTask.is_deleted
    ? normalizeString(nextTask.class_id)
    : ''
  const previousTotal = previousClassId ? 1 : 0
  const nextTotal = nextClassId ? 1 : 0
  const previousPublished = previousClassId && previousTask.status === 'published' ? 1 : 0
  const nextPublished = nextClassId && nextTask.status === 'published' ? 1 : 0

  if (previousClassId === nextClassId) {
    await adjustClassTaskStats(nextClassId, nextTotal - previousTotal, nextPublished - previousPublished, now)
    return
  }

  await adjustClassTaskStats(previousClassId, -previousTotal, -previousPublished, now)
  await adjustClassTaskStats(nextClassId, nextTotal, nextPublished, now)
}

async function createTask(event = {}, admin) {
  const now = new Date()
  const payload = await normalizeTaskPayload(event.task || event)
  const taskData = {
    ...payload,
    publish_time: payload.status === 'published' ? now : null,
    create_time: now,
    update_time: now,
    created_by: admin.user._id,
    updated_by: admin.user._id,
    is_deleted: false
  }

  const addRes = await db.collection(TASK_COLLECTION).add({
    data: taskData
  })
  const task = {
    _id: addRes._id,
    ...taskData
  }

  await syncClassTaskStats(null, task, now)
  await writeOperationLog('create', task, admin)

  return success('创建任务成功', {
    task
  })
}

async function updateTask(event = {}, admin) {
  const now = new Date()
  const input = event.task || event
  const taskId = normalizeString(input._id || input.task_id || input.id)
  const current = await getTaskById(taskId)

  if (!current || current.is_deleted) {
    return failure('任务不存在，无法更新', 404)
  }

  const payload = await normalizeTaskPayload(input, current)
  const publishTime = payload.status === 'published'
    ? (current.publish_time || now)
    : null
  const updateData = {
    ...payload,
    publish_time: publishTime,
    update_time: now,
    updated_by: admin.user._id
  }

  await db.collection(TASK_COLLECTION).doc(current._id).update({
    data: updateData
  })

  const nextTask = {
    ...current,
    ...updateData,
    _id: current._id
  }
  await syncClassTaskStats(current, nextTask, now)
  await writeOperationLog('update', nextTask, admin, current)

  return success('更新任务成功', {
    task: nextTask
  })
}

async function deleteTask(event = {}, admin) {
  const now = new Date()
  const taskId = normalizeString(event.task_id || event._id || event.id)
  const current = await getTaskById(taskId)

  if (!current || current.is_deleted) {
    return failure('任务不存在或已删除', 404)
  }

  const submissionStats = await countSubmissions(current._id)
  await db.collection(TASK_COLLECTION).doc(current._id).update({
    data: {
      is_deleted: true,
      status: 'closed',
      delete_time: now,
      update_time: now,
      deleted_by: admin.user._id
    }
  })

  await syncClassTaskStats(current, {
    ...current,
    is_deleted: true,
    status: 'closed'
  }, now)
  await writeOperationLog('delete', current, admin, current)

  return success('删除任务成功', {
    task_id: current._id,
    submission_count: submissionStats.submission_count
  })
}

async function listSubmissions(event = {}) {
  const taskId = normalizeString(event.task_id || event._id || event.id)
  const status = normalizeString(event.status || 'all')
  const page = normalizePage(event.page)
  const pageSize = normalizePageSize(event.page_size || event.pageSize)

  if (!taskId) {
    return failure('缺少任务ID', 400)
  }

  const taskInfo = await getTaskById(taskId)
  if (!taskInfo || taskInfo.is_deleted) {
    return failure('任务不存在', 404)
  }

  const queryData = {
    task_id: taskId
  }
  if (VALID_SUBMISSION_STATUSES.includes(status)) {
    queryData.status = status
  }

  const query = db.collection(SUBMISSION_COLLECTION).where(queryData)
  const totalRes = await query.count()
  const listRes = await query
    .orderBy('submit_time', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return success('获取任务提交记录成功', {
    list: listRes.data || [],
    total: totalRes.total || 0,
    page,
    page_size: pageSize
  })
}

async function writeOperationLog(action, task, admin, beforeTask = null) {
  const detail = {
    title: task.title,
    task_type: task.task_type,
    project_code: task.project_code,
    class_id: task.class_id,
    teacher_openid: task.teacher_openid,
    status: task.status
  }

  if (beforeTask) {
    detail.before = {
      title: beforeTask.title,
      task_type: beforeTask.task_type,
      project_code: beforeTask.project_code,
      class_id: beforeTask.class_id,
      teacher_openid: beforeTask.teacher_openid,
      status: beforeTask.status
    }
  }

  if (action !== 'delete') {
    detail.after = {
      title: task.title,
      task_type: task.task_type,
      project_code: task.project_code,
      class_id: task.class_id,
      teacher_openid: task.teacher_openid,
      status: task.status,
      difficulty: task.difficulty,
      points: task.points
    }
  }

  await writeAdminOperationLog(db, {
    module: 'tasks',
    action,
    targetId: task._id,
    targetKey: task.title || task._id,
    admin,
    detail,
    contextLabel: 'admin-manage-tasks'
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
      return listTasks(event)
    }

    if (action === 'get') {
      return getTask(event)
    }

    if (action === 'create') {
      return createTask(event, adminCheck)
    }

    if (action === 'update') {
      return updateTask(event, adminCheck)
    }

    if (action === 'delete') {
      return deleteTask(event, adminCheck)
    }

    if (action === 'submissions') {
      return listSubmissions(event)
    }

    return failure('不支持的任务操作', 400)
  } catch (error) {
    console.error('[admin-manage-tasks] Error:', error)
    return failure(error.message || '任务操作失败', 500)
  }
}
