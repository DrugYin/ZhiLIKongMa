const cloud = require('wx-server-sdk')
const { getCurrentUser } = require('/opt/auth')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const PAGE_SIZE = 20

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()

  try {
    const user = await getCurrentUser(db, OPENID)
    if (!user) {
      return {
        success: false,
        message: '请先完成注册',
        error_code: 401
      }
    }

    const page = Math.max(Number(event.page) || 1, 1)
    const pageSize = Math.min(Number(event.page_size) || PAGE_SIZE, 100)

    let todayCount = null
    if (event.count_today) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const todayCountRes = await db.collection('draw_records')
        .where({
          student_openid: OPENID,
          create_time: db.command.gte(today).and(db.command.lt(tomorrow))
        })
        .count()
      todayCount = todayCountRes.total
    }

    const totalRes = await db.collection('draw_records')
      .where({ student_openid: OPENID })
      .count()

    const res = await db.collection('draw_records')
      .where({ student_openid: OPENID })
      .orderBy('create_time', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    const list = (res.data || []).map(item => ({
      _id: item._id,
      prize_name: item.prize_name,
      prize_image: item.prize_image,
      prize_type: item.prize_type,
      prize_value: item.prize_value,
      points_cost: item.points_cost,
      status: item.status,
      is_redeemed: item.is_redeemed || false,
      redeem_id: item.redeem_id || '',
      redeem_time: item.redeem_time || null,
      create_time: item.create_time
    }))

    const result = {
      list,
      total: totalRes.total,
      page,
      page_size: pageSize,
      has_more: page * pageSize < totalRes.total
    }

    if (todayCount !== null) {
      result.today_count = todayCount
    }

    return {
      success: true,
      message: '获取抽奖记录成功',
      data: result
    }
  } catch (error) {
    console.error('[get-draw-records] Error:', error)
    return {
      success: false,
      message: '获取抽奖记录失败',
      error_code: 500
    }
  }
}
