const POINTS_LOG_COLLECTION = 'points_log'

const POINTS_SOURCE = {
  REGISTER_GIFT: 'register_gift',      // 注册赠送
  TASK_REWARD: 'task_reward',          // 任务审核通过奖励
  ADMIN_GRANT: 'admin_grant',          // 管理员手动增加
  ADMIN_DEDUCT: 'admin_deduct',        // 管理员手动扣除
  ADMIN_ADJUST: 'admin_adjust',        // 管理员修改积分
  LOTTERY_COST: 'lottery_cost',        // 抽奖消耗（预留）
  ROLLBACK: 'rollback'                 // 积分回滚
}

const POINTS_TYPE = {
  INCOME: 'income',    // 收入
  EXPENSE: 'expense'   // 支出
}

async function addPointsLog(dbOrTx, options) {
  const {
    user_openid,
    type,
    amount,
    before_points,
    after_points,
    source,
    source_id = '',
    remark = '',
    operator_openid = 'system'
  } = options

  if (!user_openid || !type || !amount || amount <= 0) {
    console.warn('addPointsLog: 参数不完整或积分数量无效', options)
    return
  }

  try {
    const createTime = typeof dbOrTx.serverDate === 'function' ? dbOrTx.serverDate() : new Date()
    await dbOrTx.collection(POINTS_LOG_COLLECTION).add({
      data: {
        user_openid,
        type,
        amount: Math.abs(amount),
        before_points: before_points || 0,
        after_points: after_points || 0,
        source,
        source_id: source_id || '',
        remark: remark || '',
        operator_openid: operator_openid || 'system',
        create_time: createTime
      }
    })
  } catch (err) {
    console.error('addPointsLog: 记录积分变动失败', err)
  }
}

module.exports = {
  POINTS_LOG_COLLECTION,
  POINTS_SOURCE,
  POINTS_TYPE,
  addPointsLog
}
