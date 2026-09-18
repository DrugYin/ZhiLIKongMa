const CHINA_UTC_OFFSET_HOURS = 8

function getChinaNow(now = new Date()) {
  return new Date(now.getTime() + CHINA_UTC_OFFSET_HOURS * 60 * 60 * 1000)
}

function createChinaDate(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day, -CHINA_UTC_OFFSET_HOURS))
}

function getWeekRange(now = new Date()) {
  const chinaNow = getChinaNow(now)
  const year = chinaNow.getUTCFullYear()
  const monthIndex = chinaNow.getUTCMonth()
  const currentDate = chinaNow.getUTCDate()
  const offset = (chinaNow.getUTCDay() + 1) % 7

  return {
    start: createChinaDate(year, monthIndex, currentDate - offset),
    end: createChinaDate(year, monthIndex, currentDate - offset + 7)
  }
}

function getTime(value) {
  if (!value) {
    return 0
  }
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function buildOverview(classes = [], taskCount = 0, pendingSubmissionCount = 0, pendingApplicationCount = 0) {
  return {
    class_count: classes.length,
    task_count: Number(taskCount || 0),
    student_count: classes.reduce((sum, item) => sum + Number(item && item.member_count || 0), 0),
    pending_submission_count: Number(pendingSubmissionCount || 0),
    pending_application_count: Number(pendingApplicationCount || 0)
  }
}

function buildRecentActivities({
  latestSubmission = null,
  latestApplication = null,
  latestTask = null,
  latestClass = null
} = {}) {
  const list = []

  if (latestSubmission) {
    list.push({
      id: `submission-${latestSubmission._id || latestSubmission.task_id || 'latest'}`,
      content: `${latestSubmission.student_name || '学生'}提交了“${latestSubmission.task_title || '未命名任务'}”，等待审核`,
      time_value: latestSubmission.submit_time || null
    })
  }

  if (latestApplication) {
    list.push({
      id: `application-${latestApplication._id || latestApplication.class_id || 'latest'}`,
      content: `${latestApplication.student_name || '学生'}申请加入班级“${latestApplication.class_name || '未命名班级'}”`,
      time_value: latestApplication.create_time || latestApplication.update_time || null
    })
  }

  if (latestTask) {
    list.push({
      id: `task-${latestTask._id || 'latest'}`,
      content: `任务“${latestTask.title || '未命名任务'}”最近有更新`,
      time_value: latestTask.update_time || latestTask.create_time || null
    })
  }

  if (latestClass) {
    list.push({
      id: `class-${latestClass._id || 'latest'}`,
      content: `班级“${latestClass.class_name || '未命名班级'}”当前共有 ${Number(latestClass.member_count || 0)} 名成员`,
      time_value: latestClass.update_time || latestClass.create_time || null
    })
  }

  return list
    .sort((left, right) => getTime(right.time_value) - getTime(left.time_value))
    .slice(0, 4)
}

function sanitizeUser(user = {}) {
  return {
    _id: user._id,
    user_name: user.user_name || user.nick_name || '',
    avatar_url: user.avatar_url || '',
    school: user.school || '',
    grade: user.grade || '',
    roles: Array.isArray(user.roles) ? user.roles : [],
    current_role: user.current_role || 'teacher',
    points: Number(user.points || 0),
    total_points: Number(user.total_points || user.points || 0),
    teacher_subject: user.teacher_subject || '',
    teacher_project: user.teacher_project || ''
  }
}

module.exports = {
  buildOverview,
  buildRecentActivities,
  getWeekRange,
  sanitizeUser
}
