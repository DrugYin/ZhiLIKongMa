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

function getTaskTime(task = {}) {
  const value = task.publish_time || task.create_time || task.update_time || task.deadline
  const time = value ? new Date(value).getTime() : 0
  return Number.isNaN(time) ? 0 : time
}

function buildWeeklyRank(snapshot = {}, openid = '') {
  const list = Array.isArray(snapshot.list) ? snapshot.list : []
  const currentUser = list.find((item) => item && item._openid === openid) || null
  const rank = Number(currentUser && currentUser.rank || 0)

  return {
    rank,
    text: rank > 0 ? `第 ${rank} 名` : '未上榜',
    participant_count: Number(snapshot.participant_count || list.length || 0)
  }
}

function buildWeeklyTask(tasks = [], submissions = [], now = new Date()) {
  const submittedTaskIds = new Set(
    submissions.map((item) => item && item.task_id).filter(Boolean)
  )
  const nowTime = now.getTime()
  const sortedTasks = tasks
    .filter((item) => {
      if (!item || !item.deadline) {
        return Boolean(item)
      }
      const deadlineTime = new Date(item.deadline).getTime()
      return Number.isNaN(deadlineTime) || deadlineTime >= nowTime
    })
    .sort((left, right) => getTaskTime(right) - getTaskTime(left))
  const latestPendingTask = sortedTasks.find((item) => item && !submittedTaskIds.has(item._id)) || null

  return {
    total: sortedTasks.length,
    submitted: sortedTasks.filter((item) => item && submittedTaskIds.has(item._id)).length,
    latest_pending_task: latestPendingTask
  }
}

function sanitizeUser(user = {}) {
  return {
    _id: user._id,
    user_name: user.user_name || user.nick_name || '',
    avatar_url: user.avatar_url || '',
    school: user.school || '',
    grade: user.grade || '',
    roles: Array.isArray(user.roles) ? user.roles : [],
    current_role: user.current_role || 'student',
    points: Number(user.points || 0),
    total_points: Number(user.total_points || user.points || 0)
  }
}

module.exports = {
  buildWeeklyRank,
  buildWeeklyTask,
  getWeekRange,
  sanitizeUser
}
