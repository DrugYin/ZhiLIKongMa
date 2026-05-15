const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const PAGE_SIZE = 20

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()

  try {
    const page = Math.max(Number(event.page) || 1, 1)
    const pageSize = Math.min(Number(event.page_size) || PAGE_SIZE, 100)

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
      create_time: item.create_time
    }))

    return {
      success: true,
      message: '获取抽奖记录成功',
      data: {
        list,
        total: totalRes.total,
        page,
        page_size: pageSize,
        has_more: page * pageSize < totalRes.total
      }
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
