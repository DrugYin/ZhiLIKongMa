const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

const DEFAULT_PRIZES = [
  {
    name: '精美笔记本',
    description: '限量版学习笔记本',
    image: '',
    type: 'physical',
    stock: 100,
    probability: 0.30,
    value: 50,
    status: 'active',
    sort_order: 1
  },
  {
    name: '积分大礼包',
    description: '50 积分奖励',
    image: '',
    type: 'points',
    stock: 999,
    probability: 0.40,
    value: 50,
    status: 'active',
    sort_order: 2
  },
  {
    name: '无人机体验课',
    description: '免费体验课一节',
    image: '',
    type: 'virtual',
    stock: 20,
    probability: 0.15,
    value: 200,
    status: 'active',
    sort_order: 3
  },
  {
    name: '编程教材',
    description: '编程入门教材一本',
    image: '',
    type: 'physical',
    stock: 30,
    probability: 0.10,
    value: 100,
    status: 'active',
    sort_order: 4
  },
  {
    name: '谢谢参与',
    description: '下次加油',
    image: '',
    type: 'virtual',
    stock: 999,
    probability: 0.05,
    value: 0,
    status: 'active',
    sort_order: 5
  }
]

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
