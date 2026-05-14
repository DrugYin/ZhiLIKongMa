const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

const DEFAULT_CONFIG = {
  points_register_gift: 50,
  points_per_task: 10,
  points_daily_limit: 100,
  lottery_enabled: true,
  lottery_cost_points: 10,
  lottery_daily_limit: 5,
  class_max_members: 50,
  class_join_need_approval: true,
  task_max_submissions: 3,
  task_overtime_penalty: 0.5
}

exports.main = async () => {
  try {
    const res = await db.collection('system_config')
      .where({ is_enabled: true })
      .get()

    const configs = (res.data || []).map(item => ({
      key: item.config_key,
      value: item.config_value
    }))

    return {
      success: true,
      message: '获取系统配置成功',
      data: configs,
      defaults: DEFAULT_CONFIG
    }
  } catch (error) {
    console.error('[get-config] Error:', error)
    return {
      success: false,
      message: '获取系统配置失败',
      data: [],
      defaults: DEFAULT_CONFIG,
      error_code: 500
    }
  }
}
