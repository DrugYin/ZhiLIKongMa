const AuthService = require('../../../services/auth')
const TaskService = require('../../../services/task')
const ClassService = require('../../../services/class')
const Toast = require('../../../utils/toast')
const formatUtils = require('../../../utils/format')
const taskDeadline = require('../../../utils/task-deadline')

const TASK_TYPE_TEXT = {
  public: '公开任务',
  class: '班级任务'
}

const VISIBILITY_TEXT = {
  public: '公开可见',
  class_only: '仅班级成员'
}

const DIFFICULTY_TEXT = {
  1: '入门',
  2: '基础',
  3: '进阶',
  4: '高级',
  5: '专家'
}

const DIFFICULTY_COLOR = {
  1: '#52c41a',
  2: '#1890ff',
  3: '#faad14',
  4: '#ff4d4f',
  5: '#8c55ff'
}

Page({
  data: {
    loading: true,
    isLoggedIn: false,
    isRegistered: false,
    pageTitle: '任务中心',
    heroTitle: '全部任务',
    heroDesc: '查看公开任务和你当前可见的班级任务，后续提交与完成状态也会从这里继续扩展。',
    currentTab: 'all',
    tabs: [
      { value: 'all', label: '所有任务' },
      { value: 'mine', label: '我的任务' }
    ],
    filterClassId: '',
    filterClassName: '',
    joinedClasses: [],
    joinedClassIds: [],
    tasks: [],
    displayTasks: [],
    stats: {
      total: 0,
      myClassCount: 0,
      publicCount: 0,
      deadlineSoonCount: 0
    },
    emptyText: '当前还没有可查看的任务'
  },

  onLoad(options) {
    const filterClassId = String(options.class_id || '').trim()
    const filterClassName = decodeURIComponent(String(options.class_name || '')).trim()

    this.setData({
      filterClassId,
      filterClassName,
      pageTitle: filterClassId ? '班级任务' : '任务中心',
      heroTitle: filterClassId ? (filterClassName || '当前班级任务') : '全部任务',
      heroDesc: filterClassId
        ? '这里会聚合当前班级相关任务，你可以在“所有任务”和“我的任务”之间快速切换。'
        : '公开任务和你已加入班级的任务都会出现在这里，后续提交业务也会在这里继续闭环。'
    })

    this.initPage()
  },

  onShow() {
    if (this._pageReady) {
      this.initPage({ silent: true })
    }
  },

  onPullDownRefresh() {
    this.initPage({ refreshing: true })
  },

  async initPage({ refreshing = false, silent = false } = {}) {
    const isLoggedIn = AuthService.isLoggedIn()

    this.setData({
      loading: true,
      isLoggedIn
    })

    if (!isLoggedIn) {
      this.setData({
        loading: false,
        isRegistered: false,
        joinedClasses: [],
        joinedClassIds: [],
        tasks: [],
        displayTasks: [],
        stats: {
          total: 0,
          myClassCount: 0,
          publicCount: 0,
          deadlineSoonCount: 0
        }
      })
      wx.stopPullDownRefresh()
      return
    }

    if (!silent && !refreshing) {
      Toast.showLoading('任务列表加载中...')
    }

    try {
      const classStatus = await this.loadClassStatus()
      const tasks = await this.loadTasks(classStatus.joinedClassIds)

      this.setData({
        isRegistered: classStatus.isRegistered,
        joinedClasses: classStatus.joinedClasses,
        joinedClassIds: classStatus.joinedClassIds,
        tasks
      })
      this.applyTabFilter()
      this._pageReady = true
    } catch (error) {
      console.error('[student-task-manage] initPage error:', error)
      Toast.showToast(error.message || '任务列表加载失败')
    } finally {
      this.setData({
        loading: false
      })

      if (!silent && !refreshing) {
        Toast.hideLoading()
      }

      wx.stopPullDownRefresh()
    }
  },

  async loadClassStatus() {
    try {
      const statusInfo = await ClassService.getMyClassStatus()
      const joinedClasses = Array.isArray(statusInfo.joined_classes)
        ? statusInfo.joined_classes.map((item) => ({
          ...item,
          className: item.class_name || '未命名班级'
        }))
        : []
      const joinedClassIds = joinedClasses.map((item) => item._id).filter(Boolean)

      return {
        isRegistered: statusInfo.is_registered !== false,
        joinedClasses,
        joinedClassIds
      }
    } catch (error) {
      console.error('[student-task-manage] loadClassStatus error:', error)
      return {
        isRegistered: false,
        joinedClasses: [],
        joinedClassIds: []
      }
    }
  },

  async loadTasks(joinedClassIds = []) {
    let page = 1
    let hasMore = true
    const result = []
    const maxPages = 5

    while (hasMore && page <= maxPages) {
      const response = await TaskService.getTasks({
        page,
        page_size: 50,
        class_id: this.data.filterClassId || undefined,
        sort_by: 'publish_time',
        sort_order: 'desc'
      })

      const list = Array.isArray(response.list) ? response.list : []
      result.push(...list)
      hasMore = Boolean(response.has_more)
      page += 1
    }

    return result.map((item) => this.formatTaskItem(item, joinedClassIds))
  },

  formatTaskItem(item = {}, joinedClassIds = []) {
    const difficulty = Number(item.difficulty || 0)
    const points = Number(item.points || 0)
    const taskType = item.task_type || 'public'
    const visibility = taskType === 'public' ? 'public' : (item.visibility || 'class_only')
    const isMyTask = taskType === 'class' && joinedClassIds.includes(item.class_id)
    const isPublicTask = taskType === 'public' || visibility === 'public'

    return {
      ...item,
      titleText: item.title || '未命名任务',
      descriptionText: item.description || '暂无任务说明',
      projectText: item.project_name || item.project_code || '未设置项目',
      classText: taskType === 'class'
        ? (item.class_name || '未设置班级')
        : '全部学生可见',
      taskTypeText: TASK_TYPE_TEXT[taskType] || '未分类任务',
      visibilityText: VISIBILITY_TEXT[visibility] || '可见范围未设置',
      difficultyText: DIFFICULTY_TEXT[difficulty] || '未设置难度',
      difficultyStyle: `color:${DIFFICULTY_COLOR[difficulty] || '#6f7f91'};background:${this.toRgba(DIFFICULTY_COLOR[difficulty] || '#6f7f91', 0.12)};`,
      pointsText: `${points} 分`,
      deadlineText: taskDeadline.formatTaskDeadline(item),
      publishTimeText: item.publish_time ? this.formatDateTime(item.publish_time) : '待发布',
      imageCountText: `${Array.isArray(item.images) ? item.images.length : 0} 张图片`,
      fileCountText: `${Array.isArray(item.files) ? item.files.length : 0} 个附件`,
      scopeText: isMyTask ? '我的班级任务' : (taskType === 'class' ? '公开班级任务' : '公开任务'),
      isMyTask,
      isPublicTask,
      deadlineSoon: this.isDeadlineSoon(item)
    }
  },

  applyTabFilter() {
    const currentTab = this.data.currentTab
    const displayTasks = this.data.tasks.filter((item) => (
      currentTab === 'mine' ? item.isMyTask : true
    ))

    this.setData({
      displayTasks,
      stats: this.buildStats(displayTasks),
      emptyText: this.getEmptyText(currentTab)
    })
  },

  buildStats(list = []) {
    return {
      total: list.length,
      myClassCount: list.filter((item) => item.isMyTask).length,
      publicCount: list.filter((item) => item.isPublicTask).length,
      deadlineSoonCount: list.filter((item) => item.deadlineSoon).length
    }
  },

  getEmptyText(tab) {
    if (tab === 'mine') {
      if (this.data.filterClassId) {
        return '当前班级下还没有你可查看的班级任务'
      }
      return '你加入的班级暂时还没有任务'
    }

    if (this.data.filterClassId) {
      return '当前班级下还没有可查看的任务'
    }

    return '当前还没有可查看的任务'
  },

  isDeadlineSoon(task) {
    const deadlineDate = taskDeadline.getTaskDeadlineDate(task)
    if (!deadlineDate) {
      return false
    }

    const diff = deadlineDate.getTime() - Date.now()
    return diff > 0 && diff <= 1000 * 60 * 60 * 24 * 3
  },

  formatDateTime(value) {
    if (!value) {
      return '--'
    }

    return formatUtils.formatDate(value, 'YYYY-MM-DD HH:mm')
  },

  toRgba(hex, alpha) {
    const value = String(hex || '').replace('#', '')
    if (value.length !== 6) {
      return `rgba(31, 122, 224, ${alpha})`
    }

    const red = parseInt(value.slice(0, 2), 16)
    const green = parseInt(value.slice(2, 4), 16)
    const blue = parseInt(value.slice(4, 6), 16)

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`
  },

  onTabChange(e) {
    this.setData({
      currentTab: e.detail.value
    }, () => {
      this.applyTabFilter()
    })
  },

  goLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }

    wx.switchTab({
      url: '/pages/student/index'
    })
  },

  goToTaskDetail(e) {
    const taskId = String(e.currentTarget.dataset.taskId || '').trim()
    if (!taskId) {
      return
    }

    wx.navigateTo({
      url: `/pages/student/task-manage/task-detail/task-detail?task_id=${taskId}`
    })
  },

  onShareAppMessage() {
    return {
      title: this.data.pageTitle,
      path: `/pages/student/task-manage/task-manage${this.data.filterClassId ? `?class_id=${this.data.filterClassId}` : ''}`
    }
  }
})
