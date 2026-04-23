/**
 * 后台操作日志查询云函数
 * 功能：统一查询 operation_logs，兼容后台管理日志和小程序端业务日志
 */

const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const app = tcb.init({
  env: process.env.TCB_ENV || process.env.SCB_ENV || process.env.CLOUDBASE_ENV || 'zhi-li-kong-ma-7gy2aqcr1add21a7'
})
const auth = app.auth()

const USER_COLLECTION = 'users'
const LOG_COLLECTION = 'operation_logs'
const CLASS_COLLECTION = 'classes'
const PAGE_SIZE = 100

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

function pickFirst(...values) {
  return values
    .map((value) => normalizeString(value))
    .find(Boolean) || ''
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

async function fetchAllLogs() {
  const totalRes = await db.collection(LOG_COLLECTION).count()
  const total = totalRes.total || 0
  const tasks = []

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      db.collection(LOG_COLLECTION)
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

async function fetchAllUsers() {
  const totalRes = await db.collection(USER_COLLECTION).count()
  const total = totalRes.total || 0
  const tasks = []

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      db.collection(USER_COLLECTION)
        .skip(skip)
        .limit(PAGE_SIZE)
        .field({
          _id: true,
          _openid: true,
          user_name: true,
          nick_name: true,
          nickname: true,
          phone: true,
          roles: true,
          avatar_url: true
        })
        .get()
    )
  }

  if (!tasks.length) {
    return []
  }

  const pages = await Promise.all(tasks)
  return pages.reduce((result, item) => result.concat(item.data || []), [])
}

async function fetchAllClasses() {
  const totalRes = await db.collection(CLASS_COLLECTION).count()
  const total = totalRes.total || 0
  const tasks = []

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      db.collection(CLASS_COLLECTION)
        .skip(skip)
        .limit(PAGE_SIZE)
        .field({
          _id: true,
          class_name: true,
          class_code: true,
          project_code: true,
          project_name: true,
          teacher_openid: true,
          status: true
        })
        .get()
    )
  }

  if (!tasks.length) {
    return []
  }

  const pages = await Promise.all(tasks)
  return pages.reduce((result, item) => result.concat(item.data || []), [])
}

function buildUserIndexes(users = []) {
  return users.reduce((indexes, user) => {
    if (user._id) {
      indexes.byId[user._id] = user
    }

    if (user._openid) {
      indexes.byOpenid[user._openid] = user
    }

    return indexes
  }, {
    byId: {},
    byOpenid: {}
  })
}

function buildClassIndexes(classes = []) {
  return classes.reduce((indexes, classInfo) => {
    if (classInfo._id) {
      indexes.byId[classInfo._id] = classInfo
    }

    if (classInfo.class_code) {
      indexes.byCode[classInfo.class_code] = classInfo
    }

    return indexes
  }, {
    byId: {},
    byCode: {}
  })
}

async function getLogById(logId) {
  if (!logId) {
    return null
  }

  try {
    const res = await db.collection(LOG_COLLECTION).doc(logId).get()
    return res.data || null
  } catch (error) {
    return null
  }
}

function getLogModule(doc = {}) {
  return doc.module || doc.target_type || 'unknown'
}

function getActorType(doc = {}) {
  if (doc.operator_id || doc.module) {
    return 'admin'
  }

  return doc.user_type || 'unknown'
}

function getUserDisplayName(user = {}) {
  const profile = user || {}
  return profile.user_name
    || profile.nick_name
    || profile.nickname
    || profile.phone
    || ''
}

function getActorUser(doc = {}, userIndexes = { byId: {}, byOpenid: {} }) {
  return userIndexes.byId[doc.operator_id]
    || userIndexes.byOpenid[doc.user_openid]
    || userIndexes.byOpenid[doc.operator_openid]
    || null
}

function getActorName(doc = {}, user = null) {
  return getUserDisplayName(user)
    || doc.operator_name
    || doc.user_name
    || doc.user_openid
    || doc.operator_id
    || '--'
}

function isClassRelatedLog(doc = {}) {
  const moduleName = getLogModule(doc)
  const action = normalizeString(doc.action)

  return moduleName === 'class'
    || moduleName === 'classes'
    || doc.target_type === 'class'
    || /class/.test(action)
}

