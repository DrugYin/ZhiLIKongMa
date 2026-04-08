const AuthService = require('../../services/auth')
const ClassService = require('../../services/class')

Page({
  data: {
    loading: true,
    isLoggedIn: false,
    userInfo: {},
    heroTitle: '欢迎回到智力控码',
    heroDesc: '查看本周任务、班级进度和学习提醒，让今天的训练安排更清晰。',
    notice: '',
    showNotice: false,
    featuredTask: {
      title: '本周训练计划待同步',
      description: '登录后可以查看你当前可见的任务安排与截止时间。',
      deadlineText: '待同步',
      progressText: '0 / 0',
      progressPercent: 0,
      assistantText: '综合训练'
    },
    summary: {
      points: 0,
      joinedClasses: 0,
      pendingApplications: 0,
      weeklyRankText: '未上榜'
    },
    quickActions: [
      {
        key: 'task',
        mark: '任',
        title: '任务中心',
        desc: '查看公开任务和班级任务'
      },
      {
        key: 'class',
        mark: '班',
        title: '我的班级',
        desc: '管理邀请码、查看班级详情'
      },
      {
        key: 'rank',
        mark: '榜',
        title: '排行榜',
        desc: '查看周榜、月榜和总榜变化'
      }
    ],
    focusList: [
      '建议优先完成本周任务，再回看排行榜变化。',
      '加入多个班级后，可从班级页直接进入对应任务列表。',
      '后续提交与训练记录会继续汇总到首页。'
    ]
  },

  onLoad() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'student' })
    }
    this.initPage()
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'student' })
      tabBar.init('/pages/student/index')
    }

    if (this._pageReady) {
      this.initPage({ silent: true })
    }
  },

  async initPage({ silent = false } = {}) {
    if (!silent) {
      this.setData({ loading: true })
    }

    const userInfo = AuthService.getLocalUserInfo() || {}
    const isLoggedIn = AuthService.isLoggedIn()
    const weeklyRank = Number(userInfo.weeklyRank || 0)

    this.setData({
      isLoggedIn,
      userInfo,
      heroTitle: isLoggedIn
        ? `${userInfo.user_name || userInfo.userName || '同学'}，继续保持今天的节奏`
        : '欢迎来到智力控码',
      heroDesc: isLoggedIn
        ? '首页会帮你聚合任务、班级和排名信息，进入学习状态会更快。'
        : '先登录即可查看任务、班级和个人成长数据，未登录时也可以先浏览整体布局。',
      summary: {
        points: Number(userInfo.points || 0),
        joinedClasses: 0,
        pendingApplications: 0,
        weeklyRankText: weeklyRank ? `第 ${weeklyRank} 名` : '未上榜'
      }
    })

    try {
      const classSummary = await this.loadClassSummary()
      this.setData({
        notice: this.buildNoticeText(isLoggedIn, classSummary),
        showNotice: true,
        featuredTask: this.buildFeaturedTask(userInfo, classSummary),
        summary: {
          ...this.data.summary,
          joinedClasses: classSummary.joinedCount,
          pendingApplications: classSummary.pendingCount
        }
      })
      this._pageReady = true
    } catch (error) {
      console.error('[student-index] initPage error:', error)
      this.setData({
        notice: isLoggedIn
          ? '当前数据同步稍慢，先查看任务中心与班级页也可以继续学习。'
          : '当前未登录，首页先展示默认学习引导。',
        showNotice: true,
        featuredTask: this.buildFeaturedTask(userInfo, {
          joinedCount: 0,
          pendingCount: 0
        })
      })
    } finally {
      this.setData({ loading: false })
      wx.stopPullDownRefresh()
    }
  },

  async loadClassSummary() {
    if (!this.data.isLoggedIn) {
      return {
        joinedCount: 0,
        pendingCount: 0
      }
    }

    try {
      const status = await ClassService.getMyClassStatus()
      const joinedClasses = Array.isArray(status.joined_classes) ? status.joined_classes : []
      const pendingApplications = Array.isArray(status.pending_applications) ? status.pending_applications : []

      return {
        joinedCount: joinedClasses.length,
        pendingCount: pendingApplications.length
      }
    } catch (error) {
      console.error('[student-index] loadClassSummary error:', error)
      return {
        joinedCount: 0,
        pendingCount: 0
      }
    }
  },

  buildNoticeText(isLoggedIn, classSummary) {
    if (!isLoggedIn) {
      return '登录后可同步任务、班级和个人积分，首页数据会自动切换为你的学习看板。'
    }

    if (classSummary.pendingCount > 0) {
      return `你当前有 ${classSummary.pendingCount} 条入班申请等待老师审核，记得留意班级页状态变化。`
    }

    if (classSummary.joinedCount > 0) {
      return `你已经加入 ${classSummary.joinedCount} 个班级，可从首页快速进入任务中心继续学习。`
    }

    return '还没有加入班级时，也可以先浏览公开任务与排行榜，后续再补充班级学习内容。'
  },

  buildFeaturedTask(userInfo, classSummary) {
    const joinedCount = classSummary.joinedCount || 0
    const progressCurrent = joinedCount > 0 ? Math.min(joinedCount + 1, 3) : 0
    const progressTotal = joinedCount > 0 ? 3 : 0

    return {
      title: joinedCount > 0 ? '本周班级任务整理' : '先完成账号与班级准备',
      description: joinedCount > 0
        ? `你当前已关联 ${joinedCount} 个班级，建议先进入任务中心查看本周任务清单与截止时间。`
        : '当前还没有班级任务，建议先完成登录、注册或加入班级，系统会自动同步后续训练内容。',
      deadlineText: joinedCount > 0 ? '建议今天 20:00 前完成浏览' : '准备中',
      progressText: progressTotal > 0 ? `${progressCurrent} / ${progressTotal}` : '0 / 0',
      progressPercent: progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0,
      assistantText: userInfo.grade || userInfo.school || '综合训练'
    }
  },

  closeNotice() {
    this.setData({ showNotice: false })
  },

  handleQuickAction(e) {
    const { key } = e.currentTarget.dataset

    if (key === 'task') {
      this.goToTaskCenter()
      return
    }

    if (key === 'class') {
      this.goToClass()
      return
    }

    if (key === 'rank') {
      this.goToRank()
    }
  },

  goLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  goToTaskCenter() {
    wx.navigateTo({
      url: '/pages/student/task-manage/task-manage'
    })
  },

  goToClass() {
    wx.navigateTo({
      url: '/pages/student/class-manage/class-manage'
    })
  },

  goToRank() {
    wx.switchTab({
      url: '/pages/student/rank/rank'
    })
  },

  onPullDownRefresh() {
    this.initPage({ silent: true })
  },

  onShareAppMessage() {
    return {
      title: '智力控码学生首页',
      path: '/pages/student/index'
    }
  },

  onShareTimeline() {
    return {
      title: '智力控码学生首页',
      path: '/pages/student/index'
    }
  }
})
