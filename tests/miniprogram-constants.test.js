const assert = require('assert')

const {
  PRIZE_TYPE_TEXT,
  DRAW_RECORD_STATUS_TEXT
} = require('../miniprogram/utils/constant')

assert.deepStrictEqual(PRIZE_TYPE_TEXT, {
  physical: '实物',
  virtual: '虚拟',
  points: '积分'
})

assert.deepStrictEqual(DRAW_RECORD_STATUS_TEXT, {
  drawn: '已抽中',
  claimed: '已领取',
  expired: '已过期'
})
