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

module.exports = { DEFAULT_PRIZES }
