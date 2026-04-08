const AuthService = require('../../../services/auth')

Page({
  data: {
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

  loadRankData() {
    const userInfo = AuthService.getLocalUserInfo() || {}
    const rankingList = this.buildRankings(this.data.rankType, userInfo)
    const currentUserCard = rankingList.find((item) => item.isCurrentUser) || null

    this.setData({
      userInfo,
      rankTitle: this.getRankTitle(this.data.rankType),
      rankDesc: this.getRankDesc(this.data.rankType),
      topThree: rankingList.slice(0, 3),
      displayRanks: rankingList.slice(3),
      currentUserCard,
      summary: {
        participantCount: rankingList.length,
        myRankText: currentUserCard ? `第 ${currentUserCard.rank} 名` : '未上榜',
        myPoints: currentUserCard ? currentUserCard.points : 0
      }
    })

    this._pageReady = true
    wx.stopPullDownRefresh()
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

  buildRankings(rankType, userInfo) {
    const displayName = userInfo.user_name || userInfo.userName || '你'
    const base = [
      { name: '赵昱睿', grade: '六年级', points: { week: 128, month: 420, total: 980 }, trend: '稳定推进' },
      { name: '兰光宸', grade: '初一', points: { week: 121, month: 405, total: 950 }, trend: '任务完成率高' },
      { name: '李雨桐', grade: '五年级', points: { week: 118, month: 386, total: 918 }, trend: '班级任务活跃' },
      { name: '陈知予', grade: '六年级', points: { week: 105, month: 358, total: 860 }, trend: '公开任务进步快' },
      { name: displayName, grade: userInfo.grade || '待完善', points: { week: 96, month: 330, total: Number(userInfo.points || 780) }, trend: '当前账号' },
      { name: '吴梓涵', grade: '初二', points: { week: 90, month: 315, total: 772 }, trend: '打卡稳定' },
      { name: '周若溪', grade: '四年级', points: { week: 84, month: 288, total: 720 }, trend: '最近状态回升' }
    ]

    const pointKey = rankType === 'month' ? 'month' : rankType === 'total' ? 'total' : 'week'

    return base
      .map((item) => ({
        ...item,
        points: item.points[pointKey],
        isCurrentUser: item.name === displayName,
        badgeText: this.getBadgeText(item.points[pointKey], pointKey)
      }))
      .sort((left, right) => right.points - left.points)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
        rankClass: index < 3 ? `rank-top-${index + 1}` : ''
      }))
  },

  getBadgeText(points, pointKey) {
    if (pointKey === 'week') {
      return points >= 120 ? '本周冲刺' : '稳步推进'
    }

    if (pointKey === 'month') {
      return points >= 400 ? '月度优选' : '持续积累'
    }

    return points >= 900 ? '长期领先' : '成长进行中'
  },

  onShareAppMessage() {
    return {
      title: '智力控码排行榜',
      path: '/pages/student/rank/rank'
    }
  }
})
