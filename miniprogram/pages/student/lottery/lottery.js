const { lotteryApi } = require('../../../services/api')
const { getUserInfo } = require('../../../services/storage')

Page({
  data: {
    loading: true,
    prizes: [],
    userPoints: 0,
    costPoints: 10,
    dailyLimit: 5,
    todayCount: 0,
    drawing: false,
    showResult: false,
    resultPrize: null,
    resultInfo: {},
    errorMsg: ''
  },

  async onLoad() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'student' })
    }
  },

  async onShow() {
    await this.refreshAll()
  },

  async refreshAll() {
    this.setData({ loading: true, errorMsg: '' })
    try {
      const user = getUserInfo()
      this.setData({ userPoints: Number(user?.points || 0) })

      const [prizesRes] = await Promise.all([
        lotteryApi.getPrizes()
      ])

      if (prizesRes.success && prizesRes.data) {
        this.setData({ prizes: prizesRes.data.prizes || [] })
      }
    } catch (e) {
      console.error('[lottery] refresh error:', e)
      this.setData({ errorMsg: '加载失败，请下拉刷新' })
    } finally {
      this.setData({ loading: false })
    }
  },

  getRemainingDraws() {
    return Math.max(this.data.dailyLimit - this.data.todayCount, 0)
  },

  getDisabledReason() {
    if (this.data.loading) return 'loading'
    if (!this.data.prizes.length) return 'no_prizes'
    if (this.data.userPoints < this.data.costPoints) return 'no_points'
    if (this.getRemainingDraws() <= 0) return 'limit'
    return ''
  },

  onDrawTap() {
    if (this.data.drawing) return
    const reason = this.getDisabledReason()
    if (reason) {
      const map = {
        no_prizes: '暂无可用奖品',
        no_points: `积分不足，需要 ${this.data.costPoints} 积分`,
        limit: `今日次数已用完（每日 ${this.data.dailyLimit} 次）`
      }
      if (map[reason]) {
        wx.showToast({ title: map[reason], icon: 'none' })
      }
      return
    }

    this.doDraw()
  },

  async doDraw() {
    this.setData({ drawing: true })

    try {
      const res = await lotteryApi.startDraw()
      if (!res.success) {
        wx.showToast({ title: res.message || '抽奖失败', icon: 'none' })
        if (res.error_code === 4001 || res.error_code === 4002 || res.error_code === 5002) {
          await this.refreshAll()
        }
        return
      }

      const result = res.data
      const wheel = this.selectComponent('#wheel')
      if (wheel) {
        const targetIndex = this.data.prizes.findIndex(p => p._id === result.prize._id)
        this._pendingResult = result
        wheel.startSpin(targetIndex >= 0 ? targetIndex : 0)
      } else {
        this.showResult(result)
      }
    } catch (e) {
      console.error('[lottery] draw error:', e)
      wx.showToast({ title: '抽奖失败，请重试', icon: 'none' })
      this.setData({ drawing: false })
    }
  },

  onWheelResult(e) {
    const result = this._pendingResult
    this._pendingResult = null
    this.setData({ drawing: false })
    if (result) {
      this.showResult(result)
    }
  },

  showResult(result) {
    this.setData({
      userPoints: result.points_after,
      todayCount: this.data.todayCount + 1,
      resultPrize: result.prize,
      resultInfo: {
        name: result.prize.name,
        points_cost: result.points_cost,
        points_before: result.points_before,
        points_after: result.points_after
      },
      showResult: true
    })
  },

  onCloseResult() {
    this.setData({ showResult: false })
    this.refreshAll()
  },

  goToRecords() {
    wx.navigateTo({ url: '/pages/student/lottery/draw-records' })
  },

  goToPointsLog() {
    wx.navigateTo({ url: '/pages/student/points-log/points-log' })
  }
})
