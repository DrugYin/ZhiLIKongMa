const projectService = require('../../../config/project')
const ClassService = require('../../../services/class')
const TaskService = require('../../../services/task')
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
  { value: 'class_only', label: '班级可见' }
]

const DEFAULT_STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'published', label: '已发布' },
  { value: 'draft', label: '草稿' },
  { value: 'closed', label: '已关闭' }
]

const DEFAULT_SORT_OPTIONS = [
  { value: 'update_time desc', label: '最近更新' },
  { value: 'publish_time desc', label: '最近发布' },
  { value: 'deadline asc', label: '截止时间' },
  { value: 'difficulty desc', label: '难度优先' },
  { value: 'points desc', label: '积分优先' }
]

const TASK_STATUS_TEXT = {
  draft: '草稿',
  published: '已发布',
  closed: '已关闭'
}

const TASK_STATUS_CLASS = {
  draft: 'status-draft',
  published: 'status-published',
  closed: 'status-closed'
}

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
    scrollTop: 0,
    tasks: [],
    displayTasks: [],
    stats: {
      total: 0,
      published: 0,
      publicCount: 0,
      classCount: 0
    },
    emptyText: '还没有任务，等编辑页接入后就可以从这里开始发布',
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
    status: {
      value: 'all',
      options: DEFAULT_STATUS_OPTIONS
    },
    sorted: {
      value: 'update_time desc',
      options: DEFAULT_SORT_OPTIONS
    },
    page: 1,
    pageSize: 20,
    hasMore: true,
    loadingMore: false,
    totalFromBackend: 0,
    statsLoading: true
  },

  onLoad() {
    this.initPage()
    this._observer = this.createIntersectionObserver()
    this._observer.relativeToViewport({ top: 0 }).observe('#back-top-sentinel', (res) => {
      this.setData({ backTopVisible: res.intersectionRatio < 1 })
    })
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'teacher' })
      tabBar.init('/pages/teacher/task-manage/task-manage')
    }

    if (this._pageReady) {
      this.loadTaskPage({ refresh: true, silent: true }).catch((error) => {
        console.error('[task-manage] onShow refresh error:', error)
      })
    }
  },

  async initPage() {
    this.setData({
      loading: true
    })

    try {
      await Promise.all([
        this.loadProjects(),
        this.loadFilterClasses({ silent: true })
      ])
      await this.loadTaskPage({ refresh: true })
      this.loadStats()
      this._pageReady = true
    } catch (error) {
      console.error('[task-manage] initPage error:', error)
      Toast.showToast(error.message || '任务列表加载失败')
    } finally {
      this.setData({
        loading: false
      })
    }
  },

  async loadProjects() {
    try {
      const options = await projectService.getProjectOptions()
      this.setData({
        'projects.options': DEFAULT_PROJECT_OPTIONS.concat(options)
      })
    } catch (error) {
      console.error('[task-manage] loadProjects error:', error)
      Toast.showToast('项目列表加载失败')
    }
  },

  async loadFilterClasses({ silent = false } = {}) {
    if (!silent) {
      Toast.showLoading('班级筛选加载中...')
    }

    try {
      const options = await this.fetchClassOptions()
      const currentValue = this.data.classes.value
      const hasCurrentValue = options.some((item) => item.value === currentValue)

      this.setData({
        'classes.options': DEFAULT_CLASS_OPTIONS.concat(options),
        'classes.value': hasCurrentValue ? currentValue : 'all'
      })
    } catch (error) {
      console.error('[task-manage] loadFilterClasses error:', error)
      Toast.showToast(error.message || '班级筛选加载失败')
    } finally {
      if (!silent) {
        Toast.hideLoading()
      }
    }
  },

  async fetchClassOptions() {
    let page = 1
    let hasMore = true
    const options = []
    const maxPages = 5

    while (hasMore && page <= maxPages) {
      const response = await ClassService.getClasses({
        role: 'teacher',
        page,
        page_size: 50,
        sort_by: 'update_time',
        sort_order: 'desc'
      })

      const list = Array.isArray(response.list) ? response.list : []
      list.forEach((item) => {
        if (!item || !item._id) {
          return
        }

        options.push({
          value: item._id,
          label: item.class_name || '未命名班级'
        })
      })

      hasMore = Boolean(response.has_more)
      page += 1
    }

    return options
  },

  async loadTaskPage({ refresh = false, silent = false } = {}) {
    if (this.data.loadingMore) return
    if (!refresh && !this.data.hasMore) return

    if (refresh) {
      this.setData({ page: 1, hasMore: true, tasks: [] })
    }

    this.setData({ loadingMore: true })

    if (!silent && refresh) {
      Toast.showLoading('任务加载中...')
    }

    try {
      const sortConfig = this.parseSortValue(this.data.sorted.value)
      const { taskTypes, classes, visibility, status } = this.data

      const params = {
        role: 'teacher',
        page: this.data.page,
        page_size: this.data.pageSize,
        sort_by: sortConfig.sortBy,
        sort_order: sortConfig.sortOrder
      }

      if (taskTypes.value !== 'all') {
        params.task_type = taskTypes.value
      }
      if (taskTypes.value === 'class' && classes.value !== 'all') {
        params.class_id = classes.value
      }
      if (visibility.value !== 'all') {
        params.visibility = visibility.value
      }
      if (status.value !== 'all') {
        params.status = status.value
      }

      const response = await TaskService.getTasks(params)
      const list = Array.isArray(response.list) ? response.list : []
      const formattedNew = list.map((item) => this.formatTaskItem(item))

      const newTasks = refresh ? formattedNew : [...this.data.tasks, ...formattedNew]
      const totalFromBackend = refresh ? (response.total || 0) : this.data.totalFromBackend

      this.setData({
        tasks: newTasks,
        page: this.data.page + 1,
        hasMore: Boolean(response.has_more),
        totalFromBackend
      })
      this.applyFilters()
    } catch (error) {
      console.error('[task-manage] loadTaskPage error:', error)
      if (refresh) {
        Toast.showToast(error.message || '任务列表加载失败')
      }
    } finally {
      this.setData({ loadingMore: false })
      if (!silent && refresh) {
        Toast.hideLoading()
      }
    }
  },

  onScrollToLower() {
    this.loadTaskPage()
  },

  onBackToTop() {
    this.setData({ scrollTop: 99999 }, () => {
      this.setData({ scrollTop: 0 })
    })
  },

  async loadStats() {
    try {
      const taskTypeValue = this.data.taskTypes.value
      const classValue = this.data.classes.value
      const visibilityValue = this.data.visibility.value
      const statusValue = this.data.status.value

      const baseParams = {
        role: 'teacher',
        page: 1,
        page_size: 1,
        count_only: true
      }

      if (taskTypeValue !== 'all') {
        baseParams.task_type = taskTypeValue
        if (taskTypeValue === 'class' && classValue !== 'all') {
          baseParams.class_id = classValue
        }
      }
      if (visibilityValue !== 'all') {
        baseParams.visibility = visibilityValue
      }
      if (statusValue !== 'all') {
        baseParams.status = statusValue
      }

      const [totalRes, publishedRes, publicRes, classRes] = await Promise.all([
        TaskService.getTasks({ ...baseParams }),
        TaskService.getTasks({ ...baseParams, status: 'published' }),
        TaskService.getTasks({ ...baseParams, task_type: 'public' }),
        TaskService.getTasks({ ...baseParams, task_type: 'class' })
      ])

      this.setData({
        statsLoading: false,
        stats: {
          ...this.data.stats,
          total: totalRes.total || 0,
          published: publishedRes.total || 0,
          publicCount: publicRes.total || 0,
          classCount: classRes.total || 0
        }
      })
    } catch (error) {
      console.error('[task-manage] loadStats error:', error)
    }
  },

  parseSortValue(value) {
    const [sortBy = 'update_time', sortOrder = 'desc'] = String(value || '').split(' ')
    return {
      sortBy,
      sortOrder
    }
  },

  formatTaskItem(item = {}) {
    const difficulty = Number(item.difficulty || 0)
    const points = Number(item.points || 0)
    const taskType = item.task_type || 'public'
    const visibility = taskType === 'public' ? 'public' : (item.visibility || 'class_only')
    const status = item.status || 'draft'
    return {
      ...item,
      titleText: item.title || '未命名任务',
      descriptionText: item.description || '暂无任务说明',
      projectText: item.project_name || item.project_code || '未设置项目',
      classText: taskType === 'class'
        ? (item.class_name || '未设置班级')
        : '面向全部学生',
      taskTypeText: TASK_TYPE_TEXT[taskType] || '未分类任务',
      visibilityText: VISIBILITY_TEXT[visibility] || '可见范围未设置',
      statusText: TASK_STATUS_TEXT[status] || '未知状态',
      statusClass: TASK_STATUS_CLASS[status] || 'status-draft',
      difficultyText: DIFFICULTY_TEXT[difficulty] || '未设置难度',
      difficultyStyle: `color:${DIFFICULTY_COLOR[difficulty] || '#6f7f91'};background:${this.toRgba(DIFFICULTY_COLOR[difficulty] || '#6f7f91', 0.12)};`,
      pointsText: `${points} 分`,
      deadlineText: taskDeadline.formatTaskDeadline(item),
      publishTimeText: item.publish_time ? this.formatDateTime(item.publish_time) : '待发布',
      updateTimeText: item.update_time ? this.formatDateTime(item.update_time) : '待更新',
      imageCountText: `${Array.isArray(item.images) ? item.images.length : 0} 张图片`,
      fileCountText: `${Array.isArray(item.files) ? item.files.length : 0} 个附件`
    }
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

  applyFilters() {
    const { tasks, projects, taskTypes, classes, visibility, status } = this.data
    const projectCode = projects.value
    const taskTypeValue = taskTypes.value
    const classValue = classes.value
    const visibilityValue = visibility.value
    const statusValue = status.value

    let displayTasks = tasks.slice()

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
        const itemVisibility = item.task_type === 'public' ? 'public' : item.visibility
        return itemVisibility === visibilityValue
      })
    }

    if (statusValue !== 'all') {
      displayTasks = displayTasks.filter((item) => item.status === statusValue)
    }

    this.setData({
      displayTasks,
      emptyText: projectCode === 'all' && taskTypeValue === 'all' && classValue === 'all' && visibilityValue === 'all' && statusValue === 'all'
        ? '还没有任务，等编辑页接入后就可以从这里开始发布'
        : '当前筛选条件下暂无任务'
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

    if (field === 'taskTypes' && value !== 'class') {
      nextData['classes.value'] = 'all'
    }

    this.setData(nextData, () => {
      this.loadTaskPage({ refresh: true, silent: true })
      this.loadStats().catch(() => {})
    })
  },

  goToTaskDetail(e) {
    const { taskId } = e.currentTarget.dataset
    if (!taskId) {
      return
    }

    wx.navigateTo({
      url: `/pages/teacher/task-manage/task-detail/task-detail?task_id=${taskId}`
    })
  },

  goToAddTask() {
    const query = []

    if (this.data.projects.value && this.data.projects.value !== 'all') {
      query.push(`project_code=${encodeURIComponent(this.data.projects.value)}`)
    }

    wx.navigateTo({
      url: `/pages/teacher/task-manage/task-edit/task-edit${query.length ? `?${query.join('&')}` : ''}`
    })
  },

  async onDeleteTask(e) {
    const { taskId, taskTitle } = e.currentTarget.dataset
    if (!taskId) {
      return
    }

    const confirmed = await Toast.confirm(`确认删除任务“${taskTitle || '未命名任务'}”吗？`)
    if (!confirmed) {
      return
    }

    Toast.showLoading('正在删除任务...')

    try {
      await TaskService.deleteTask(taskId)
      Toast.hideLoading()
      await Toast.showSuccess('任务已删除')
      await this.loadTaskPage({ refresh: true, silent: true })
    } catch (error) {
      console.error('[task-manage] onDeleteTask error:', error)
      Toast.hideLoading()
      Toast.showToast(error.message || '删除任务失败')
    }
  },

  onShareAppMessage() {
    return {
      title: '任务管理',
      path: '/pages/teacher/task-manage/task-manage'
    }
  }
})
