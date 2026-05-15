const cloud = require('wx-server-sdk')
const { getCurrentUser } = require('/opt/auth')
const { POINTS_SOURCE } = require('/opt/points-log')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const TRANSACTION_RETRY_LIMIT = 3

async function getConfigValue(key, defaultValue) {
  try {
    const res = await db.collection('system_config')
      .where({ config_key: key })
      .get()
    if (res.data.length > 0) {
      return res.data[0].config_value
    }
  } catch (e) {
    console.log(`[start-draw] 获取 ${key} 失败，使用默认值:`, e.message)
  }
  return defaultValue
}

async function getTodayDrawCount(openid) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const res = await db.collection('draw_records')
    .where({
      student_openid: openid,
      create_time: db.command.gte(today).and(db.command.lt(tomorrow))
    })
    .count()
  return res.total
}

function selectPrize(prizes) {
  if (!prizes.length) return null

  const totalProb = prizes.reduce((sum, p) => sum + (Number(p.probability) || 0), 0)
  if (totalProb <= 0) return prizes[0]

  const rand = Math.random() * totalProb
  let accumulated = 0
  for (const prize of prizes) {
    accumulated += Number(prize.probability) || 0
    if (rand < accumulated) {
      return prize
    }
  }
  return prizes[prizes.length - 1]
}

function isTransactionConflictError(error) {
  const message = String(error && (error.message || error.errMsg || error) || '').toLowerCase()
  return message.includes('conflict')
    || message.includes('写冲突')
    || (message.includes('transaction') && message.includes('abort'))
}

async function executeDraw(openid, user, prize, costPoints, now) {
  for (let attempt = 1; attempt <= TRANSACTION_RETRY_LIMIT; attempt += 1) {
    let transaction = null

    try {
      transaction = await db.startTransaction()

      const userRef = transaction.collection('users').doc(user._id)
      const userRes = await userRef.get()
      const currentUser = userRes.data

      if (!currentUser) {
        throw new Error('用户不存在')
      }

      const currentPoints = Number(currentUser.points) || 0
      if (currentPoints < costPoints) {
        throw Object.assign(new Error('积分不足'), { error_code: 4001 })
      }

      const afterPoints = currentPoints - costPoints

      await userRef.update({
        data: {
          points: afterPoints,
          update_time: now
        }
      })

      await transaction.collection('prizes').doc(prize._id).update({
        data: {
          stock: db.command.inc(-1),
          update_time: now
        }
      })

      const drawRecordRes = await transaction.collection('draw_records').add({
        data: {
          student_openid: openid,
          student_name: currentUser.user_name || currentUser.nick_name || '',
          prize_id: prize._id,
          prize_name: prize.name,
          prize_image: prize.image || '',
          prize_type: prize.type || 'virtual',
          prize_value: Number(prize.value) || 0,
          points_cost: costPoints,
          status: 'drawn',
          create_time: now,
          update_time: now
        }
      })

      await transaction.collection('points_log').add({
        data: {
          user_openid: openid,
          type: 'expense',
          amount: costPoints,
          before_points: currentPoints,
          after_points: afterPoints,
          source: POINTS_SOURCE.LOTTERY_COST,
          source_id: drawRecordRes._id,
          remark: `抽奖消耗 - ${prize.name}`,
          operator_openid: 'system',
          create_time: now
        }
      })

      await transaction.commit()

      return {
        prize: {
          _id: prize._id,
          name: prize.name,
          image: prize.image || '',
          type: prize.type || 'virtual',
          value: Number(prize.value) || 0
        },
        points_before: currentPoints,
        points_after: afterPoints,
        points_cost: costPoints
      }
    } catch (error) {
      if (transaction) {
        try {
          await transaction.rollback()
        } catch (rollbackError) {
          console.error('[start-draw] rollback error:', rollbackError)
        }
      }

      if (error.error_code) {
        throw error
      }

      if (!isTransactionConflictError(error) || attempt >= TRANSACTION_RETRY_LIMIT) {
        throw error
      }
    }
  }

  throw new Error('抽奖人数较多，请稍后重试')
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()

  try {
    const user = await getCurrentUser(db, OPENID)
    if (!user) {
      return {
        success: false,
        message: '请先登录',
        error_code: 401
      }
    }

    if (!Array.isArray(user.roles) || !user.roles.includes('student')) {
      return {
        success: false,
        message: '仅学生可以参与抽奖',
        error_code: 403
      }
    }

    const lotteryEnabled = await getConfigValue('lottery_enabled', true)
    if (!lotteryEnabled) {
      return {
        success: false,
        message: '抽奖活动暂未开放',
        error_code: 5001
      }
    }

    const costPoints = Number(await getConfigValue('lottery_cost_points', 10))
    const dailyLimit = Number(await getConfigValue('lottery_daily_limit', 5))

    const currentPoints = Number(user.points) || 0
    if (currentPoints < costPoints) {
      return {
        success: false,
        message: `积分不足，需要 ${costPoints} 积分`,
        error_code: 4001
      }
    }

    const todayCount = await getTodayDrawCount(OPENID)
    if (todayCount >= dailyLimit) {
      return {
        success: false,
        message: `今日抽奖次数已用完（每日上限 ${dailyLimit} 次）`,
        error_code: 5002
      }
    }

    const prizesRes = await db.collection('prizes')
      .where({ status: 'active', stock: db.command.gt(0) })
      .get()
    const availablePrizes = prizesRes.data || []

    if (!availablePrizes.length) {
      return {
        success: false,
        message: '暂无可用奖品',
        error_code: 5003
      }
    }

    const selectedPrize = selectPrize(availablePrizes)
    if (!selectedPrize) {
      return {
        success: false,
        message: '抽奖失败，请重试',
        error_code: 500
      }
    }

    const now = new Date()
    const result = await executeDraw(OPENID, user, selectedPrize, costPoints, now)

    return {
      success: true,
      message: '抽奖成功',
      data: result
    }
  } catch (error) {
    console.error('[start-draw] Error:', error)
    if (error.error_code) {
      return {
        success: false,
        message: error.message || '抽奖失败',
        error_code: error.error_code
      }
    }
    return {
      success: false,
      message: '抽奖失败，请稍后重试',
      error_code: 500
    }
  }
}
