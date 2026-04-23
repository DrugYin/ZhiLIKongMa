/**
 * 后台用户管理云函数
 * 功能：查询 users 集合并提供管理员受控更新能力
 */

const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')
const { writeAdminOperationLog } = require('/opt/admin-operation-log')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const app = tcb.init({
  env: process.env.TCB_ENV || process.env.SCB_ENV || process.env.CLOUDBASE_ENV || 'zhi-li-kong-ma-7gy2aqcr1add21a7'
})
const auth = app.auth()

const COLLECTION_NAME = 'users'
const PAGE_SIZE = 100
const VALID_ROLES = ['student', 'teacher', 'admin']
const VALID_STATUS = ['active', 'disabled']
const VALID_ADMIN_ROLES = ['', 'admin', 'super_admin']

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

  const res = await db.collection('users')
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

function normalizeNumber(value, fallback = 0) {
  const numberValue = Number(value)
  return Number.isNaN(numberValue) ? fallback : numberValue
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

function normalizeRoles(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[,，]/)
  const roles = source
    .map(normalizeString)
    .filter((item) => VALID_ROLES.includes(item))

  return Array.from(new Set(roles.length ? roles : ['student']))
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '')
}

function assertPhone(phone) {
  const value = normalizeString(phone)
  if (!value) {
    return ''
  }

  const normalized = normalizePhone(value)
  if (!/^1[3-9]\d{9}$/.test(normalized)) {
    throw new Error('手机号格式不正确')
  }

  return normalized
}

