const PAGE_SIZE = 100
const ANNOUNCEMENT_COLLECTION = 'announcements'

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizeOpenids(value) {
  const list = Array.isArray(value) ? value : [value]

  return Array.from(new Set(
    list
      .map((item) => normalizeString(item))
      .filter(Boolean)
  ))
}

async function fetchAll(query, pageSize = PAGE_SIZE) {
  const totalRes = await query.count()
  const total = totalRes.total || 0
  const tasks = []

  for (let skip = 0; skip < total; skip += pageSize) {
    tasks.push(query.skip(skip).limit(pageSize).get())
  }

  if (!tasks.length) {
    return []
  }

  const pages = await Promise.all(tasks)
  return pages.reduce((result, item) => result.concat(item.data || []), [])
}

async function getClassStudentOpenids(db, classId) {
  const normalizedClassId = normalizeString(classId)
  if (!normalizedClassId) {
    return []
  }

  const _ = db.command
  const [memberships, legacyUsers] = await Promise.all([
    fetchAll(
      db.collection('class_memberships')
        .where({
          class_id: normalizedClassId
        })
        .field({
          student_openid: true
        })
    ),
    fetchAll(
      db.collection('users')
        .where({
          class_id: normalizedClassId,
          _openid: _.neq('')
        })
        .field({
          _openid: true
        })
    )
  ])

  return normalizeOpenids(
    memberships
      .map((item) => item.student_openid)
      .concat(legacyUsers.map((item) => item._openid))
  )
}

async function createSystemNotification(db, options = {}) {
  const targetOpenids = normalizeOpenids(options.targetOpenids || options.target_openids || options.targetOpenid)
  const title = normalizeString(options.title)
  const content = normalizeString(options.content)

  if (!targetOpenids.length || !title || !content) {
    return null
  }

  const now = options.now || new Date()
  const data = {
    title,
    content,
    status: 'published',
    display_mode: normalizeString(options.displayMode || options.display_mode) || 'once',
    visibility_type: 'users',
    target_roles: [],
    target_user_openids: targetOpenids,
    source_type: 'system',
    notification_type: normalizeString(options.notificationType || options.notification_type),
    action_label: normalizeString(options.actionLabel || options.action_label) || '前往查看',
    action_url: normalizeString(options.actionUrl || options.action_url),
    related_type: normalizeString(options.relatedType || options.related_type),
    related_id: normalizeString(options.relatedId || options.related_id),
    sender_openid: normalizeString(options.senderOpenid || options.sender_openid),
    sender_name: normalizeString(options.senderName || options.sender_name),
    start_time: null,
    end_time: null,
    publish_time: now,
    create_time: now,
    update_time: now,
    sort_order: Number(options.sortOrder || options.sort_order || 20),
    is_deleted: false
  }

  const result = await db.collection(ANNOUNCEMENT_COLLECTION).add({
    data
  })

  return {
    _id: result._id,
    ...data
  }
}

async function createClassTaskNotification(db, options = {}) {
  const taskId = normalizeString(options.taskId || options.task_id)
  const classId = normalizeString(options.classId || options.class_id)
  const className = normalizeString(options.className || options.class_name) || '班级'
  const taskTitle = normalizeString(options.taskTitle || options.task_title) || '新任务'
  const targetOpenids = options.targetOpenids || await getClassStudentOpenids(db, classId)

  return createSystemNotification(db, {
    title: '新任务通知',
    content: `${className}班级发布了新的任务《${taskTitle}》`,
    targetOpenids,
    notificationType: 'class_task_published',
    actionUrl: `/pages/student/task-manage/task-detail/task-detail?task_id=${taskId}`,
    relatedType: 'task',
    relatedId: taskId,
    senderOpenid: options.senderOpenid,
    senderName: options.senderName,
    now: options.now
  })
}

async function safeCreateNotification(factory, contextLabel) {
  try {
    return await factory()
  } catch (error) {
    console.error(`[notification] ${contextLabel || 'create'} error:`, error)
    return null
  }
}

module.exports = {
  createSystemNotification,
  createClassTaskNotification,
  getClassStudentOpenids,
  safeCreateNotification
}
