const cloud = require('wx-server-sdk')
const { success, failure } = require('/opt/response')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const PAGE_SIZE = 100
const RANK_TYPES = ['week', 'month', 'total']
const CHINA_UTC_OFFSET_HOURS = 8

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
    review_time: _.gte(start).and(_.lte(end))
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

function getChinaNow() {
  return new Date(Date.now() + CHINA_UTC_OFFSET_HOURS * 60 * 60 * 1000)
}

function createChinaDate(year, monthIndex, day, hour = 0, minute = 0, second = 0, millisecond = 0) {
  return new Date(Date.UTC(year, monthIndex, day, hour - CHINA_UTC_OFFSET_HOURS, minute, second, millisecond))
}

function formatChinaDateTime(date) {
  const chinaDate = new Date(date.getTime() + CHINA_UTC_OFFSET_HOURS * 60 * 60 * 1000)
  const year = chinaDate.getUTCFullYear()
  const month = `${chinaDate.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${chinaDate.getUTCDate()}`.padStart(2, '0')
  const hour = `${chinaDate.getUTCHours()}`.padStart(2, '0')
  const minute = `${chinaDate.getUTCMinutes()}`.padStart(2, '0')
  const second = `${chinaDate.getUTCSeconds()}`.padStart(2, '0')
  const millisecond = `${chinaDate.getUTCMilliseconds()}`.padStart(3, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}.${millisecond}`
}

function formatChinaDate(date) {
  return formatChinaDateTime(date).slice(0, 10)
}

function getWeekRange() {
  const now = getChinaNow()
  const year = now.getUTCFullYear()
  const monthIndex = now.getUTCMonth()
  const currentDate = now.getUTCDate()
  const day = now.getUTCDay()
  // 周六作为周的第一天: 周六 00:00:00 到周五 23:59:59.999
  const offset = (day + 1) % 7
  const start = createChinaDate(year, monthIndex, currentDate - offset, 0, 0, 0, 0)
  const end = createChinaDate(year, monthIndex, currentDate - offset + 6, 23, 59, 59, 999)
  console.log('[refresh-ranking-snapshots] WeekRange CST:', formatChinaDateTime(start), '-', formatChinaDateTime(end))
  console.log('[refresh-ranking-snapshots] WeekRange UTC:', start.toISOString(), '-', end.toISOString())
  return { start, end }
}

function getMonthRange() {
  const now = getChinaNow()
  const year = now.getUTCFullYear()
  const monthIndex = now.getUTCMonth()
  const start = createChinaDate(year, monthIndex, 1, 0, 0, 0, 0)
  const end = new Date(createChinaDate(year, monthIndex + 1, 1, 0, 0, 0, 0).getTime() - 1)
  console.log('[refresh-ranking-snapshots] MonthRange CST:', formatChinaDateTime(start), '-', formatChinaDateTime(end))
  console.log('[refresh-ranking-snapshots] MonthRange UTC:', start.toISOString(), '-', end.toISOString())
  return { start, end }
}

function buildPeriodRange(rankType) {
  if (rankType === 'month') {
    return getMonthRange()
  }

  return getWeekRange()
}

function buildPeriodMeta(rankType, range) {
  if (!range || !range.start || !range.end) {
    return null
  }

  const startText = formatChinaDate(range.start)
  const endText = formatChinaDate(range.end)
  const periodKey = rankType === 'month'
    ? startText.slice(0, 7)
    : `${startText}_${endText}`

  return {
    period_key: periodKey,
    period_start: range.start,
    period_end: range.end,
    period_start_text: startText,
    period_end_text: endText
  }
}

function buildScoreMap(submissions = []) {
  return submissions.reduce((result, item) => {
    const openid = String(item.student_openid || '').trim()
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

function buildRankList(users, rankType, scoreMap) {
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
        trend_text: buildTrendText(rankType, Number(scoreInfo.taskCount || 0), points),
        update_time: user.update_time || user.create_time || null
      }
    })
    .filter((item) => item.points > 0)
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

function buildSnapshotData(rankType, rankingList, generatedAt, periodMeta = null) {
  const snapshotData = {
    rank_type: rankType,
    participant_count: rankingList.length,
    top_three: rankingList.slice(0, 3),
    list: rankingList,
    generated_at: generatedAt,
    update_time: generatedAt
  }

  if (periodMeta) {
    Object.assign(snapshotData, periodMeta)
  }

  return snapshotData
}

function buildPeriodSnapshotId(rankType, periodMeta) {
  return `${rankType}_${periodMeta.period_key}`
}

async function saveSnapshot(rankType, rankingList, generatedAt, periodMeta = null) {
  const snapshotData = buildSnapshotData(rankType, rankingList, generatedAt, periodMeta)

  await db.collection('ranking_snapshots').doc(rankType).set({
    data: {
      ...snapshotData,
      snapshot_scope: 'current'
    }
  })

  if (!periodMeta || !['week', 'month'].includes(rankType)) {
    return [rankType]
  }

  const periodSnapshotId = buildPeriodSnapshotId(rankType, periodMeta)
  await db.collection('ranking_snapshots').doc(periodSnapshotId).set({
    data: {
      ...snapshotData,
      snapshot_scope: 'period',
      current_snapshot_id: rankType
    }
  })

  return [rankType, periodSnapshotId]
}

exports.main = async () => {
  try {
    const generatedAt = new Date()
    const users = await getAllUsers()
    const savedSnapshots = []

    for (const rankType of RANK_TYPES) {
      let scoreMap = {}
      let periodMeta = null

      if (rankType !== 'total') {
        const range = buildPeriodRange(rankType)
        const { start, end } = range
        const submissions = await getSubmissionsByRange(start, end)
        scoreMap = buildScoreMap(submissions)
        periodMeta = buildPeriodMeta(rankType, range)
      }

      const rankingList = buildRankList(users, rankType, scoreMap)
      const snapshotIds = await saveSnapshot(rankType, rankingList, generatedAt, periodMeta)
      savedSnapshots.push(...snapshotIds)
    }

    return success('排行榜快照刷新成功', {
      rank_types: RANK_TYPES,
      saved_snapshots: savedSnapshots,
      generated_at: generatedAt
    })
  } catch (error) {
    console.error('[refresh-ranking-snapshots] Error:', error)
    return failure('排行榜快照刷新失败', 500, {
      error: error.message
    })
  }
}
