/**
 * 后台公告管理云函数
 * 功能：对 announcements 集合提供管理员增删改查和发布控制能力
 */

const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')
const { writeAdminOperationLog } = require('/opt/admin-operation-log')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const app = tcb.init({
  env: process.env.TCB_ENV || process.env.SCB_ENV || process.env.CLOUDBASE_ENV || 'zhi-li-kong-ma-7gy2aqcr1add21a7'
})
const auth = app.auth()

const ANNOUNCEMENT_COLLECTION = 'announcements'
const USER_COLLECTION = 'users'
const PAGE_SIZE = 100
const VALID_STATUSES = ['draft', 'published', 'closed']
const VALID_DISPLAY_MODES = ['always', 'once']
const VALID_VISIBILITY_TYPES = ['all', 'role', 'users']
const VALID_ROLES = ['student', 'teacher', 'admin']

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

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeString).filter(Boolean)
  }

  return String(value || '')
    .split(/[\n,，]/)
    .map(normalizeString)
    .filter(Boolean)
}

function normalizeRoles(value) {
  return Array.from(new Set(
    normalizeStringArray(value).filter((item) => VALID_ROLES.includes(item))
  ))
}

function normalizeStatus(value, fallback = 'draft') {
  const status = normalizeString(value)
  return VALID_STATUSES.includes(status) ? status : fallback
}

function normalizeDisplayMode(value) {
  const mode = normalizeString(value)
  return VALID_DISPLAY_MODES.includes(mode) ? mode : 'once'
}

function normalizeVisibilityType(value) {
  const type = normalizeString(value)
  return VALID_VISIBILITY_TYPES.includes(type) ? type : 'all'
}

function parseDateInput(value) {
  const text = normalizeString(value)
  if (!text) {
    return null
  }

  const normalized = text.includes(' ') && !text.includes('T') ? text.replace(' ', 'T') : text
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    throw new Error('时间格式不正确，请使用 YYYY-MM-DD HH:mm 或 ISO 时间')
  }

  return date
}

