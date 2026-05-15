const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const { DEFAULT_PRIZES } = require('/opt/prize-defaults')

exports.main = async () => {
  try {
    let prizes = []
    let source = 'database'

    try {
      const res = await db.collection('prizes')
        .where({ status: 'active', stock: db.command.gt(0) })
        .orderBy('sort_order', 'asc')
        .get()
      prizes = res.data || []
    } catch (dbError) {
      console.warn('[get-prizes] fallback to default prizes:', dbError.message)
    }

    if (!prizes.length) {
      prizes = DEFAULT_PRIZES
      source = 'default'
    }

    return {
      success: true,
      message: '获取奖品列表成功',
      data: {
        prizes,
        total: prizes.length
      },
      source
    }
  } catch (error) {
    console.error('[get-prizes] Error:', error)
    return {
      success: false,
      message: '获取奖品列表失败',
      error_code: 500
    }
  }
}
