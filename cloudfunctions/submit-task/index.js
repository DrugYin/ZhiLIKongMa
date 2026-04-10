const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const PAGE_SIZE = 100
const DEFAULT_MAX_SUBMISSIONS = 3
const TRANSACTION_RETRY_LIMIT = 3

async function getSubmissionCount(taskId, openid) {
  const res = await db.collection('submissions').where({
    task_id: taskId,
    student_openid: openid
  }).count()

  return res.total || 0
}

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get()
  return res.data[0] || null
}

async function getAllMembershipsByStudent(openid) {
  const totalRes = await db.collection('class_memberships').where({
    student_openid: openid
  }).count()
  const total = totalRes.total || 0
  const requests = []

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    requests.push(
      db.collection('class_memberships').where({
        student_openid: openid
      }).skip(skip).limit(PAGE_SIZE).field({
        class_id: true
      }).get()
    )
  }

  if (!requests.length) {
    return []
  }

  const list = await Promise.all(requests)
  return list.reduce((result, item) => result.concat(item.data || []), [])
}

async function getTaskById(taskId) {
  try {
    const res = await db.collection('tasks').doc(taskId).get()
    return res.data || null
  } catch (error) {
    return null
  }
}

async function getConfigValue(configKey, defaultValue) {
  try {
    const res = await db.collection('system_config').where({
      config_key: configKey
    }).limit(1).get()

    if (res.data.length > 0 && res.data[0].config_value !== undefined) {
      return res.data[0].config_value
    }
  } catch (error) {
    console.error('[submit-task] getConfigValue error:', error)
  }

  return defaultValue
}

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizeImages(images) {
  if (!Array.isArray(images)) {
    return []
  }

  return images.map((item) => normalizeString(item)).filter(Boolean)
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) {
    return []
  }

  return files.reduce((result, item) => {
    const fileId = normalizeString(item && item.file_id)
    if (!fileId) {
      return result
    }

    result.push({
      file_id: fileId,
      file_name: normalizeString(item.file_name),
      file_size: Math.max(Number(item.file_size || 0), 0)
    })
    return result
  }, [])
}

function canStudentAccessTask(task, joinedClassIds) {
  if (!task || task.is_deleted || task.status !== 'published') {
    return false
  }

  if (task.task_type === 'public') {
    return true
  }

  if (task.task_type === 'class' && task.visibility === 'public') {
    return true
  }

  return task.task_type === 'class'
    && task.visibility === 'class_only'
    && joinedClassIds.includes(task.class_id)
}

function buildDeadline(taskInfo = {}) {
  if (taskInfo.deadline) {
    const deadline = new Date(taskInfo.deadline)
    if (!Number.isNaN(deadline.getTime())) {
      return deadline
    }
  }

  const deadlineDate = normalizeString(taskInfo.deadline_date)
  const deadlineTime = normalizeString(taskInfo.deadline_time)
  if (!deadlineDate || !deadlineTime) {
    return null
  }

  const deadline = new Date(`${deadlineDate} ${deadlineTime}`)
  return Number.isNaN(deadline.getTime()) ? null : deadline
}

function buildSubmissionCounterId(taskId, openid) {
  return `submission_counter_${taskId}_${openid}`
}

function buildSubmissionId(taskId, openid, submitNo) {
  return `submission_${taskId}_${openid}_${submitNo}`
}

function createSubmissionLimitError(maxSubmissions) {
  const error = new Error(`当前任务最多可提交 ${maxSubmissions} 次`)
  error.error_code = 3003
  return error
}

function isSubmissionLimitError(error) {
  return Number(error && error.error_code) === 3003
}

function isTransactionConflictError(error) {
  const message = String(error && (error.message || error.errMsg || error) || '').toLowerCase()
  return message.includes('conflict')
    || message.includes('写冲突')
    || (message.includes('transaction') && message.includes('abort'))
}

async function writeOperationLog(openid, action, targetId, detail, now) {
  try {
    await db.collection('operation_logs').add({
      data: {
        user_openid: openid,
        user_type: 'student',
        action,
        target_type: 'submission',
        target_id: targetId,
        detail,
        create_time: now
      }
    })
  } catch (error) {
    console.error('[submit-task] writeOperationLog error:', error)
  }
}

