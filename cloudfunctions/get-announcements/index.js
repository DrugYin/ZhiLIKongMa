/**
 * 小程序公告读取云函数
 * 功能：根据用户身份过滤公告，并记录“弹出一次”的已读状态
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

const ANNOUNCEMENT_COLLECTION = 'announcements'
const READ_COLLECTION = 'announcement_reads'
const USER_COLLECTION = 'users'
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

  return Math.min(pageSize, 50)
}

async function getCurrentUser(openid) {
  const res = await db.collection(USER_COLLECTION)
    .where({
      _openid: openid
    })
    .limit(1)
    .get()

  return res.data[0] || null
}

async function fetchPublishedAnnouncements() {
  const query = db.collection(ANNOUNCEMENT_COLLECTION).where({
    status: 'published',
    is_deleted: _.neq(true)
  })
  const totalRes = await query.count()
  const total = totalRes.total || 0
  const tasks = []

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(query.skip(skip).limit(PAGE_SIZE).get())
  }

  if (!tasks.length) {
    return []
  }

  const pages = await Promise.all(tasks)
  return pages.reduce((result, item) => result.concat(item.data || []), [])
}

async function fetchReadAnnouncementIds(openid) {
  if (!openid) {
    return new Set()
  }

  const res = await db.collection(READ_COLLECTION)
    .where({
      user_openid: openid
    })
    .limit(1000)
    .get()

  return new Set((res.data || []).map((item) => item.announcement_id).filter(Boolean))
}

function normalizeDate(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isInActiveTime(announcement, now) {
  const startTime = normalizeDate(announcement.start_time)
  const endTime = normalizeDate(announcement.end_time)

  if (startTime && startTime.getTime() > now.getTime()) {
    return false
  }

  if (endTime && endTime.getTime() <= now.getTime()) {
    return false
  }

  return true
}

function getUserRoles(user = {}) {
  const roles = Array.isArray(user.roles) ? user.roles : []
  const currentRole = normalizeString(user.current_role)
  return Array.from(new Set([currentRole, ...roles].filter(Boolean)))
}

function isVisibleToUser(announcement, user, openid) {
  const visibilityType = normalizeString(announcement.visibility_type) || 'all'

  if (visibilityType === 'all') {
    return true
  }

  if (visibilityType === 'role') {
    const targetRoles = Array.isArray(announcement.target_roles) ? announcement.target_roles : []
    const userRoles = getUserRoles(user)
    return targetRoles.some((role) => userRoles.includes(role))
  }

  if (visibilityType === 'users') {
    const targetUserOpenids = Array.isArray(announcement.target_user_openids)
      ? announcement.target_user_openids
      : []
    return targetUserOpenids.includes(openid)
  }

  return false
}

function normalizeAnnouncementForClient(announcement, readIds) {
  const isRead = readIds.has(announcement._id)
  const displayMode = normalizeString(announcement.display_mode) || 'once'

  return {
    _id: announcement._id,
    title: announcement.title || '',
    content: announcement.content || '',
    display_mode: displayMode,
    visibility_type: normalizeString(announcement.visibility_type) || 'all',
    start_time: announcement.start_time || null,
    end_time: announcement.end_time || null,
    publish_time: announcement.publish_time || announcement.update_time || announcement.create_time || null,
    sort_order: Number(announcement.sort_order || 100),
    source_type: normalizeString(announcement.source_type) || 'admin',
    notification_type: normalizeString(announcement.notification_type),
    action_label: normalizeString(announcement.action_label),
    action_url: normalizeString(announcement.action_url),
    related_type: normalizeString(announcement.related_type),
    related_id: normalizeString(announcement.related_id),
    is_read: isRead,
    should_popup: displayMode === 'always' || !isRead
  }
}

function compareAnnouncement(left, right) {
  const sortDiff = Number(left.sort_order || 0) - Number(right.sort_order || 0)
  if (sortDiff !== 0) {
    return sortDiff
  }

  const leftTime = new Date(left.publish_time || 0).getTime()
  const rightTime = new Date(right.publish_time || 0).getTime()
  return rightTime - leftTime
}

async function listAnnouncements(event, openid) {
  const page = normalizePage(event.page)
  const pageSize = normalizePageSize(event.page_size || event.pageSize)
  const onlyPopup = event.only_popup === true || event.only_popup === 'true'
  const [user, readIds, announcements] = await Promise.all([
    getCurrentUser(openid),
    fetchReadAnnouncementIds(openid),
    fetchPublishedAnnouncements()
  ])
  const now = new Date()
  const visibleList = announcements
    .filter((item) => isInActiveTime(item, now))
    .filter((item) => isVisibleToUser(item, user, openid))
    .map((item) => normalizeAnnouncementForClient(item, readIds))
    .sort(compareAnnouncement)
  const filteredList = onlyPopup ? visibleList.filter((item) => item.should_popup) : visibleList
  const start = (page - 1) * pageSize

  return success('获取公告成功', {
    list: filteredList.slice(start, start + pageSize),
    popup_list: visibleList.filter((item) => item.should_popup),
    total: filteredList.length,
    page,
    page_size: pageSize
  })
}

async function markAnnouncementRead(event, openid) {
  const announcementId = normalizeString(event.announcement_id || event._id || event.id)
  if (!announcementId) {
    return failure('缺少公告ID', 400)
  }

  const announcementRes = await db.collection(ANNOUNCEMENT_COLLECTION).doc(announcementId).get().catch(() => null)
  const announcement = announcementRes && announcementRes.data
  if (!announcement || announcement.is_deleted) {
    return failure('公告不存在', 404)
  }

  const existed = await db.collection(READ_COLLECTION)
    .where({
      announcement_id: announcementId,
      user_openid: openid
    })
    .limit(1)
    .get()

  if (!existed.data.length) {
    await db.collection(READ_COLLECTION).add({
      data: {
        announcement_id: announcementId,
        announcement_title: announcement.title || '',
        user_openid: openid,
        read_time: new Date()
      }
    })
  }

  return success('公告已标记为已读', {
    announcement_id: announcementId
  })
}

exports.main = async (event = {}) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) {
      return failure('无法获取用户身份', 401)
    }

    const action = normalizeString(event.action || 'list')
    if (action === 'list') {
      return listAnnouncements(event, OPENID)
    }

    if (action === 'read' || action === 'mark_read') {
      return markAnnouncementRead(event, OPENID)
    }

    return failure('不支持的公告操作', 400)
  } catch (error) {
    console.error('[get-announcements] Error:', error)
    return failure(error.message || '公告操作失败', 500)
  }
}
