const AuthService = require('../../../services/auth')
const projectService = require('../../../config/project')
const TaskService = require('../../../services/task')
const ClassService = require('../../../services/class')
const Toast = require('../../../utils/toast')
const formatUtils = require('../../../utils/format')
const taskDeadline = require('../../../utils/task-deadline')

const DEFAULT_PROJECT_OPTIONS = [
  { value: 'all', label: '全部项目' }
]

const DEFAULT_TASK_TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'public', label: '公开任务' },
  { value: 'class', label: '班级任务' }
]

const DEFAULT_CLASS_OPTIONS = [
  { value: 'all', label: '全部班级' }
]

const DEFAULT_VISIBILITY_OPTIONS = [
  { value: 'all', label: '全部范围' },
  { value: 'public', label: '公开可见' },
  { value: 'class_only', label: '仅班级成员' }
]

const DEFAULT_SORT_OPTIONS = [
  { value: 'publish_time desc', label: '最近发布' },
  { value: 'deadline asc', label: '截止时间' },
  { value: 'points desc', label: '积分优先' },
  { value: 'difficulty desc', label: '难度优先' }
]

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
    projects: {
      value: 'all',
      options: DEFAULT_PROJECT_OPTIONS
    },
    taskTypes: {
      value: 'all',
      options: DEFAULT_TASK_TYPE_OPTIONS
    },
    classes: {
      value: 'all',
      options: DEFAULT_CLASS_OPTIONS
    },
    visibility: {
      value: 'all',
      options: DEFAULT_VISIBILITY_OPTIONS
    },
    sorted: {
      value: 'publish_time desc',
      options: DEFAULT_SORT_OPTIONS
    },
    stats: {
      total: 0,
      myClassCount: 0,
      publicCount: 0,
      deadlineSoonCount: 0
    },
    emptyText: '当前还没有可查看的任务',
    page: 1,
    pageSize: 20,
    hasMore: true,
    loadingMore: false,
    totalFromBackend: 0
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

    if (filterClassId) {
      this.setData({
        'taskTypes.value': 'class',
        'classes.value': filterClassId
      })
    }

    this.initPage()
  },

  onShow() {
    if (this._pageReady) {
      this.loadTaskPage({ refresh: true })
    }
  },

  onPullDownRefresh() {
    this.loadTaskPage({ refresh: true }).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  async initPage({ refreshing = false, silent = false } = {}) {
    const isLoggedIn = AuthService.isLoggedIn()

    if (!refreshing && !silent) {
      this.setData({
        loading: true,
        isLoggedIn
      })
    }

    if (!isLoggedIn) {
      this.setData({
        loading: false,
        isRegistered: false,
        joinedClasses: [],
        joinedClassIds: [],
        tasks: [],
        displayTasks: [],
        'classes.options': DEFAULT_CLASS_OPTIONS,
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
      const [projectOptions, classStatus] = await Promise.all([
        this.loadProjectOptions(),
        this.loadClassStatus()
      ])
      const classOptions = this.buildClassOptions(classStatus.joinedClasses)
      const nextClassValue = this.getAvailableClassFilterValue(classOptions)

      this.setData({
        isRegistered: classStatus.isRegistered,
        joinedClasses: classStatus.joinedClasses,
        joinedClassIds: classStatus.joinedClassIds,
        'projects.options': DEFAULT_PROJECT_OPTIONS.concat(projectOptions),
        'classes.options': classOptions,
        'classes.value': nextClassValue
      })
      await this.loadTaskPage({ refresh: true })
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

  async loadProjectOptions() {
    try {
      return await projectService.getProjectOptions()
    } catch (error) {
      console.error('[student-task-manage] loadProjectOptions error:', error)
      return []
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

  async loadTaskPage({ refresh = false } = {}) {
    if (this.data.loadingMore) return
    if (!refresh && !this.data.hasMore) return

    if (refresh) {
      this.setData({ page: 1, hasMore: true, tasks: [] })
    }

    this.setData({ loadingMore: true })

    try {
      const { sortBy, sortOrder } = this.parseSortValue(this.data.sorted.value)
      const taskTypeValue = this.data.taskTypes.value
      const visibilityValue = this.data.visibility.value
      const classValue = this.data.classes.value

      const params = {
        page: this.data.page,
        page_size: this.data.pageSize,
        sort_by: sortBy,
        sort_order: sortOrder
      }

      if (this.data.filterClassId) {
        params.class_id = this.data.filterClassId
      } else if (taskTypeValue === 'class' && classValue !== 'all') {
        params.class_id = classValue
      }
      if (taskTypeValue !== 'all' && taskTypeValue !== 'class') {
        params.task_type = taskTypeValue
      }
      if (taskTypeValue === 'class') {
        params.task_type = 'class'
      }
      if (visibilityValue !== 'all') {
        params.visibility = visibilityValue
      }

      const response = await TaskService.getTasks(params)
      const list = Array.isArray(response.list) ? response.list : []
      const formattedNew = list.map((item) => this.formatTaskItem(item, this.data.joinedClassIds))

      const newTasks = refresh ? formattedNew : [...this.data.tasks, ...formattedNew]
      const nextHasMore = Boolean(response.has_more)
      const totalFromBackend = refresh ? (response.total || 0) : this.data.totalFromBackend

      this.setData({
        tasks: newTasks,
        page: this.data.page + 1,
        hasMore: nextHasMore,
        totalFromBackend
      })
      this.applyFilters()
    } catch (error) {
      console.error('[student-task-manage] loadTaskPage error:', error)
      if (refresh) {
        Toast.showToast(error.message || '任务列表加载失败')
      }
    } finally {
      this.setData({ loadingMore: false })
    }
  },

  onScrollToLower() {
    this.loadTaskPage()
  },

  buildClassOptions(joinedClasses = []) {
    const options = joinedClasses
      .filter((item) => item && item._id)
      .map((item) => ({
        value: item._id,
        label: item.className || item.class_name || '未命名班级'
      }))

    return DEFAULT_CLASS_OPTIONS.concat(options)
  },

  getAvailableClassFilterValue(classOptions = []) {
    if (this.data.filterClassId) {
      const hasCurrentClass = classOptions.some((item) => item.value === this.data.filterClassId)
      return hasCurrentClass ? this.data.filterClassId : 'all'
    }

    const currentValue = this.data.classes.value
    return classOptions.some((item) => item.value === currentValue) ? currentValue : 'all'
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

  parseSortValue(value) {
    const [sortBy = 'publish_time', sortOrder = 'desc'] = String(value || '').split(' ')
    return {
      sortBy,
      sortOrder
    }
  },

  applyFilters() {
    const {
      currentTab,
      tasks,
      projects,
      taskTypes,
      classes,
      visibility,
      sorted
    } = this.data
    const projectCode = projects.value
    const taskTypeValue = taskTypes.value
    const classValue = classes.value
    const visibilityValue = visibility.value
    const { sortBy, sortOrder } = this.parseSortValue(sorted.value)

    let displayTasks = tasks.slice()

    if (currentTab === 'mine') {
      displayTasks = displayTasks.filter((item) => item.isMyTask)
    }

    if (projectCode !== 'all') {
      displayTasks = displayTasks.filter((item) => item.project_code === projectCode)
    }

    if (taskTypeValue !== 'all') {
      displayTasks = displayTasks.filter((item) => item.task_type === taskTypeValue)
    }

    if (taskTypeValue === 'class' && classValue !== 'all') {
      displayTasks = displayTasks.filter((item) => String(item.class_id || '') === String(classValue))
    }

    if (visibilityValue !== 'all') {
      displayTasks = displayTasks.filter((item) => {
        const itemVisibility = item.task_type === 'public' ? 'public' : (item.visibility || 'class_only')
        return itemVisibility === visibilityValue
      })
    }

    this.setData({
      displayTasks,
      stats: this.buildStats(displayTasks),
      emptyText: this.getEmptyText(currentTab, {
        projectCode,
        taskTypeValue,
        classValue,
        visibilityValue
      })
    })
  },

  buildStats(list = []) {
    return {
      total: this.data.totalFromBackend || list.length,
      myClassCount: list.filter((item) => item.isMyTask).length,
      publicCount: list.filter((item) => item.isPublicTask).length,
      deadlineSoonCount: list.filter((item) => item.deadlineSoon).length
    }
  },

  getEmptyText(tab, filters = {}) {
    const hasFilter =
      filters.projectCode !== 'all' ||
      filters.taskTypeValue !== 'all' ||
      filters.classValue !== 'all' ||
      filters.visibilityValue !== 'all'

    if (hasFilter) {
      return '当前筛选条件下暂无任务'
    }

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
      this.loadTaskPage({ refresh: true })
    })
  },

  onFilterSelect(e) {
    const { field, value } = e.currentTarget.dataset
    const currentGroup = this.data[field] || {}

    if (!field || value === undefined || currentGroup.value === value) {
      return
    }

    const nextData = {
      [`${field}.value`]: value
    }

    if (field === 'taskTypes' && value !== 'class' && !this.data.filterClassId) {
      nextData['classes.value'] = 'all'
    }

    this.setData(nextData, () => {
      this.loadTaskPage({ refresh: true })
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