function getClassFromLog(doc = {}, classIndexes = { byId: {}, byCode: {} }) {
  if (!isClassRelatedLog(doc)) {
    return null
  }

  const detail = doc.detail || {}
  const after = detail.after || {}
  const before = detail.before || {}
  const classId = pickFirst(
    detail.class_id,
    after.class_id,
    before.class_id,
    doc.target_type === 'class' ? doc.target_id : ''
  )
  const classCode = pickFirst(
    detail.class_code,
    after.class_code,
    before.class_code,
    doc.target_type === 'class' ? doc.target_key : ''
  )

  return classIndexes.byId[classId]
    || classIndexes.byCode[classCode]
    || null
}

function formatClassTarget(classInfo = {}) {
  const className = normalizeString(classInfo.class_name)
  const classCode = normalizeString(classInfo.class_code)

  if (className && classCode && className !== classCode) {
    return `${className}（${classCode}）`
  }

  return className || classCode
}

function getStudentTargetName(detail = {}, userIndexes = { byId: {}, byOpenid: {} }) {
  const studentOpenid = pickFirst(
    detail.student_openid,
    detail.member_openid,
    detail.after?.student_openid,
    detail.before?.student_openid
  )
  const studentUser = userIndexes.byOpenid[studentOpenid] || userIndexes.byId[studentOpenid] || null

  return pickFirst(
    getUserDisplayName(studentUser),
    detail.student_name,
    detail.member_name,
    studentOpenid
  )
}

function getJoinClassTarget(doc = {}, classTarget = '', userIndexes = { byId: {}, byOpenid: {} }) {
  const detail = doc.detail || {}

  if (doc.action === 'join_class_approve' || doc.action === 'join_class_reject') {
    const studentName = getStudentTargetName(detail, userIndexes)

    if (studentName && classTarget) {
      return `${studentName} -> ${classTarget}`
    }

    return studentName || classTarget
  }

  return ''
}

function getDetailTargetKey(detail = {}) {
  const after = detail.after || {}
  const before = detail.before || {}

  return pickFirst(
    detail.title,
    detail.task_title,
    after.title,
    after.task_title,
    before.title,
    before.task_title,
    detail.class_name,
    after.class_name,
    before.class_name,
    detail.user_name,
    after.user_name,
    before.user_name,
    detail.student_name,
    after.student_name,
    before.student_name,
    detail.member_name,
    detail.project_name,
    after.project_name,
    before.project_name,
    detail.config_key,
    detail.phone,
    after.phone,
    before.phone,
    detail.class_code,
    after.class_code,
    before.class_code,
    detail.project_code,
    after.project_code,
    before.project_code
  )
}

function getTargetKey(doc = {}, userIndexes = { byId: {}, byOpenid: {} }, classIndexes = { byId: {}, byCode: {} }) {
  const detail = doc.detail || {}
  const classTarget = formatClassTarget(getClassFromLog(doc, classIndexes) || {})

  return pickFirst(
    getJoinClassTarget(doc, classTarget, userIndexes),
    classTarget,
    getDetailTargetKey(detail),
    doc.target_key,
    doc.target_id
  ) || '--'
}

function normalizeLogDoc(doc = {}, userIndexes = { byId: {}, byOpenid: {} }, classIndexes = { byId: {}, byCode: {} }) {
  const actorUser = getActorUser(doc, userIndexes)
  const actorOpenid = actorUser?._openid || doc.user_openid || doc.operator_openid || ''
  const actorId = doc.operator_id || actorUser?._id || actorOpenid || ''

  return {
    ...doc,
    module: getLogModule(doc),
    action: doc.action || '',
    actor_type: getActorType(doc),
    actor_id: actorId,
    actor_openid: actorOpenid,
    actor_phone: actorUser?.phone || '',
    actor_roles: actorUser?.roles || [],
    actor_avatar_url: actorUser?.avatar_url || '',
    actor_name: getActorName(doc, actorUser),
    target_type: doc.target_type || doc.module || '',
    target_id: doc.target_id || '',
    target_key: getTargetKey(doc, userIndexes, classIndexes),
    detail: doc.detail && typeof doc.detail === 'object' ? doc.detail : {},
    create_time: doc.create_time || null
  }
}

