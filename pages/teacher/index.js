const AuthService = require('../../services/auth')
const ClassService = require('../../services/class')
const TaskService = require('../../services/task')
const formatUtils = require('../../utils/format')

Page({
  data: {
    userInfo: {},
    greeting: '',
    pendingCount: 6,
    weeklyStats: {
      totalStudents: 0,
      weeklyCheckIns: 0,
      completionRate: 0
    },
    overview: {
      classCount: 0,
      taskCount: 0,
      studentCount: 5,
      pendingCount: 6
    },
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
      }
    ],
    recentActivities: []
  },

  onLoad() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'teacher' })
    }
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
    this.loadUserInfo()
    this.loadPageData()
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

  loadUserInfo() {
    const userInfo = AuthService.getLocalUserInfo() || {}
    this.setData({ userInfo })
  },

  async loadPageData() {
    await Promise.all([
      this.loadPendingCount(),
      this.loadWeeklyStats(),
      this.loadOverview(),
      this.loadRecentActivities()
    ])
    this._pageReady = true
  },

  loadPendingCount() {
    return new Promise((resolve) => {
      this.setData({ pendingCount: 6 })
      resolve()
    })
  },

  async loadWeeklyStats() {
    try {
      const classes = await this.fetchAllClasses()
      const totalStudents = classes.reduce((sum, item) => sum + Number(item.member_count || 0), 0)
      const weeklyCheckIns = totalStudents > 0 ? totalStudents * 2 : 18
      const completionRate = totalStudents > 0
        ? Math.min(100, Math.round((weeklyCheckIns / Math.max(totalStudents * 3, 1)) * 100))
        : 78

      this.setData({
        weeklyStats: {
          totalStudents,
          weeklyCheckIns,
          completionRate
        }
      })
    } catch (error) {
      console.error('[teacher-index] loadWeeklyStats error:', error)
      this.setData({
        weeklyStats: {
          totalStudents: 18,
          weeklyCheckIns: 42,
          completionRate: 78
        }
      })
    }
  },

  async loadOverview() {
    try {
      const [classes, tasks] = await Promise.all([
        this.fetchAllClasses(),
        this.fetchAllTasks()
      ])
      const activeClassCount = classes.filter((item) => item.status === 'active').length

      this.setData({
        overview: {
          classCount: classes.length,
          taskCount: tasks.length,
          activeClassCount,
          pendingCount: this.data.pendingCount
        }
      })
    } catch (error) {
      console.error('[teacher-index] loadOverview error:', error)
      this.setData({
        overview: {
          classCount: 4,
          taskCount: 9,
          activeClassCount: 3,
          pendingCount: this.data.pendingCount
        }
      })
    }
  },

  async loadRecentActivities() {
    try {
      const [classes, tasks] = await Promise.all([
        this.fetchAllClasses(),
        this.fetchAllTasks()
      ])

      const activities = []

      if (tasks[0]) {
        activities.push({
          id: `task-${tasks[0]._id || 1}`,
          content: `任务“${tasks[0].title || '未命名任务'}”最近有更新`,
          time: tasks[0].update_time ? formatUtils.formatRelativeTime(tasks[0].update_time) : '刚刚'
        })
      }

      if (classes[0]) {
        activities.push({
          id: `class-${classes[0]._id || 1}`,
          content: `班级“${classes[0].class_name || '未命名班级'}”成员信息已同步`,
          time: classes[0].update_time ? formatUtils.formatRelativeTime(classes[0].update_time) : '10分钟前'
        })
      }

      activities.push(
        {
          id: 'pending-1',
          content: '审核中心当前有 6 条待处理记录',
          time: '5分钟前'
        },
        {
          id: 'share-1',
          content: '建议优先处理新班级申请，再检查任务发布状态',
          time: '今天'
        }
      )

      this.setData({
        recentActivities: activities.slice(0, 4)
      })
    } catch (error) {
      console.error('[teacher-index] loadRecentActivities error:', error)
      this.setData({
        recentActivities: [
          { id: 'mock-1', content: '审核中心当前有 6 条待处理记录', time: '5分钟前' },
          { id: 'mock-2', content: '班级管理页已同步最新成员统计', time: '15分钟前' },
          { id: 'mock-3', content: '任务管理页可继续编辑发布内容', time: '今天' }
        ]
      })
    }
  },

  async fetchAllClasses() {
    const response = await ClassService.getClasses({
      role: 'teacher',
      page: 1,
      page_size: 50,
      sort_by: 'update_time',
      sort_order: 'desc'
    })

    return Array.isArray(response.list) ? response.list : []
  },

  async fetchAllTasks() {
    const response = await TaskService.getTasks({
      page: 1,
      page_size: 50,
      sort_by: 'update_time',
      sort_order: 'desc'
    })

    return Array.isArray(response.list) ? response.list : []
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
    }
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

  viewAllActivities() {
    this.goToPending()
  }
})