async function fetchAllUsers() {
  const totalRes = await db.collection(COLLECTION_NAME).count()
  const total = totalRes.total || 0
  const tasks = []

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      db.collection(COLLECTION_NAME)
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

function normalizeUserDoc(doc = {}) {
  const roles = normalizeRoles(doc.roles)
  const currentRole = roles.includes(doc.current_role) ? doc.current_role : roles[0]

  return {
    _id: doc._id,
    _openid: doc._openid || '',
    user_name: doc.user_name || doc.nick_name || doc.nickname || '',
    nick_name: doc.nick_name || doc.nickname || '',
    avatar_url: doc.avatar_url || '',
    phone: doc.phone || '',
    school: doc.school || '',
    grade: doc.grade || '',
    birthday: doc.birthday || '',
    address: doc.address || '',
    roles,
    current_role: currentRole,
    points: normalizeNumber(doc.points, 0),
    total_points: normalizeNumber(doc.total_points, 0),
    status: VALID_STATUS.includes(doc.status) ? doc.status : 'active',
    is_registered: doc.is_registered !== false,
    teacher_subject: doc.teacher_subject || '',
    teacher_project: doc.teacher_project || '',
    teacher_project_code: doc.teacher_project_code || '',
    admin_role: doc.admin_role || (roles.includes('admin') ? 'admin' : ''),
    admin_status: doc.admin_status || 'active',
    admin_auth_uid: doc.admin_auth_uid || '',
    admin_auth_bind_time: doc.admin_auth_bind_time || null,
    create_time: doc.create_time || null,
    update_time: doc.update_time || null
  }
}

function matchKeyword(user, keyword) {
  if (!keyword) {
    return true
  }

  const normalizedKeyword = keyword.toLowerCase()
  const searchText = [
    user.user_name,
    user.nick_name,
    user.phone,
    user.school,
    user.grade,
    user.teacher_project,
    user.teacher_project_code,
    user._openid,
    user.admin_auth_uid
  ].join(' ').toLowerCase()

  return searchText.includes(normalizedKeyword)
}

function matchRole(user, role) {
  return !role || user.roles.includes(role)
}

function matchStatus(user, status) {
  if (!status) {
    return true
  }

  if (status === 'admin_disabled') {
    return user.admin_status === 'disabled'
  }

  return user.status === status
}

async function listUsers(event = {}) {
  const keyword = normalizeString(event.keyword)
  const role = normalizeString(event.role)
  const status = normalizeString(event.status)
  const page = normalizePage(event.page)
  const pageSize = normalizePageSize(event.page_size || event.pageSize)
  const users = await fetchAllUsers()

  const filtered = users
    .map(normalizeUserDoc)
    .filter((item) => matchKeyword(item, keyword))
    .filter((item) => matchRole(item, role))
    .filter((item) => matchStatus(item, status))
    .sort((a, b) => {
      const aTime = new Date(a.update_time || a.create_time || 0).getTime()
      const bTime = new Date(b.update_time || b.create_time || 0).getTime()
      return bTime - aTime
    })

  const start = (page - 1) * pageSize
  const list = filtered.slice(start, start + pageSize)

  return success('获取用户列表成功', {
    list,
    total: filtered.length,
    page,
    page_size: pageSize
  })
}

async function getUserById(id) {
  if (!id) {
    return null
  }

  try {
    const res = await db.collection(COLLECTION_NAME).doc(id).get()
    return res.data || null
  } catch (error) {
    return null
  }
}

async function getUser(event = {}) {
  const id = normalizeString(event._id || event.id)
  const user = await getUserById(id)

  if (!user) {
    return failure('用户不存在', 404)
  }

  return success('获取用户详情成功', {
    user: normalizeUserDoc(user)
  })
}

function normalizeUserPayload(payload = {}, current = {}, admin = {}) {
  const roles = normalizeRoles(payload.roles)
  const status = VALID_STATUS.includes(payload.status) ? payload.status : 'active'
  const adminStatus = VALID_STATUS.includes(payload.admin_status) ? payload.admin_status : 'active'
  const adminRoleInput = normalizeString(payload.admin_role)
  const adminRole = roles.includes('admin')
    ? (VALID_ADMIN_ROLES.includes(adminRoleInput) && adminRoleInput ? adminRoleInput : 'admin')
    : ''
  const currentRole = roles.includes(payload.current_role) ? payload.current_role : roles[0]
  const points = normalizeNumber(payload.points, current.points || 0)
  const totalPoints = normalizeNumber(payload.total_points, current.total_points || 0)

  if (admin.user._id === current._id) {
    if (!roles.includes('admin')) {
      throw new Error('不能移除自己的管理员角色')
    }

    if (status === 'disabled' || adminStatus === 'disabled') {
      throw new Error('不能禁用当前登录的管理员账号')
    }
  }

  if (points < 0 || totalPoints < 0) {
    throw new Error('积分不能小于 0')
  }

  const userName = normalizeString(payload.user_name)
  if (!userName) {
    throw new Error('用户姓名不能为空')
  }

  if (userName.length > 20) {
    throw new Error('用户姓名不能超过 20 个字符')
  }

  return {
    user_name: userName,
    nick_name: normalizeString(payload.nick_name),
    phone: assertPhone(payload.phone),
    school: normalizeString(payload.school),
    grade: normalizeString(payload.grade),
    birthday: normalizeString(payload.birthday),
    address: normalizeString(payload.address),
    roles,
    current_role: currentRole,
    points,
    total_points: totalPoints,
    status,
    teacher_subject: normalizeString(payload.teacher_subject),
    teacher_project: normalizeString(payload.teacher_project),
    teacher_project_code: normalizeString(payload.teacher_project_code),
    admin_role: adminRole,
    admin_status: adminStatus,
    update_time: new Date(),
    updated_by: admin.user._id
  }
}

async function updateUser(event = {}, admin) {
  const input = event.user || event
  const id = normalizeString(input._id || input.id)
  const current = await getUserById(id)

  if (!current) {
    return failure('用户不存在，无法更新', 404)
  }

  const payload = normalizeUserPayload(input, current, admin)
  await db.collection(COLLECTION_NAME).doc(current._id).update({
    data: payload
  })

  await writeOperationLog('update', {
    _id: current._id,
    ...payload
  }, admin, current)

  return success('更新用户成功', {
    user: normalizeUserDoc({
      ...current,
      ...payload
    })
  })
}

async function writeOperationLog(action, user, admin, beforeUser = null) {
  const detail = {
    user_name: user.user_name,
    phone: user.phone,
    roles: user.roles,
    status: user.status,
    admin_status: user.admin_status
  }

  if (beforeUser) {
    detail.before = {
      user_name: beforeUser.user_name,
      phone: beforeUser.phone,
      roles: beforeUser.roles,
      current_role: beforeUser.current_role,
      status: beforeUser.status,
      admin_role: beforeUser.admin_role,
      admin_status: beforeUser.admin_status,
      points: beforeUser.points,
      total_points: beforeUser.total_points,
      teacher_project_code: beforeUser.teacher_project_code
    }
  }

  detail.after = {
    user_name: user.user_name,
    phone: user.phone,
    roles: user.roles,
    current_role: user.current_role,
    status: user.status,
    admin_role: user.admin_role,
    admin_status: user.admin_status,
    points: user.points,
    total_points: user.total_points,
    teacher_project_code: user.teacher_project_code
  }

  await writeAdminOperationLog(db, {
    module: 'users',
    action,
    targetId: user._id,
    targetKey: user.phone || user.user_name || user._id,
    admin,
    detail,
    contextLabel: 'admin-manage-users'
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
      return listUsers(event)
    }

    if (action === 'get') {
      return getUser(event)
    }

    if (action === 'update') {
      return updateUser(event, adminCheck)
    }

    return failure('不支持的用户操作', 400)
  } catch (error) {
    console.error('[admin-manage-users] Error:', error)
    return failure(error.message || '用户操作失败', 500)
  }
}
