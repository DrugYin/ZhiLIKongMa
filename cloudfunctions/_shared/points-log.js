/**
 * 积分变动日志工具模块
 * 用于记录所有积分变动明细
 */

const POINTS_LOG_COLLECTION = 'points_log'

// 积分来源枚举
const POINTS_SOURCE = {
  REGISTER_GIFT: 'register_gift',      // 注册赠送
  TASK_REWARD: 'task_reward',          // 任务审核通过奖励
  ADMIN_GRANT: 'admin_grant',          // 管理员手动增加
  ADMIN_DEDUCT: 'admin_deduct',        // 管理员手动扣除
  ADMIN_ADJUST: 'admin_adjust',        // 管理员修改积分
  LOTTERY_COST: 'lottery_cost',        // 抽奖消耗（预留）
  ROLLBACK: 'rollback'                 // 积分回滚
}

// 积分变动类型
const POINTS_TYPE = {
  INCOME: 'income',    // 收入
  EXPENSE: 'expense'   // 支出
}

/**
 * 记录积分变动
 * @param {Object} db - 数据库实例
 * @param {Object} options - 积分变动参数
 * @param {string} options.user_openid - 用户 openid
 * @param {string} options.type - 变动类型：income/expense
 * @param {number} options.amount - 变动积分数量（正数）
 * @param {number} options.before_points - 变动前积分
 * @param {number} options.after_points - 变动后积分
 * @param {string} options.source - 来源标识
 * @param {string} [options.source_id] - 关联记录ID
 * @param {string} [options.remark] - 备注说明
 * @param {string} [options.operator_openid] - 操作人 openid
 */
async function addPointsLog(db, options) {
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
    await db.collection(POINTS_LOG_COLLECTION).add({
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
        create_time: db.serverDate()
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
