const cloud = require('wx-server-sdk')
const { verifyTeacherRole } = require('/opt/auth')
const { writeOperationLog } = require('/opt/operation-log')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const ALLOWED_STATUS = new Set(['approved', 'rejected'])

async function getSubmissionById(submissionId) {
  try {
    const res = await db.collection('submissions').doc(submissionId).get()
    return res.data || null
  } catch (error) {
    return null
  }
}

async function getTaskById(taskId) {
  try {
    const res = await db.collection('tasks').doc(taskId).get()
    return res.data || null
  } catch (error) {
    return null
  }
}

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizeStatus(value) {
  const status = normalizeString(value)
  return ALLOWED_STATUS.has(status) ? status : ''
}

function normalizeScore(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const score = Number(value)
  if (Number.isNaN(score) || score < 0) {
    return null
  }

  return score
}

function normalizePoints(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const points = Number(value)
  if (!Number.isInteger(points) || points < 0) {
    return null
  }

  return points
}

function normalizeImageList(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean)
}

function normalizeFileList(value) {
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
      file_size: Number(item.file_size || 0)
    })
    return result
  }, [])
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const teacher = await verifyTeacherRole(db, OPENID)
    const submissionId = normalizeString(event.submission_id)
    const status = normalizeStatus(event.status)
    const feedback = normalizeString(event.feedback)
    const score = normalizeScore(event.score)
    const customPoints = normalizePoints(event.points_earned)
    const feedbackImages = normalizeImageList(event.feedback_images)
    const feedbackFiles = normalizeFileList(event.feedback_files)

    if (!teacher) {
      return {
        success: false,
        message: '仅教师可以审核提交记录',
        error_code: 403
      }
    }

    if (!submissionId) {
      return {
        success: false,
        message: '提交记录ID不能为空',
        error_code: 400
      }
    }

    if (!status) {
      return {
        success: false,
        message: '审核状态不合法',
        error_code: 400
      }
    }

    const submissionInfo = await getSubmissionById(submissionId)

    if (!submissionInfo) {
      return {
        success: false,
        message: '提交记录不存在',
        error_code: 404
      }
    }

    if (submissionInfo.teacher_openid !== OPENID) {
      return {
        success: false,
        message: '无权审核该提交记录',
        error_code: 403
      }
    }

    if (submissionInfo.status !== 'pending') {
      return {
        success: false,
        message: '该提交记录已处理，无需重复审核',
        error_code: 400
      }
    }

    const taskInfo = await getTaskById(submissionInfo.task_id)
    if (!taskInfo || taskInfo.is_deleted) {
      return {
        success: false,
        message: '关联任务不存在',
        error_code: 404
      }
    }

    const now = new Date()
    const reviewFeedback = feedback || (status === 'approved'
      ? '完成的很好，继续保持！'
      : '当前提交未通过，请补充说明或附件后再次提交。')
    const pointsEarned = status === 'rejected'
      ? 0
      : (customPoints !== null
          ? customPoints
          : Number(taskInfo.points || submissionInfo.points_earned || 0))

    const updateData = {
      status,
      score,
      feedback: reviewFeedback,
      feedback_images: feedbackImages,
      feedback_files: feedbackFiles,
      review_time: now,
      review_teacher_openid: OPENID,
      review_teacher_name: teacher.user_name || teacher.nick_name || '',
      points_earned: pointsEarned,
      update_time: now
    }

    await db.collection('submissions').doc(submissionId).update({
      data: updateData
    })

    if (status === 'approved' && pointsEarned > 0) {
      await db.collection('users').where({
        _openid: submissionInfo.student_openid
      }).update({
        data: {
          points: _.inc(pointsEarned),
          total_points: _.inc(pointsEarned),
          update_time: now
        }
      })
    }

    await writeOperationLog(db, {
      openid: OPENID,
      userType: 'teacher',
      action: 'review_submission',
      targetType: 'submission',
      targetId: submissionId,
      detail: {
        task_id: submissionInfo.task_id,
        task_title: submissionInfo.task_title || '',
        student_openid: submissionInfo.student_openid,
        student_name: submissionInfo.student_name || '',
        status,
        score,
        points_earned: pointsEarned,
        feedback_image_count: feedbackImages.length,
        feedback_file_count: feedbackFiles.length
      },
      now,
      contextLabel: 'review-submission'
    })

    return {
      success: true,
      message: '审核提交记录成功',
      data: {
        ...submissionInfo,
        ...updateData,
        _id: submissionId
      }
    }
  } catch (error) {
    console.error('[review-submission] Error:', error)
    return {
      success: false,
      message: '审核提交记录失败',
      error: error.message,
      error_code: 500
    }
  }
}
