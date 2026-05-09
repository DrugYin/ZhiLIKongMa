const AuthService = require('../../../services/auth')
const RankingService = require('../../../services/ranking')

Page({
  data: {
    loading: true,
    scrollTop: 0,
    isLoggedIn: false,
    errorText: '',
    rankType: 'week',
    userInfo: {},
    rankTitle: '本周学习榜',
    rankDesc: '查看不同时间维度下的学习表现，确认自己当前所处位置。',
    summary: {
      participantCount: 0,
      myRankText: '未上榜',
      myPoints: 0
    },
    topThree: [],
    displayRanks: [],
    currentUserCard: null
  },

  onLoad() {
    this.loadRankData()
  },

  onTabsChange(e) {
    this.setData(
      {
        rankType: e.detail.value
      },
      () => {
        this.loadRankData()
      }
    )
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'student' })
      tabBar.init('/pages/student/rank/rank')
    }

    if (this._pageReady) {
      this.loadRankData()
    }
  },

  onPullDownRefresh() {
    this.loadRankData()
  },

  onScroll(e) {
    if (this._scrollingToTop) return
    if (this._scrollTimer) return
    const scrollTop = e.detail.scrollTop
    this._scrollTimer = setTimeout(() => {
      this._scrollTimer = null
      if (!this._scrollingToTop) {
        this.setData({ scrollTop })
      }
    }, 200)
  },

  onBackToTop() {
    this._scrollingToTop = true
    clearTimeout(this._scrollTimer)
    this._scrollTimer = null
    this.setData({ scrollTop: 0 }, () => {
      setTimeout(() => { this._scrollingToTop = false }, 500)
    })
  },

  async loadRankData() {
    const userInfo = AuthService.getLocalUserInfo() || {}
    const isLoggedIn = AuthService.isLoggedIn()

    this.setData({
      loading: true,
      isLoggedIn,
      errorText: '',
      userInfo,
      rankTitle: this.getRankTitle(this.data.rankType),
      rankDesc: this.getRankDesc(this.data.rankType)
    })

    if (!isLoggedIn) {
      this.setData({
        loading: false,
        topThree: [],
        displayRanks: [],
        currentUserCard: null,
        summary: {
          participantCount: 0,
          myRankText: '未登录',
          myPoints: 0
        }
      })
      wx.stopPullDownRefresh()
      return
    }

    try {
      const rankRes = await RankingService.getRanking({
        rank_type: this.data.rankType
      })
      const rankingList = this.formatRankingList(rankRes.list || [])
      const currentUserCard = rankingList.find((item) => item.isCurrentUser) || null

      this.setData({
        topThree: rankingList.slice(0, 3),
        displayRanks: rankingList.slice(3),
        currentUserCard,
        summary: {
          participantCount: Number(rankRes.participant_count || rankingList.length || 0),
          myRankText: currentUserCard ? `第 ${currentUserCard.rank} 名` : '未上榜',
          myPoints: currentUserCard ? currentUserCard.points : 0
        }
      })
      this._pageReady = true
    } catch (error) {
      console.error('[student-rank] loadRankData error:', error)
      this.setData({
        topThree: [],
        displayRanks: [],
        currentUserCard: null,
        errorText: error.message || '排行榜加载失败',
        summary: {
          participantCount: 0,
          myRankText: '加载失败',
          myPoints: 0
        }
      })
    } finally {
      this.setData({
        loading: false
      })
      wx.stopPullDownRefresh()
    }
  },

  getRankTitle(rankType) {
    if (rankType === 'month') {
      return '本月成长榜'
    }

    if (rankType === 'total') {
      return '总榜表现'
    }

    return '本周学习榜'
  },

  getRankDesc(rankType) {
    if (rankType === 'month') {
      return '适合观察阶段性表现，看看自己在本月训练中的稳定度。'
    }

    if (rankType === 'total') {
      return '累计积分与长期完成情况都会影响总榜排名。'
    }

    return '周榜会更强调最近的学习节奏，适合快速判断当前状态。'
  },

  formatRankingList(list = []) {
    return (Array.isArray(list) ? list : []).map((item, index) => ({
      ...item,
      name: item.name || '未命名同学',
      grade: item.grade || '待完善',
      trend: item.trend_text || this.getTrendText(item),
      badgeText: this.getBadgeText(item.points, this.data.rankType, item.task_count),
      isCurrentUser: Boolean(item.is_current_user),
      rankClass: index < 3 ? `rank-top-${index + 1}` : ''
    }))
  },

  getBadgeText(points, pointKey, taskCount = 0) {
    if (pointKey === 'week') {
      if (points >= 100) {
        return '本周冲刺'
      }
      return taskCount >= 1 ? '本周活跃' : '等待突破'
    }

    if (pointKey === 'month') {
      return points >= 200 ? '月度优选' : '持续积累'
    }

    return points >= 500 ? '长期领先' : '成长进行中'
  },

  getTrendText(item = {}) {
    if (this.data.rankType === 'total') {
      return Number(item.points || 0) > 0 ? '累计积分持续增长' : '等待首次积分入榜'
    }

    if (Number(item.task_count || 0) >= 3) {
      return '任务完成率较高'
    }

    if (Number(item.task_count || 0) >= 1) {
      return '本期保持活跃'
    }

    return this.data.rankType === 'month' ? '本月继续加油' : '本周继续冲刺'
  },

  goLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  onShareAppMessage() {
    return {
      title: '智力控码排行榜',
      path: '/pages/student/rank/rank'
    }
  }
})
