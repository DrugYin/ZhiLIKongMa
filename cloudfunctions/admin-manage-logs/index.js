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

function getActorName(doc = {}) {
  return doc.operator_name
    || doc.user_name
    || doc.user_openid
    || doc.operator_id
    || '--'
}

function getTargetKey(doc = {}) {
  const detail = doc.detail || {}
  return doc.target_key
    || detail.task_title
    || detail.class_name
    || detail.student_name
    || detail.config_key
    || detail.project_code
    || doc.target_id
    || '--'
}

function normalizeLogDoc(doc = {}) {
  return {
    ...doc,
    module: getLogModule(doc),
    action: doc.action || '',
    actor_type: getActorType(doc),
    actor_id: doc.operator_id || doc.user_openid || '',
    actor_name: getActorName(doc),
    target_type: doc.target_type || doc.module || '',
    target_id: doc.target_id || '',
    target_key: getTargetKey(doc),
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
  const action = normalizeString(event.action)
  const actorType = normalizeString(event.actor_type)
  const targetId = normalizeString(event.target_id)
  const page = normalizePage(event.page)
  const pageSize = normalizePageSize(event.page_size || event.pageSize)
  const startDate = buildDateStart(event.start_date)
  const endDate = buildDateEnd(event.end_date)
  const allLogs = await fetchAllLogs()

  const filtered = allLogs
    .map(normalizeLogDoc)
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
  const log = await getLogById(logId)

  if (!log) {
    return failure('操作日志不存在', 404)
  }

  return success('获取操作日志详情成功', {
    log: normalizeLogDoc(log)
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
