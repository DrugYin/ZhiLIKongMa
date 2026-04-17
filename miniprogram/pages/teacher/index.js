const AuthService = require('../../services/auth')
const ClassService = require('../../services/class')
const TaskService = require('../../services/task')
const formatUtils = require('../../utils/format')
const Toast = require('../../utils/toast')

const MAX_PAGES = 10
const MAX_PAGE_NOTICE = `数据较多，仅展示最近 ${MAX_PAGES} 页`

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
    recentActivities: [],
    degradeNotice: ''
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

    const [userInfoResult, classesResult, tasksResult, submissionsResult] = await Promise.allSettled([
      this.loadCurrentUserInfo(cachedUserInfo),
      this.fetchAllClasses(),
      this.fetchAllTasks(),
      this.fetchAllTeacherSubmissions()
    ])

    if (requestId !== this._loadRequestId) {
      return
    }

    const userInfo = userInfoResult.status === 'fulfilled' ? userInfoResult.value : cachedUserInfo
    const classes = classesResult.status === 'fulfilled' ? classesResult.value : []
    const tasks = tasksResult.status === 'fulfilled' ? tasksResult.value : []
    const submissionsResultData = submissionsResult.status === 'fulfilled'
      ? submissionsResult.value
      : { list: [], truncated: false }
    const applicationsResult = await this.fetchAllPendingApplications(classes)

    if (requestId !== this._loadRequestId) {
      return
    }

    const submissions = submissionsResultData.list
    const applications = applicationsResult.list
    const pendingSubmissionCount = submissions.filter((item) => item.status === 'pending').length
    const pendingApplicationCount = applications.length
    const pendingCount = pendingSubmissionCount + pendingApplicationCount
    const totalStudents = classes.reduce((sum, item) => sum + Number(item.member_count || 0), 0)
    const weeklySubmittedStudents = this.getWeeklySubmittedStudentCount(submissions)
    const completionRate = totalStudents > 0
      ? Math.min(100, Math.round((weeklySubmittedStudents / totalStudents) * 100))
      : 0
    const degradeNotice = this.buildDegradeNotice({
      submissionsTruncated: submissionsResultData.truncated,
      applicationsTruncated: applicationsResult.truncated
    })

    this.setData({
      userInfo,
      pendingCount,
      degradeNotice,
      weeklyStats: {
        totalStudents,
        weeklyCheckIns: weeklySubmittedStudents,
        completionRate
      },
      overview: {
        classCount: classes.length,
        taskCount: tasks.length,
        studentCount: totalStudents,
        pendingCount
      },
      recentActivities: this.buildRecentActivities(classes, tasks, submissions, applications)
    })

    this._pageReady = true
  },

  async loadCurrentUserInfo(fallbackUserInfo = {}) {
    try {
      const userInfo = await AuthService.getUserInfo()
      if (userInfo) {
        AuthService.updateLocalUserInfo({
          ...userInfo,
          is_registered: true
        })
        return userInfo
      }
    } catch (error) {
      console.error('[teacher-index] loadCurrentUserInfo error:', error)
    }

    return fallbackUserInfo
  },

  async fetchAllTeacherSubmissions() {
    const list = []
    let page = 1
    let hasMore = true

    while (hasMore && page <= MAX_PAGES) {
      const response = await TaskService.getSubmissions({
        role: 'teacher',
        page,
        page_size: 50
      })
      const currentList = Array.isArray(response.list) ? response.list : []
      list.push(...currentList)
      hasMore = Boolean(response.has_more)
      page += 1
    }

    const truncated = hasMore
    if (truncated) {
      console.warn('[teacher-index] teacher submissions reached max pages limit:', MAX_PAGES)
    }

    return {
      list,
      truncated
    }
  },

  async fetchAllPendingApplications(classes = []) {
    const tasks = classes
      .filter((item) => item && item._id)
      .map((item) => this.fetchClassPendingApplications(item._id))

    if (!tasks.length) {
      return {
        list: [],
        truncated: false
      }
    }

    const results = await Promise.allSettled(tasks)
    return results.reduce((result, item) => {
      if (item.status === 'fulfilled' && item.value) {
        if (Array.isArray(item.value.list)) {
          result.list.push(...item.value.list)
        }
        result.truncated = result.truncated || Boolean(item.value.truncated)
      }
      return result
    }, {
      list: [],
      truncated: false
    })
  },

  async fetchClassPendingApplications(classId) {
    const list = []
    let page = 1
    let hasMore = true

    while (hasMore && page <= MAX_PAGES) {
      const response = await ClassService.getClassApplications({
        class_id: classId,
        page,
        page_size: 50
      })
      const currentList = Array.isArray(response.list) ? response.list : []
      list.push(...currentList)
      hasMore = Boolean(response.has_more)
      page += 1
    }

    const truncated = hasMore
    if (truncated) {
      console.warn('[teacher-index] class applications reached max pages limit:', classId, MAX_PAGES)
    }

    return {
      list,
      truncated
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

  buildDegradeNotice({ submissionsTruncated, applicationsTruncated }) {
    const labels = []

    if (submissionsTruncated) {
      labels.push('提交记录')
    }

    if (applicationsTruncated) {
      labels.push('入班申请')
    }

    if (!labels.length) {
      return ''
    }

    return `${MAX_PAGE_NOTICE}的${labels.join('和')}。`
  },

  getWeeklySubmittedStudentCount(submissions = []) {
    const studentOpenids = new Set(
      submissions
        .filter((item) => this.isCurrentWeekTime(item.submit_time))
        .map((item) => item.student_openid)
        .filter(Boolean)
    )

    return studentOpenids.size
  },

  buildRecentActivities(classes = [], tasks = [], submissions = [], applications = []) {
    const activityList = []
    const latestPendingSubmission = submissions.find((item) => item.status === 'pending')
    const latestPendingApplication = applications
      .slice()
      .sort((left, right) => this.parseDate(right.create_time) - this.parseDate(left.create_time))[0]
    const latestTask = tasks[0] || null
    const latestClass = classes[0] || null

    if (latestPendingSubmission) {
      const submitTime = this.parseDate(latestPendingSubmission.submit_time)
      activityList.push({
        id: `submission-${latestPendingSubmission._id || latestPendingSubmission.task_id || 'latest'}`,
        content: `${latestPendingSubmission.student_name || '学生'}提交了“${latestPendingSubmission.task_title || '未命名任务'}”，等待审核`,
        timestamp: submitTime.getTime(),
        time: formatUtils.formatRelativeTime(submitTime)
      })
    }

    if (latestPendingApplication) {
      const createTime = this.parseDate(latestPendingApplication.create_time)
      activityList.push({
        id: `application-${latestPendingApplication._id || latestPendingApplication.class_id || 'latest'}`,
        content: `${latestPendingApplication.student_name || '学生'}申请加入班级“${latestPendingApplication.class_name || '未命名班级'}”`,
        timestamp: createTime.getTime(),
        time: formatUtils.formatRelativeTime(createTime)
      })
    }

    if (latestTask) {
      const updateTime = this.parseDate(latestTask.update_time || latestTask.create_time)
      activityList.push({
        id: `task-${latestTask._id || 'latest'}`,
        content: `任务“${latestTask.title || '未命名任务'}”最近有更新`,
        timestamp: updateTime.getTime(),
        time: formatUtils.formatRelativeTime(updateTime)
      })
    }

    if (latestClass) {
      const updateTime = this.parseDate(latestClass.update_time || latestClass.create_time)
      activityList.push({
        id: `class-${latestClass._id || 'latest'}`,
        content: `班级“${latestClass.class_name || '未命名班级'}”当前共有 ${Number(latestClass.member_count || 0)} 名成员`,
        timestamp: updateTime.getTime(),
        time: formatUtils.formatRelativeTime(updateTime)
      })
    }

    return activityList
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 4)
      .map(({ timestamp, ...item }) => item)
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

  getCurrentWeekRange() {
    const start = new Date()
    const day = start.getDay()
    const offset = (day + 1) % 7
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - offset)

    const end = new Date(start)
    end.setDate(end.getDate() + 7)

    return { start, end }
  },

  isCurrentWeekTime(value) {
    const date = this.parseDate(value)
    if (Number.isNaN(date.getTime()) || date.getTime() <= 0) {
      return false
    }

    const { start, end } = this.getCurrentWeekRange()
    const time = date.getTime()
    return time >= start.getTime() && time < end.getTime()
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