function normalizeDateForOutput(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
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

async function getAnnouncementById(id) {
  if (!id) {
    return null
  }

  try {
    const res = await db.collection(ANNOUNCEMENT_COLLECTION).doc(id).get()
    return res.data || null
  } catch (error) {
    return null
  }
}

function normalizeAnnouncementDoc(doc = {}) {
  const visibilityType = normalizeVisibilityType(doc.visibility_type)
  const targetRoles = normalizeRoles(doc.target_roles)
  const targetUserOpenids = normalizeStringArray(doc.target_user_openids)

  return {
    ...doc,
    title: doc.title || '',
    content: doc.content || '',
    status: normalizeStatus(doc.status),
    display_mode: normalizeDisplayMode(doc.display_mode),
    visibility_type: visibilityType,
    target_roles: visibilityType === 'role' ? targetRoles : [],
    target_user_openids: visibilityType === 'users' ? targetUserOpenids : [],
    source_type: normalizeString(doc.source_type) || 'admin',
    notification_type: normalizeString(doc.notification_type),
    action_label: normalizeString(doc.action_label),
    action_url: normalizeString(doc.action_url),
    related_type: normalizeString(doc.related_type),
    related_id: normalizeString(doc.related_id),
    start_time: normalizeDateForOutput(doc.start_time),
    end_time: normalizeDateForOutput(doc.end_time),
    publish_time: normalizeDateForOutput(doc.publish_time),
    create_time: normalizeDateForOutput(doc.create_time),
    update_time: normalizeDateForOutput(doc.update_time),
    sort_order: Number(doc.sort_order || 100),
    is_deleted: Boolean(doc.is_deleted)
  }
}

function matchKeyword(item, keyword) {
  if (!keyword) {
    return true
  }

  const searchText = [
    item.title,
    item.content,
    item.visibility_type,
    item.target_roles.join(' '),
    item.target_user_openids.join(' ')
  ].join(' ').toLowerCase()

  return searchText.includes(keyword.toLowerCase())
}

function compareAnnouncement(left, right) {
  const sortDiff = Number(left.sort_order || 0) - Number(right.sort_order || 0)
  if (sortDiff !== 0) {
    return sortDiff
  }

  const leftTime = new Date(left.update_time || left.publish_time || left.create_time || 0).getTime()
  const rightTime = new Date(right.update_time || right.publish_time || right.create_time || 0).getTime()
  return rightTime - leftTime
}

async function listAnnouncements(event = {}) {
  const keyword = normalizeString(event.keyword)
  const status = normalizeString(event.status)
  const visibilityType = normalizeString(event.visibility_type)
  const page = normalizePage(event.page)
  const pageSize = normalizePageSize(event.page_size || event.pageSize)
  const allAnnouncements = await fetchAll(ANNOUNCEMENT_COLLECTION, {
    is_deleted: _.neq(true)
  })

  const filtered = allAnnouncements
    .map(normalizeAnnouncementDoc)
    .filter((item) => !status || item.status === status)
    .filter((item) => !visibilityType || item.visibility_type === visibilityType)
    .filter((item) => matchKeyword(item, keyword))
    .sort(compareAnnouncement)

  const start = (page - 1) * pageSize
  const list = filtered.slice(start, start + pageSize)

  return success('获取公告列表成功', {
    list,
    total: filtered.length,
    page,
    page_size: pageSize
  })
}

async function getAnnouncement(event = {}) {
  const id = normalizeString(event._id || event.id || event.announcement_id)
  const announcement = await getAnnouncementById(id)

  if (!announcement || announcement.is_deleted) {
    return failure('公告不存在', 404)
  }

  return success('获取公告详情成功', {
    announcement: normalizeAnnouncementDoc(announcement)
  })
}

function normalizeAnnouncementPayload(payload = {}, current = null) {
  const title = normalizeString(payload.title)
  const content = normalizeString(payload.content)
  const visibilityType = normalizeVisibilityType(payload.visibility_type)
  const targetRoles = normalizeRoles(payload.target_roles)
  const targetUserOpenids = Array.from(new Set(normalizeStringArray(payload.target_user_openids)))
  const sortOrder = Number(payload.sort_order || 100)

  if (!title) {
    throw new Error('公告标题不能为空')
  }

  if (title.length > 40) {
    throw new Error('公告标题不能超过 40 个字符')
  }

  if (!content) {
    throw new Error('公告内容不能为空')
  }

  if (content.length > 2000) {
    throw new Error('公告内容不能超过 2000 个字符')
  }

  if (visibilityType === 'role' && !targetRoles.length) {
    throw new Error('按角色可见时至少选择一个角色')
  }

  if (visibilityType === 'users' && !targetUserOpenids.length) {
    throw new Error('指定用户可见时至少选择一个用户')
  }

  if (Number.isNaN(sortOrder)) {
    throw new Error('排序值必须是有效数字')
  }

  const startTime = parseDateInput(payload.start_time)
  const endTime = parseDateInput(payload.end_time)
  if (startTime && endTime && startTime.getTime() >= endTime.getTime()) {
    throw new Error('生效开始时间必须早于结束时间')
  }

  const status = normalizeStatus(payload.status, current?.status || 'draft')

  return {
    title,
    content,
    status,
    display_mode: normalizeDisplayMode(payload.display_mode),
    visibility_type: visibilityType,
    target_roles: visibilityType === 'role' ? targetRoles : [],
    target_user_openids: visibilityType === 'users' ? targetUserOpenids : [],
    start_time: startTime,
    end_time: endTime,
    sort_order: sortOrder
  }
}

async function createAnnouncement(event = {}, admin) {
  const now = new Date()
  const payload = normalizeAnnouncementPayload(event.announcement || event)
  const data = {
    ...payload,
    publish_time: payload.status === 'published' ? now : null,
    source_type: 'admin',
    notification_type: '',
    action_label: '',
    action_url: '',
    related_type: '',
    related_id: '',
    create_time: now,
    update_time: now,
    created_by: admin.user._id,
    updated_by: admin.user._id,
    is_deleted: false
  }

  const addRes = await db.collection(ANNOUNCEMENT_COLLECTION).add({
    data
  })
  const announcement = {
    _id: addRes._id,
    ...data
  }

  await writeOperationLog('create', announcement, admin)

  return success('创建公告成功', {
    announcement
  })
}

async function updateAnnouncement(event = {}, admin) {
  const now = new Date()
  const input = event.announcement || event
  const id = normalizeString(input._id || input.id || input.announcement_id)
  const current = await getAnnouncementById(id)

  if (!current || current.is_deleted) {
    return failure('公告不存在，无法更新', 404)
  }

  const payload = normalizeAnnouncementPayload(input, current)
  const publishTime = payload.status === 'published'
    ? (current.publish_time || now)
    : current.publish_time || null
  const updateData = {
    ...payload,
    publish_time: publishTime,
    update_time: now,
    updated_by: admin.user._id
  }

  await db.collection(ANNOUNCEMENT_COLLECTION).doc(current._id).update({
    data: updateData
  })

  const announcement = {
    ...current,
    ...updateData,
    _id: current._id
  }
  await writeOperationLog('update', announcement, admin, current)

  return success('更新公告成功', {
    announcement
  })
}

async function deleteAnnouncement(event = {}, admin) {
  const now = new Date()
  const id = normalizeString(event._id || event.id || event.announcement_id)
  const current = await getAnnouncementById(id)

  if (!current || current.is_deleted) {
    return failure('公告不存在或已删除', 404)
  }

  await db.collection(ANNOUNCEMENT_COLLECTION).doc(current._id).update({
    data: {
      is_deleted: true,
      status: 'closed',
      delete_time: now,
      update_time: now,
      deleted_by: admin.user._id
    }
  })

  await writeOperationLog('delete', current, admin, current)

  return success('删除公告成功', {
    announcement_id: current._id
  })
}

async function setAnnouncementStatus(event = {}, admin, status) {
  const now = new Date()
  const id = normalizeString(event._id || event.id || event.announcement_id)
  const current = await getAnnouncementById(id)

  if (!current || current.is_deleted) {
    return failure('公告不存在', 404)
  }

  const updateData = {
    status,
    update_time: now,
    updated_by: admin.user._id
  }

  if (status === 'published' && !current.publish_time) {
    updateData.publish_time = now
  }

  await db.collection(ANNOUNCEMENT_COLLECTION).doc(current._id).update({
    data: updateData
  })

  const announcement = {
    ...current,
    ...updateData,
    _id: current._id
  }
  await writeOperationLog(status === 'published' ? 'publish' : 'close', announcement, admin, current)

  return success(status === 'published' ? '公告已发布' : '公告已关闭', {
    announcement
  })
}

async function writeOperationLog(action, announcement, admin, beforeAnnouncement = null) {
  const detail = {
    title: announcement.title,
    status: announcement.status,
    display_mode: announcement.display_mode,
    visibility_type: announcement.visibility_type
  }

  if (beforeAnnouncement) {
    detail.before = {
      title: beforeAnnouncement.title,
      status: beforeAnnouncement.status,
      display_mode: beforeAnnouncement.display_mode,
      visibility_type: beforeAnnouncement.visibility_type
    }
  }

  if (action !== 'delete') {
    detail.after = {
      title: announcement.title,
      status: announcement.status,
      display_mode: announcement.display_mode,
      visibility_type: announcement.visibility_type,
      target_roles: announcement.target_roles,
      target_user_count: Array.isArray(announcement.target_user_openids) ? announcement.target_user_openids.length : 0
    }
  }

  await writeAdminOperationLog(db, {
    module: 'announcements',
    action,
    targetId: announcement._id,
    targetKey: announcement.title || announcement._id,
    admin,
    detail,
    contextLabel: 'admin-manage-announcements'
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
      return listAnnouncements(event)
    }

    if (action === 'get') {
      return getAnnouncement(event)
    }

    if (action === 'create') {
      return createAnnouncement(event, adminCheck)
    }

    if (action === 'update') {
      return updateAnnouncement(event, adminCheck)
    }

    if (action === 'delete') {
      return deleteAnnouncement(event, adminCheck)
    }

    if (action === 'publish') {
      return setAnnouncementStatus(event, adminCheck, 'published')
    }

    if (action === 'close') {
      return setAnnouncementStatus(event, adminCheck, 'closed')
    }

    return failure('不支持的公告操作', 400)
  } catch (error) {
    console.error('[admin-manage-announcements] Error:', error)
    return failure(error.message || '公告操作失败', 500)
  }
}
