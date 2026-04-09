const AuthService = require('../../services/auth')
const ClassService = require('../../services/class')
const RankingService = require('../../services/ranking')
const TaskService = require('../../services/task')
const formatUtils = require('../../utils/format')

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
      title: '登录后查看本周任务',
      description: '系统会自动同步你本周可见任务中最新的待提交任务。',
      taskId: '',
      deadlineText: '待同步',
      progressText: '0 / 0',
      progressPercent: 0,
      assistantText: '综合训练',
      projectText: '任务待同步',
      classText: '登录后查看',
      statusText: '未登录',
      statusStyle: 'color:#7a8797;background:rgba(122, 135, 151, 0.12);',
      weeklyTaskCount: 0,
      submittedCount: 0
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
      },
      {
        key: 'records',
        mark: '记',
        title: '提交记录',
        desc: '统一查看所有任务的历史提交'
      }
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
    const requestId = (this._initRequestId || 0) + 1
    this._initRequestId = requestId

    if (!silent) {
      this.setData({ loading: true })
    }

    const cachedUserInfo = AuthService.getLocalUserInfo() || {}
    const isLoggedIn = AuthService.isLoggedIn()

    if (requestId !== this._initRequestId) {
      return
    }

    this.setData({
      isLoggedIn,
      userInfo: cachedUserInfo,
      heroTitle: isLoggedIn
        ? `${cachedUserInfo.user_name || cachedUserInfo.userName || '同学'}，继续保持今天的节奏`
        : '欢迎来到智力控码',
      heroDesc: isLoggedIn
        ? '首页会帮你聚合任务、班级和排名信息，进入学习状态会更快。'
        : '先登录即可查看任务、班级和个人成长数据，未登录时也可以先浏览整体布局。',
      summary: {
        points: Number(cachedUserInfo.points || 0),
        joinedClasses: 0,
        pendingApplications: 0,
        weeklyRankText: isLoggedIn ? '同步中' : '未登录'
      }
    })

    try {
      const [userInfo, classSummary, weeklyTaskSummary, weeklyRankText] = await Promise.all([
        this.loadCurrentUserInfo(cachedUserInfo, isLoggedIn),
        this.loadClassSummary(),
        this.loadWeeklyTaskSummary(),
        this.loadWeeklyRankText(isLoggedIn)
      ])

      if (requestId !== this._initRequestId) {
        return
      }

      this.setData({
        userInfo,
        heroTitle: isLoggedIn
          ? `${userInfo.user_name || userInfo.userName || '同学'}，继续保持今天的节奏`
          : '欢迎来到智力控码',
        notice: this.buildNoticeText(isLoggedIn, classSummary),
        showNotice: true,
        featuredTask: this.buildFeaturedTask(userInfo, classSummary, weeklyTaskSummary),
        summary: {
          points: Number(userInfo.points || 0),
          joinedClasses: classSummary.joinedCount,
          pendingApplications: classSummary.pendingCount,
          weeklyRankText
        }
      })
      this._pageReady = true
    } catch (error) {
      console.error('[student-index] initPage error:', error)

      if (requestId !== this._initRequestId) {
        return
      }

      this.setData({
        notice: isLoggedIn
          ? '当前数据同步稍慢，先查看任务中心与班级页也可以继续学习。'
          : '当前未登录，首页先展示默认学习引导。',
        showNotice: true,
        featuredTask: this.buildFeaturedTask(cachedUserInfo, {
          joinedCount: 0,
          pendingCount: 0
        }, null),
        summary: {
          points: Number(cachedUserInfo.points || 0),
          joinedClasses: 0,
          pendingApplications: 0,
          weeklyRankText: isLoggedIn ? '同步中' : '未登录'
        }
      })
    } finally {
      if (requestId !== this._initRequestId) {
        return
      }

      this.setData({ loading: false })
      wx.stopPullDownRefresh()
    }
  },

  async loadClassSummary() {
    if (!AuthService.isLoggedIn()) {
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

  async loadWeeklyTaskSummary() {
    if (!AuthService.isLoggedIn()) {
      return null
    }

    try {
      const taskResponse = await TaskService.getTasks({
        page: 1,
        page_size: 50,
        sort_by: 'publish_time',
        sort_order: 'desc'
      })
      const taskList = Array.isArray(taskResponse.list) ? taskResponse.list : []
      let submissionTaskIds = new Set()

      try {
        submissionTaskIds = await this.loadSubmittedTaskIds()
      } catch (error) {
        console.error('[student-index] loadSubmittedTaskIds error:', error)
      }

      const weeklyTasks = taskList.filter((item) => this.isCurrentWeekTask(item))
      const sourceTasks = weeklyTasks.length ? weeklyTasks : taskList
      const submittedCount = sourceTasks.filter((item) => submissionTaskIds.has(item._id)).length
      const pendingTasks = sourceTasks
        .filter((item) => !submissionTaskIds.has(item._id))
        .sort((left, right) => this.getTaskReferenceTime(right) - this.getTaskReferenceTime(left))
      const sortedSourceTasks = sourceTasks
        .slice()
        .sort((left, right) => this.getTaskReferenceTime(right) - this.getTaskReferenceTime(left))
      const latestTask = pendingTasks[0] || sortedSourceTasks[0] || null

      return {
        weeklyTaskCount: sourceTasks.length,
        submittedCount,
        latestTask: latestTask ? this.formatWeeklyTask(latestTask) : null,
        hasPendingTask: pendingTasks.length > 0,
        fallbackToAllTasks: !weeklyTasks.length && taskList.length > 0
      }
    } catch (error) {
      console.error('[student-index] loadWeeklyTaskSummary error:', error)
      return null
    }
  },

  async loadSubmittedTaskIds() {
    const taskIds = new Set()
    let page = 1
    let hasMore = true
    const maxPages = 4

    while (hasMore && page <= maxPages) {
      const response = await TaskService.getSubmissions({
        page,
        page_size: 50
      })
      const list = Array.isArray(response.list) ? response.list : []
      list.forEach((item) => {
        if (item && item.task_id) {
          taskIds.add(item.task_id)
        }
      })
      hasMore = Boolean(response.has_more)
      page += 1
    }

    return taskIds
  },

  buildFeaturedTask(userInfo, classSummary, weeklyTaskSummary) {
    const joinedCount = classSummary.joinedCount || 0
    const weeklyTaskCount = Number(weeklyTaskSummary && weeklyTaskSummary.weeklyTaskCount) || 0
    const submittedCount = Number(weeklyTaskSummary && weeklyTaskSummary.submittedCount) || 0
    const latestTask = weeklyTaskSummary && weeklyTaskSummary.latestTask
    const progressPercent = weeklyTaskCount > 0
      ? Math.round((submittedCount / weeklyTaskCount) * 100)
      : 0

    if (!this.data.isLoggedIn) {
      return {
        title: '登录后查看本周任务',
        description: '系统会自动同步你本周可见任务中最新的待提交任务。',
        taskId: '',
        deadlineText: '待同步',
        progressText: '0 / 0',
        progressPercent: 0,
        assistantText: '综合训练',
        projectText: '任务待同步',
        classText: '登录后查看',
        statusText: '未登录',
        statusStyle: 'color:#7a8797;background:rgba(122, 135, 151, 0.12);',
        weeklyTaskCount: 0,
        submittedCount: 0
      }
    }

    if (!weeklyTaskCount || !latestTask) {
      return {
        title: '本周还没有待跟进任务',
        description: joinedCount > 0
          ? '当前没有落在本周的任务安排，可以先去任务中心查看全部历史任务。'
          : '当前没有同步到本周任务，加入班级后这里会自动聚合最新任务。',
        taskId: '',
        deadlineText: '本周暂无任务',
        progressText: '0 / 0',
        progressPercent: 0,
        assistantText: userInfo.grade || userInfo.school || '综合训练',
        projectText: '任务中心待同步',
        classText: joinedCount > 0 ? `已加入 ${joinedCount} 个班级` : '暂未加入班级',
        statusText: '本周空闲',
        statusStyle: 'color:#2f8f57;background:rgba(47, 143, 87, 0.12);',
        weeklyTaskCount: 0,
        submittedCount: 0
      }
    }

    if (weeklyTaskSummary.fallbackToAllTasks) {
      return {
        title: latestTask.titleText,
        description: `当前没有稳定命中“本周任务”时间范围，先展示任务中心里最新的待跟进任务。`,
        taskId: latestTask.taskId,
        deadlineText: latestTask.deadlineText,
        progressText: `${submittedCount} / ${weeklyTaskCount}`,
        progressPercent,
        assistantText: latestTask.projectText,
        projectText: latestTask.projectText,
        classText: latestTask.classText,
        statusText: weeklyTaskSummary.hasPendingTask ? '最新任务' : '已提交任务',
        statusStyle: weeklyTaskSummary.hasPendingTask
          ? 'color:#1f7ae0;background:rgba(31, 122, 224, 0.12);'
          : 'color:#2f8f57;background:rgba(47, 143, 87, 0.12);',
        weeklyTaskCount,
        submittedCount
      }
    }

    if (!weeklyTaskSummary.hasPendingTask) {
      return {
        title: '本周任务已全部提交',
        description: `你本周共有 ${weeklyTaskCount} 个任务，已经全部完成提交，记得留意后续审核反馈。`,
        taskId: latestTask.taskId,
        deadlineText: latestTask.deadlineText,
        progressText: `${submittedCount} / ${weeklyTaskCount}`,
        progressPercent,
        assistantText: latestTask.projectText,
        projectText: latestTask.projectText,
        classText: latestTask.classText,
        statusText: '已全部提交',
        statusStyle: 'color:#2f8f57;background:rgba(47, 143, 87, 0.12);',
        weeklyTaskCount,
        submittedCount
      }
    }

    return {
      title: latestTask.titleText,
      description: latestTask.descriptionText,
      taskId: latestTask.taskId,
      deadlineText: latestTask.deadlineText,
      progressText: `${submittedCount} / ${weeklyTaskCount}`,
      progressPercent,
      assistantText: latestTask.projectText,
      projectText: latestTask.projectText,
      classText: latestTask.classText,
      statusText: '待提交',
      statusStyle: 'color:#d88412;background:rgba(216, 132, 18, 0.12);',
      weeklyTaskCount,
      submittedCount
    }
  },

  formatWeeklyTask(item = {}) {
    return {
      taskId: item._id || '',
      titleText: item.title || '未命名任务',
      descriptionText: String(item.description || '').trim() || '请前往任务中心查看任务详情和素材要求。',
      projectText: item.project_name || item.project_code || '未设置项目',
      classText: item.task_type === 'class'
        ? (item.class_name || '未设置班级')
        : '全部学生可见',
      deadlineText: this.getTaskDeadlineText(item)
    }
  },

  getTaskDeadlineText(item = {}) {
    const deadline = this.parseTaskDate(item.deadline)
      || this.parseTaskDate(this.buildTaskDeadlineValue(item))

    if (!deadline) {
      return '未设置截止时间'
    }

    return `截止 ${formatUtils.formatDate(deadline, 'MM-DD HH:mm')}`
  },

  isCurrentWeekTask(item = {}) {
    const { start, end } = this.getCurrentWeekRange()
    const candidateDates = [
      this.parseTaskDate(item.publish_time),
      this.parseTaskDate(item.create_time),
      this.parseTaskDate(item.update_time),
      this.parseTaskDate(item.deadline),
      this.parseTaskDate(this.buildTaskDeadlineValue(item))
    ].filter(Boolean)

    return candidateDates.some((date) => this.isDateInRange(date, start, end))
  },

  getTaskReferenceTime(item = {}) {
    const referenceDate = this.getTaskReferenceDate(item)
    return referenceDate ? referenceDate.getTime() : 0
  },

  getTaskReferenceDate(item = {}) {
    return this.parseTaskDate(item.publish_time)
      || this.parseTaskDate(item.create_time)
      || this.parseTaskDate(item.update_time)
      || this.parseTaskDate(item.deadline)
      || this.parseTaskDate(this.buildTaskDeadlineValue(item))
  },

  buildTaskDeadlineValue(item = {}) {
    if (item.deadline_date && item.deadline_time) {
      return `${item.deadline_date} ${item.deadline_time}`
    }
    return ''
  },

  parseTaskDate(value) {
    if (!value) {
      return null
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value
    }

    if (typeof value === 'number') {
      const timestampDate = new Date(value)
      return Number.isNaN(timestampDate.getTime()) ? null : timestampDate
    }

    const text = String(value).trim()
    if (!text) {
      return null
    }

    let normalizedText = text
    if (text.includes(' ') && !text.includes('T')) {
      normalizedText = text.replace(' ', 'T')
    }

    const primaryDate = new Date(normalizedText)
    if (!Number.isNaN(primaryDate.getTime())) {
      return primaryDate
    }

    const slashDate = new Date(text.replace(/-/g, '/'))
    return Number.isNaN(slashDate.getTime()) ? null : slashDate
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

  isDateInRange(date, start, end) {
    if (!date) {
      return false
    }

    const time = date.getTime()
    return time >= start.getTime() && time < end.getTime()
  },

  closeNotice() {
    this.setData({ showNotice: false })
  },

  handleFeaturedTaskTap() {
    const taskId = String(this.data.featuredTask.taskId || '').trim()
    if (!taskId) {
      this.goToTaskCenter()
      return
    }

    wx.navigateTo({
      url: `/pages/student/task-manage/task-detail/task-detail?task_id=${taskId}`
    })
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
      return
    }

    if (key === 'records') {
      this.goToSubmissionRecords()
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

  goToSubmissionRecords() {
    wx.navigateTo({
      url: '/pages/student/task-manage/submission-records/submission-records'
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
  },

  async loadCurrentUserInfo(fallbackUserInfo = {}, isLoggedIn = false) {
    if (!isLoggedIn) {
      return fallbackUserInfo
    }

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
      console.error('[student-index] loadCurrentUserInfo error:', error)
    }

    return fallbackUserInfo
  },

  async loadWeeklyRankText(isLoggedIn) {
    if (!isLoggedIn) {
      return '未登录'
    }

    try {
      const rankRes = await RankingService.getRanking({
        rank_type: 'week'
      })
      const currentUser = rankRes.current_user || null

      return currentUser && Number(currentUser.rank || 0) > 0
        ? `第 ${currentUser.rank} 名`
        : '未上榜'
    } catch (error) {
      console.error('[student-index] loadWeeklyRankText error:', error)
      return '同步中'
    }
  },
})