async function createSubmissionWithTransaction({
  taskId,
  openid,
  user,
  taskInfo,
  description,
  images,
  files,
  now,
  isOvertime,
  maxSubmissions,
  initialSubmissionCount
}) {
  for (let attempt = 1; attempt <= TRANSACTION_RETRY_LIMIT; attempt += 1) {
    let transaction = null

    try {
      transaction = await db.startTransaction()
      const counterId = buildSubmissionCounterId(taskId, openid)
      const counterRef = transaction.collection('submission_counters').doc(counterId)
      let counterData = null

      try {
        const counterRes = await counterRef.get()
        counterData = counterRes.data || null
      } catch (error) {
        counterData = null
      }

      const currentCount = Number(
        counterData && counterData.count !== undefined
          ? counterData.count
          : initialSubmissionCount
      )
      if (currentCount >= maxSubmissions) {
        throw createSubmissionLimitError(maxSubmissions)
      }

      const submitNo = currentCount + 1
      const submissionId = buildSubmissionId(taskId, openid, submitNo)
      const submissionData = {
        task_id: taskId,
        task_title: taskInfo.title || '',
        project_code: taskInfo.project_code || '',
        project_name: taskInfo.project_name || '',
        student_openid: openid,
        student_name: user.user_name || user.nick_name || '',
        class_id: taskInfo.class_id || user.class_id || '',
        class_name: taskInfo.class_name || user.class_name || '',
        teacher_openid: taskInfo.teacher_openid || '',
        teacher_name: taskInfo.teacher_name || '',
        description,
        images,
        files,
        status: 'pending',
        score: null,
        feedback: '',
        feedback_images: [],
        feedback_files: [],
        is_overtime: isOvertime,
        points_earned: 0,
        submit_no: submitNo,
        submit_time: now,
        create_time: now,
        update_time: now
      }

      await transaction.collection('submissions').doc(submissionId).set({
        data: submissionData
      })

      const counterPayload = {
        task_id: taskId,
        student_openid: openid,
        count: submitNo,
        max_submissions: maxSubmissions,
        last_submission_id: submissionId,
        last_submit_time: now,
        update_time: now
      }

      if (counterData) {
        await counterRef.update({
          data: counterPayload
        })
      } else {
        await counterRef.set({
          data: {
            ...counterPayload,
            create_time: now
          }
        })
      }

      await transaction.commit()

      return {
        _id: submissionId,
        submitNo,
        submissionData
      }
    } catch (error) {
      if (transaction) {
        try {
          await transaction.rollback()
        } catch (rollbackError) {
          console.error('[submit-task] rollback error:', rollbackError)
        }
      }

      if (isSubmissionLimitError(error)) {
        throw error
      }

      if (!isTransactionConflictError(error) || attempt >= TRANSACTION_RETRY_LIMIT) {
        throw error
      }
    }
  }

  throw new Error('提交人数较多，请稍后重试')
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const taskId = normalizeString(event.task_id)
    const description = normalizeString(event.description)
    const images = normalizeImages(event.images)
    const files = normalizeFiles(event.files)

    if (!taskId) {
      return {
        success: false,
        message: '任务ID不能为空',
        error_code: 400
      }
    }

    if (!description && !images.length && !files.length) {
      return {
        success: false,
        message: '请至少填写提交说明、上传图片或附件中的一项',
        error_code: 400
      }
    }

    const user = await getCurrentUser(OPENID)
    if (!user) {
      return {
        success: false,
        message: '请先完成注册',
        error_code: 401
      }
    }

    if (!Array.isArray(user.roles) || !user.roles.includes('student')) {
      return {
        success: false,
        message: '仅学生可以提交任务',
        error_code: 403
      }
    }

    const taskInfo = await getTaskById(taskId)
    if (!taskInfo || taskInfo.is_deleted) {
      return {
        success: false,
        message: '任务不存在',
        error_code: 404
      }
    }

    const memberships = await getAllMembershipsByStudent(OPENID)
    const joinedClassIds = memberships.map((item) => item.class_id).filter(Boolean)

    if (user.class_id && !joinedClassIds.includes(user.class_id)) {
      joinedClassIds.push(user.class_id)
    }

    if (!canStudentAccessTask(taskInfo, joinedClassIds)) {
      return {
        success: false,
        message: '当前任务不可提交',
        error_code: 403
      }
    }

    const now = new Date()
    const configLimit = Number(await getConfigValue('task_max_submissions', DEFAULT_MAX_SUBMISSIONS))
    const maxSubmissions = Number(taskInfo.max_submissions || configLimit || DEFAULT_MAX_SUBMISSIONS)
    const initialSubmissionCount = await getSubmissionCount(taskId, OPENID)

    if (initialSubmissionCount >= maxSubmissions) {
      return {
        success: false,
        message: `当前任务最多可提交 ${maxSubmissions} 次`,
        error_code: 3003
      }
    }

    const deadline = buildDeadline(taskInfo)
    const isOvertime = Boolean(deadline && now.getTime() > deadline.getTime())
    const submitResult = await createSubmissionWithTransaction({
      taskId,
      openid: OPENID,
      user,
      taskInfo,
      description,
      images,
      files,
      now,
      isOvertime,
      maxSubmissions,
      initialSubmissionCount
    })

    await writeOperationLog(OPENID, 'submit_task', submitResult._id, {
      task_id: taskId,
      task_title: taskInfo.title || '',
      submit_no: submitResult.submitNo,
      is_overtime: isOvertime
    }, now)

    return {
      success: true,
      message: '提交任务成功',
      data: {
        _id: submitResult._id,
        ...submitResult.submissionData,
        total_submissions: submitResult.submitNo,
        max_submissions: maxSubmissions
      }
    }
  } catch (error) {
    if (isSubmissionLimitError(error)) {
      return {
        success: false,
        message: error.message,
        error_code: 3003
      }
    }

    console.error('[submit-task] Error:', error)
    return {
      success: false,
      message: '提交任务失败',
      error: error.message,
      error_code: 500
    }
  }
}
