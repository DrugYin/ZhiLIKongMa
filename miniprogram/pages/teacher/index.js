const AuthService = require('../../services/auth')
const OverviewService = require('../../services/overview')
const AnnouncementService = require('../../services/announcement')
const formatUtils = require('../../utils/format')
const Toast = require('../../utils/toast')

Page({
  data: {
    userInfo: {},
    greeting: '',
    pendingCount: 0,
    weeklyStats: {
      totalStudents: 0,
      weeklyCheckIns: 0,
      completionRate: 0
    },
    overview: {
      classCount: 0,
      taskCount: 0,
      studentCount: 0,
      pendingCount: 0
    },
    announcementVisible: false,
    popupAnnouncements: [],
    quickActions: [
      {
        key: 'pending',
        mark: '审',
        title: '审核中心',
        desc: '处理入班与打卡待办'
      },
      {
        key: 'class',
        mark: '班',
        title: '班级管理',
        desc: '查看班级详情与成员'
      },
      {
        key: 'task',
        mark: '任',
        title: '任务管理',
        desc: '维护任务内容与发布状态'
      },
      {
        key: 'announcement',
        mark: '通',
        title: '通知中心',
        desc: '查看系统通知与运营安排'
      }
    ],
    recentActivities: [],
    degradeNotice: ''
  },

  async onLoad() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'teacher' })
    }

    this._loginPending = true
    const app = getApp()
    try {
      await app.awaitLogin()
    } finally {
      this._loginPending = false
    }

    this.showQueuedAnnouncements()
    this.initPage()
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'teacher' })
      tabBar.init('/pages/teacher/index')
    }

    if (this._pageReady) {
      this.loadPageData()
    }

    this.loadPopupAnnouncements()
  },

  onPullDownRefresh() {
    this.loadPageData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onShareAppMessage() {
    return {
      title: '智力控码教师首页',
      path: '/pages/teacher/index'
    }
  },

  initPage() {
    this.setGreeting()
    Toast.showLoading()
    this.loadPageData().then(() => {
      Toast.hideLoading()
    })
  },

  setGreeting() {
    const hour = new Date().getHours()
    let greeting = '晚上好'
    if (hour < 12) {
      greeting = '上午好'
    } else if (hour < 18) {
      greeting = '下午好'
    }
    this.setData({ greeting })
  },

  async loadPageData() {
    const requestId = (this._loadRequestId || 0) + 1
    this._loadRequestId = requestId
    const cachedUserInfo = AuthService.getLocalUserInfo() || {}
    this.setData({
      userInfo: cachedUserInfo
    })

    try {
      const data = await OverviewService.getTeacherOverview()
      if (requestId !== this._loadRequestId) {
        return
      }

      const userInfo = data.user_info || cachedUserInfo
      const overview = data.overview || {}
      const weeklyStats = data.weekly_stats || {}
      const pendingCount = Number(overview.pending_submission_count || 0) +
        Number(overview.pending_application_count || 0)

      if (data.user_info) {
        AuthService.updateLocalUserInfo({
          ...userInfo,
          is_registered: true
        })
      }

      this.setData({
        userInfo,
        pendingCount,
        degradeNotice: '',
        weeklyStats: {
          totalStudents: Number(overview.student_count || 0),
          weeklyCheckIns: Number(weeklyStats.submitted_student_count || 0),
          completionRate: Number(weeklyStats.completion_rate || 0)
        },
        overview: {
          classCount: Number(overview.class_count || 0),
          taskCount: Number(overview.task_count || 0),
          studentCount: Number(overview.student_count || 0),
          pendingCount
        },
        recentActivities: this.formatRecentActivities(data.recent_activities)
      })
    } catch (error) {
      console.error('[teacher-index] loadPageData error:', error)
      if (requestId === this._loadRequestId) {
        this.setData({
          degradeNotice: '首页数据同步失败，请下拉刷新重试。'
        })
      }
    } finally {
      if (requestId === this._loadRequestId) {
        this._pageReady = true
      }
    }
  },

  formatRecentActivities(activities = []) {
    return (Array.isArray(activities) ? activities : []).map((item) => ({
      id: item.id,
      content: item.content,
      time: formatUtils.formatRelativeTime(this.parseDate(item.time_value))
    }))
  },

  parseDate(value) {
    if (!value) {
      return new Date(0)
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? new Date(0) : value
    }

    if (typeof value === 'number') {
      const timestampDate = new Date(value)
      return Number.isNaN(timestampDate.getTime()) ? new Date(0) : timestampDate
    }

    const text = String(value).trim()
    if (!text) {
      return new Date(0)
    }

    const primaryDate = new Date(text.includes(' ') && !text.includes('T') ? text.replace(' ', 'T') : text)
    if (!Number.isNaN(primaryDate.getTime())) {
      return primaryDate
    }

    const slashDate = new Date(text.replace(/-/g, '/'))
    return Number.isNaN(slashDate.getTime()) ? new Date(0) : slashDate
  },

  handleQuickAction(e) {
    const { key } = e.currentTarget.dataset

    if (key === 'pending') {
      this.goToPending()
      return
    }

    if (key === 'class') {
      this.goToClassManage()
      return
    }

    if (key === 'task') {
      this.goToTaskManage()
      return
    }

    if (key === 'announcement') {
      this.goToAnnouncements()
    }
  },

  async loadPopupAnnouncements() {
    try {
      const data = await AnnouncementService.getPopupAnnouncements()
      const popupAnnouncements = data.popup_list || data.list || []
      this.setData({
        popupAnnouncements,
        announcementVisible: !this._loginPending && popupAnnouncements.length > 0
      })
    } catch (error) {
      console.error('[teacher-index] loadPopupAnnouncements error:', error)
    }
  },

  showQueuedAnnouncements() {
    this.setData({
      announcementVisible: this.data.popupAnnouncements.length > 0
    })
  },

  async handleAnnouncementRead(e) {
    const announcement = e.detail && e.detail.announcement
    if (!announcement || !announcement._id) {
      return
    }

    try {
      await AnnouncementService.markRead(announcement._id)
    } catch (error) {
      console.error('[teacher-index] markAnnouncementRead error:', error)
    }
  },

  async handleAnnouncementAction(e) {
    const announcement = e.detail && e.detail.announcement
    if (!announcement || !announcement._id) {
      return
    }

    try {
      await AnnouncementService.markRead(announcement._id)
    } catch (error) {
      console.error('[teacher-index] action markAnnouncementRead error:', error)
    }

    this.setData({
      announcementVisible: false
    })
    AnnouncementService.openAction(announcement)
  },

  handleAnnouncementPanelClose() {
    this.setData({
      announcementVisible: false
    })
  },

  goToReview() {
    this.goToPending()
  },

  goToTaskManage() {
    wx.switchTab({
      url: '/pages/teacher/task-manage/task-manage'
    })
  },

  goToClassManage() {
    wx.navigateTo({
      url: '/pages/teacher/class-manage/class-manage'
    })
  },

  goToPending() {
    wx.switchTab({
      url: '/pages/teacher/pending/pending'
    })
  },

  goToAnnouncements() {
    wx.navigateTo({
      url: '/subpackages/common/announcements/announcements'
    })
  },

  viewAllActivities() {
    this.goToPending()
  }
})
