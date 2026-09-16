const TEMPLATE_IDS = Object.freeze({
  TASK_SUBMITTED: 'HO4rLQjLFnID1yBejQB7v-zm2QIRbNIlFci5EeMvmnI',
  TASK_PUBLISHED: '-YZw9XHRKIlte5uQ20dO4lRuaXGFI4gPM_2Z_isBpbo',
  SUBMISSION_REVIEWED: 'WToHJbW9SD8z86AlvCQMMkigfpzIL4AtWtMhVd7gr7w'
})

const VALID_MINIPROGRAM_STATES = new Set(['developer', 'trial', 'formal'])
const DEFAULT_BATCH_SIZE = 10
const SUBSCRIBE_LOG_COLLECTION = 'subscribe_message_logs'
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000

function cleanText(value, maxLength, fallback = '') {
  const normalized = String(value || '')
    .replace(/[\r\n\t\f\v]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || fallback

  return Array.from(normalized).slice(0, maxLength).join('')
}

function normalizeDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function padNumber(value) {
  return String(value).padStart(2, '0')
}

function getChinaDateParts(value) {
  const date = normalizeDate(value) || new Date()
  const chinaDate = new Date(date.getTime() + CHINA_TIME_OFFSET_MS)
  return {
    year: chinaDate.getUTCFullYear(),
    month: chinaDate.getUTCMonth() + 1,
    day: chinaDate.getUTCDate(),
    hour: chinaDate.getUTCHours(),
    minute: chinaDate.getUTCMinutes()
  }
}

function formatDate(value) {
  const parts = getChinaDateParts(value)
  return `${parts.year}年${parts.month}月${parts.day}日`
}

function formatDateTime(value) {
  const parts = getChinaDateParts(value)
  return `${parts.year}年${parts.month}月${parts.day}日 ${padNumber(parts.hour)}:${padNumber(parts.minute)}`
}

function encodeQueryValue(value) {
  return encodeURIComponent(String(value || '').trim())
}

function shouldSendTaskPublishedMessage(options = {}) {
  const isPublishedClassTask = options.taskType === 'class' && options.status === 'published'
  const alreadyPublished = Object.prototype.hasOwnProperty.call(options, 'previousStatus')
    && options.previousStatus === 'published'

  return isPublishedClassTask && !alreadyPublished
}

function buildTaskSubmittedMessage(options = {}) {
  const submissionId = encodeQueryValue(options.submissionId || options.submission_id)
  const query = submissionId ? `&record_id=${submissionId}` : ''

  return {
    touser: String(options.teacherOpenid || options.teacher_openid || '').trim(),
    templateId: TEMPLATE_IDS.TASK_SUBMITTED,
    page: `pages/teacher/pending/pending?type=submission${query}`,
    data: {
      thing9: { value: cleanText(options.taskTitle || options.task_title, 20, '未命名任务') },
      thing11: { value: cleanText(options.className || options.class_name, 20, '未设置班级') },
      name1: { value: cleanText(options.studentName || options.student_name, 10, '学生') },
      phrase17: { value: '待审核' },
      time15: { value: formatDateTime(options.submitTime || options.submit_time) }
    }
  }
}

function buildTaskPublishedMessage(options = {}) {
  const taskId = encodeQueryValue(options.taskId || options.task_id)
  const projectName = options.projectName || options.project_name
    || options.projectCode || options.project_code

  return {
    touser: String(options.studentOpenid || options.student_openid || '').trim(),
    templateId: TEMPLATE_IDS.TASK_PUBLISHED,
    page: `pages/student/task-manage/task-detail/task-detail?task_id=${taskId}`,
    data: {
      thing15: { value: cleanText(options.taskTitle || options.task_title, 20, '未命名任务') },
      thing5: { value: cleanText(projectName, 20, '未设置课程') },
      thing22: { value: cleanText(options.teacherName || options.teacher_name, 20, '教师') },
      date14: { value: formatDate(options.publishTime || options.publish_time) },
      phrase24: { value: '待提交' }
    }
  }
}

function buildSubmissionReviewedMessage(options = {}) {
  const taskId = encodeQueryValue(options.taskId || options.task_id)
  const approved = options.status === 'approved'
  const defaultFeedback = approved
    ? '审核通过，请继续保持'
    : '审核未通过，请修改后重新提交'

  return {
    touser: String(options.studentOpenid || options.student_openid || '').trim(),
    templateId: TEMPLATE_IDS.SUBMISSION_REVIEWED,
    page: `pages/student/task-manage/submission-records/submission-records?task_id=${taskId}`,
    data: {
      thing2: { value: cleanText(options.taskTitle || options.task_title, 20, '未命名任务') },
      name5: { value: cleanText(options.teacherName || options.teacher_name, 10, '教师') },
      thing3: { value: approved ? '审核结果：通过' : '审核结果：拒绝' },
      thing8: { value: cleanText(options.feedback, 20, defaultFeedback) },
      time1: { value: formatDateTime(options.reviewTime || options.review_time) }
    }
  }
}

function getMiniProgramState() {
  const value = String(process.env.SUBSCRIBE_MESSAGE_STATE || '').trim()
  return VALID_MINIPROGRAM_STATES.has(value) ? value : 'formal'
}

function normalizeError(error) {
  return {
    errorCode: Number(error && (error.errCode || error.errcode) || 0),
    errorMessage: cleanText(error && (error.errMsg || error.errmsg || error.message), 300)
  }
}

async function safeRecordSubscribeMessage(db, payload, sendResult, options = {}) {
  if (!db || typeof db.collection !== 'function') {
    return false
  }

  const now = options.now instanceof Date ? options.now : new Date()
  const context = options.logContext || {}
  const errorCode = Number(sendResult.errorCode || 0)
  const record = {
    message_type: cleanText(context.messageType, 40),
    template_id: cleanText(payload.templateId, 100),
    status: sendResult.success ? 'success' : 'failed',
    error_code: errorCode,
    error_message: cleanText(sendResult.errorMessage, 300),
    recipient_openid: cleanText(payload.touser, 100),
    miniprogram_state: cleanText(sendResult.miniprogramState, 20, 'formal'),
    source_function: cleanText(context.sourceFunction, 60),
    event_key: cleanText(context.eventKey, 160),
    task_id: cleanText(context.taskId, 100),
    class_id: cleanText(context.classId, 100),
    submission_id: cleanText(context.submissionId, 100),
    create_time: now,
    expire_time: new Date(now.getTime() + ONE_YEAR_MS)
  }

  try {
    await db.collection(SUBSCRIBE_LOG_COLLECTION).add({ data: record })
    return true
  } catch (error) {
    const logger = options.logger || console
    logger.error('[subscribe-message] record send result failed', normalizeError(error))
    return false
  }
}

async function safeSendSubscribeMessage(cloud, payload, options = {}) {
  const logger = options.logger || console
  const contextLabel = options.contextLabel || 'send'

  if (!payload || !payload.touser || !payload.templateId) {
    return { success: false, skipped: true }
  }

  const miniprogramState = options.miniprogramState || getMiniProgramState()
  try {
    const result = await cloud.openapi.subscribeMessage.send({
      ...payload,
      miniprogramState,
      lang: 'zh_CN'
    })
    const returnedError = normalizeError(result)
    const success = returnedError.errorCode === 0
    const sendResult = {
      success,
      skipped: false,
      result,
      errorCode: returnedError.errorCode,
      errorMessage: success ? '' : returnedError.errorMessage,
      miniprogramState
    }
    await safeRecordSubscribeMessage(options.db, payload, sendResult, options)
    return sendResult
  } catch (error) {
    const normalizedError = normalizeError(error)
    logger.error(`[subscribe-message] ${contextLabel} failed`, {
      errCode: normalizedError.errorCode,
      errMsg: normalizedError.errorMessage
    })
    const sendResult = {
      success: false,
      skipped: false,
      errorCode: normalizedError.errorCode,
      errorMessage: normalizedError.errorMessage,
      miniprogramState
    }
    await safeRecordSubscribeMessage(options.db, payload, sendResult, options)
    return sendResult
  }
}

function dedupeMessages(messages) {
  const unique = []
  const keys = new Set()

  for (const message of Array.isArray(messages) ? messages : []) {
    if (!message || !message.touser || !message.templateId) {
      continue
    }
    const key = `${message.templateId}:${message.touser}`
    if (!keys.has(key)) {
      keys.add(key)
      unique.push(message)
    }
  }

  return unique
}

async function safeSendSubscribeMessages(cloud, messages, options = {}) {
  const originalMessages = Array.isArray(messages) ? messages : []
  const uniqueMessages = dedupeMessages(originalMessages)
  const batchSize = Math.max(Number(options.batchSize || DEFAULT_BATCH_SIZE), 1)
  let sent = 0
  let failed = 0

  for (let index = 0; index < uniqueMessages.length; index += batchSize) {
    const batch = uniqueMessages.slice(index, index + batchSize)
    const results = await Promise.all(batch.map((message) => (
      safeSendSubscribeMessage(cloud, message, options)
    )))
    sent += results.filter((item) => item.success).length
    failed += results.filter((item) => !item.success && !item.skipped).length
  }

  return {
    total: uniqueMessages.length,
    sent,
    failed,
    skipped: originalMessages.length - uniqueMessages.length
  }
}

module.exports = {
  TEMPLATE_IDS,
  SUBSCRIBE_LOG_COLLECTION,
  shouldSendTaskPublishedMessage,
  buildTaskSubmittedMessage,
  buildTaskPublishedMessage,
  buildSubmissionReviewedMessage,
  safeRecordSubscribeMessage,
  safeSendSubscribeMessage,
  safeSendSubscribeMessages
}
