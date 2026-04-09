const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const PAGE_SIZE = 100
const ALLOWED_RANK_TYPES = new Set(['week', 'month', 'total'])

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizeRankType(value) {
  const rankType = normalizeString(value)
  return ALLOWED_RANK_TYPES.has(rankType) ? rankType : 'week'
}

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get()
  return res.data[0] || null
}

async function getAllUsers() {
  const totalRes = await db.collection('users').count()
  const total = totalRes.total || 0
  const tasks = []

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      db.collection('users')
        .skip(skip)
        .limit(PAGE_SIZE)
        .field({
          _openid: true,
          user_name: true,
          nick_name: true,
          avatar_url: true,
          grade: true,
          roles: true,
          status: true,
          points: true,
          total_points: true,
          update_time: true,
          create_time: true
        })
        .get()
    )
  }

  if (!tasks.length) {
    return []
  }

  const list = await Promise.all(tasks)
  return list.reduce((result, item) => result.concat(item.data || []), [])
}

async function getSubmissionsByRange(start, end) {
  const query = db.collection('submissions').where({
    status: 'approved',
    review_time: _.gte(start).and(_.lt(end))
  })
  const totalRes = await query.count()
  const total = totalRes.total || 0
  const tasks = []

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      query
        .skip(skip)
        .limit(PAGE_SIZE)
        .field({
          student_openid: true,
          points_earned: true,
          review_time: true,
          task_id: true
        })
        .get()
    )
  }

  if (!tasks.length) {
    return []
  }

  const list = await Promise.all(tasks)
  return list.reduce((result, item) => result.concat(item.data || []), [])
}

function getWeekRange() {
  const start = new Date()
  const day = start.getDay()
  const offset = (day + 1) % 7
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - offset)

  const end = new Date(start)
  end.setDate(end.getDate() + 7)

  return { start, end }
}

function getMonthRange() {
  const start = new Date()
  start.setDate(1)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)

  return { start, end }
}

function buildPeriodRange(rankType) {
  if (rankType === 'month') {
    return getMonthRange()
  }

  return getWeekRange()
}

function buildScoreMap(submissions = []) {
  return submissions.reduce((result, item) => {
    const openid = normalizeString(item.student_openid)
    if (!openid) {
      return result
    }

    if (!result[openid]) {
      result[openid] = {
        points: 0,
        taskCount: 0
      }
    }

    result[openid].points += Number(item.points_earned || 0)
    result[openid].taskCount += 1
    return result
  }, {})
}

function isStudent(user) {
  return user
    && Array.isArray(user.roles)
    && user.roles.includes('student')
    && user.status !== 'disabled'
}

function buildTrendText(rankType, taskCount, points) {
  if (rankType === 'total') {
    return points > 0 ? '累计积分持续增长' : '等待首次积分入榜'
  }

  if (taskCount >= 3) {
    return '任务完成率较高'
  }

  if (taskCount >= 1) {
    return '本期保持活跃'
  }

  return rankType === 'month' ? '本月继续加油' : '本周继续冲刺'
}

function buildRankList(users, currentUser, rankType, scoreMap) {
  return users
    .filter(isStudent)
    .map((user) => {
      const scoreInfo = scoreMap[user._openid] || { points: 0, taskCount: 0 }
      const points = rankType === 'total'
        ? Number(user.total_points || user.points || 0)
        : Number(scoreInfo.points || 0)

      return {
        _openid: user._openid,
        name: user.user_name || user.nick_name || '未命名同学',
        grade: user.grade || '待完善',
        avatar_url: user.avatar_url || '',
        points,
        task_count: rankType === 'total' ? 0 : Number(scoreInfo.taskCount || 0),
        total_points: Number(user.total_points || user.points || 0),
        is_current_user: currentUser && user._openid === currentUser._openid,
        trend_text: buildTrendText(rankType, Number(scoreInfo.taskCount || 0), points),
        update_time: user.update_time || user.create_time || null
      }
    })
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points
      }

      if (right.total_points !== left.total_points) {
        return right.total_points - left.total_points
      }

      const leftTime = left.update_time ? new Date(left.update_time).getTime() : 0
      const rightTime = right.update_time ? new Date(right.update_time).getTime() : 0
      return rightTime - leftTime
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1
    }))
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const currentUser = await getCurrentUser(OPENID)

    if (!currentUser) {
      return {
        success: false,
        message: '请先完成注册',
        error_code: 401
      }
    }

    const rankType = normalizeRankType(event.rank_type)
    const users = await getAllUsers()
    let scoreMap = {}

    if (rankType !== 'total') {
      const { start, end } = buildPeriodRange(rankType)
      const submissions = await getSubmissionsByRange(start, end)
      scoreMap = buildScoreMap(submissions)
    }

    const rankingList = buildRankList(users, currentUser, rankType, scoreMap)
    const currentUserCard = rankingList.find((item) => item.is_current_user) || null

    return {
      success: true,
      message: '获取排行榜成功',
      data: {
        rank_type: rankType,
        participant_count: rankingList.length,
        current_user: currentUserCard,
        top_three: rankingList.slice(0, 3),
        list: rankingList
      }
    }
  } catch (error) {
    console.error('[get-ranking] Error:', error)
    return {
      success: false,
      message: '获取排行榜失败',
      error: error.message,
      error_code: 500
    }
  }
}