function buildDateStart(value) {
  const text = normalizeString(value)
  if (!text) {
    return null
  }

  const date = new Date(`${text}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function buildDateEnd(value) {
  const text = normalizeString(value)
  if (!text) {
    return null
  }

  const date = new Date(`${text}T23:59:59`)
  return Number.isNaN(date.getTime()) ? null : date
}

function matchDateRange(log, startDate, endDate) {
  if (!startDate && !endDate) {
    return true
  }

  const time = new Date(log.create_time || 0).getTime()
  if (Number.isNaN(time)) {
    return false
  }

  if (startDate && time < startDate.getTime()) {
    return false
  }

  if (endDate && time > endDate.getTime()) {
    return false
  }

  return true
}

function matchKeyword(log, keyword) {
  if (!keyword) {
    return true
  }

  const text = [
    log.module,
    log.action,
    log.actor_name,
    log.actor_id,
    log.target_key,
    log.target_id,
    JSON.stringify(log.detail || {})
  ].join(' ').toLowerCase()

  return text.includes(keyword.toLowerCase())
}

function compareByCreateTime(left, right) {
  const leftTime = new Date(left.create_time || 0).getTime()
  const rightTime = new Date(right.create_time || 0).getTime()
  if (leftTime !== rightTime) {
    return rightTime - leftTime
  }

  return String(left._id || '').localeCompare(String(right._id || ''))
}

function buildSummary(logs) {
  return logs.reduce((summary, log) => {
    summary.total += 1
    summary.modules[log.module] = (summary.modules[log.module] || 0) + 1
    summary.actor_types[log.actor_type] = (summary.actor_types[log.actor_type] || 0) + 1
    return summary
  }, {
    total: 0,
    modules: {},
    actor_types: {}
  })
}

async function listLogs(event = {}) {
  const keyword = normalizeString(event.keyword)
  const moduleName = normalizeString(event.module)
  const action = normalizeString(event.log_action || event.action_filter)
  const actorType = normalizeString(event.actor_type)
  const targetId = normalizeString(event.target_id)
  const page = normalizePage(event.page)
  const pageSize = normalizePageSize(event.page_size || event.pageSize)
  const startDate = buildDateStart(event.start_date)
  const endDate = buildDateEnd(event.end_date)
  const [allLogs, allUsers, allClasses] = await Promise.all([
    fetchAllLogs(),
    fetchAllUsers(),
    fetchAllClasses()
  ])
  const userIndexes = buildUserIndexes(allUsers)
  const classIndexes = buildClassIndexes(allClasses)

  const filtered = allLogs
    .map((log) => normalizeLogDoc(log, userIndexes, classIndexes))
    .filter((log) => !moduleName || log.module === moduleName)
    .filter((log) => !action || log.action === action)
    .filter((log) => !actorType || log.actor_type === actorType)
    .filter((log) => !targetId || log.target_id === targetId)
    .filter((log) => matchDateRange(log, startDate, endDate))
    .filter((log) => matchKeyword(log, keyword))
    .sort(compareByCreateTime)

  const start = (page - 1) * pageSize
  const list = filtered.slice(start, start + pageSize)

  return success('获取操作日志成功', {
    list,
    total: filtered.length,
    page,
    page_size: pageSize,
    summary: buildSummary(filtered)
  })
}

async function getLog(event = {}) {
  const logId = normalizeString(event.log_id || event._id || event.id)
  const [log, allUsers, allClasses] = await Promise.all([
    getLogById(logId),
    fetchAllUsers(),
    fetchAllClasses()
  ])

  if (!log) {
    return failure('操作日志不存在', 404)
  }

  return success('获取操作日志详情成功', {
    log: normalizeLogDoc(log, buildUserIndexes(allUsers), buildClassIndexes(allClasses))
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
      return listLogs(event)
    }

    if (action === 'get') {
      return getLog(event)
    }

    return failure('不支持的日志操作', 400)
  } catch (error) {
    console.error('[admin-manage-logs] Error:', error)
    return failure(error.message || '操作日志查询失败', 500)
  }
}
