const projectService = require('../../../config/project')
const TaskService = require('../../../services/task')
const Toast = require('../../../utils/toast')
const formatUtils = require('../../../utils/format')

const DEFAULT_PROJECT_OPTIONS = [
  { value: 'all', label: '全部项目' }
]

const DEFAULT_TASK_TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'public', label: '公开任务' },
  { value: 'class', label: '班级任务' }
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
    refreshing: false,
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
    }
  },

  onLoad() {
    this.initPage()
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'teacher' })
      tabBar.init('/pages/teacher/task-manage/task-manage')
    }

    if (this._pageReady) {
      this.loadTasks({ silent: true })
    }
  },

  onPullDownRefresh() {
    this.initPage({ refreshing: true })
  },

  async initPage({ refreshing = false } = {}) {
    this.setData({
      loading: !refreshing,
      refreshing
    })

    try {
      await Promise.all([
        this.loadProjects(),
        this.loadTasks({ silent: refreshing })
      ])
      this._pageReady = true
    } catch (error) {
      console.error('[task-manage] initPage error:', error)
      Toast.showToast(error.message || '任务列表加载失败')
    } finally {
      this.setData({
        loading: false,
        refreshing: false
      })
      wx.stopPullDownRefresh()
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

  async loadTasks({ silent = false } = {}) {
    if (!silent) {
      Toast.showLoading('任务加载中...')
    }

    try {
      const sortConfig = this.parseSortValue(this.data.sorted.value)
      const tasks = await this.fetchAllTasks(sortConfig)
      const formattedTasks = tasks.map((item) => this.formatTaskItem(item))

      this.setData({
        tasks: formattedTasks
      })
      this.applyFilters()
    } catch (error) {
      console.error('[task-manage] loadTasks error:', error)
      Toast.showToast(error.message || '任务列表加载失败')
    } finally {
      if (!silent) {
        Toast.hideLoading()
      }
    }
  },

  async fetchAllTasks(sortConfig) {
    let page = 1
    let hasMore = true
    const result = []
    const maxPages = 5

    while (hasMore && page <= maxPages) {
      const response = await TaskService.getTasks({
        role: 'teacher',
        page,
        page_size: 50,
        sort_by: sortConfig.sortBy,
        sort_order: sortConfig.sortOrder
      })

      const list = Array.isArray(response.list) ? response.list : []
      result.push(...list)
      hasMore = Boolean(response.has_more)
      page += 1
    }

    return result
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
    const deadline = item.deadline || item.deadline_date

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
      deadlineText: deadline ? this.formatDateTime(deadline) : '未设置截止时间',
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
    const { tasks, projects, taskTypes, visibility, status, sorted } = this.data
    const projectCode = projects.value
    const taskTypeValue = taskTypes.value
    const visibilityValue = visibility.value
    const statusValue = status.value
    const { sortBy, sortOrder } = this.parseSortValue(sorted.value)

    let displayTasks = tasks.slice()

    if (projectCode !== 'all') {
      displayTasks = displayTasks.filter((item) => item.project_code === projectCode)
    }

    if (taskTypeValue !== 'all') {
      displayTasks = displayTasks.filter((item) => item.task_type === taskTypeValue)
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

    displayTasks.sort((left, right) => this.compareTaskItem(left, right, sortBy, sortOrder))

    this.setData({
      displayTasks,
      stats: {
        total: displayTasks.length,
        published: displayTasks.filter((item) => item.status === 'published').length,
        publicCount: displayTasks.filter((item) => item.task_type === 'public').length,
        classCount: displayTasks.filter((item) => item.task_type === 'class').length
      },
      emptyText: projectCode === 'all' && taskTypeValue === 'all' && visibilityValue === 'all' && statusValue === 'all'
        ? '还没有任务，等编辑页接入后就可以从这里开始发布'
        : '当前筛选条件下暂无任务'
    })
  },

  compareTaskItem(left, right, sortBy, sortOrder) {
    const direction = sortOrder === 'asc' ? 1 : -1
    const leftValue = this.getSortableValue(left, sortBy)
    const rightValue = this.getSortableValue(right, sortBy)

    if (leftValue === rightValue) {
      return 0
    }

    return leftValue > rightValue ? direction : -direction
  },

  getSortableValue(item, sortBy) {
    if (sortBy === 'difficulty' || sortBy === 'points') {
      return Number(item[sortBy] || 0)
    }

    const value = item[sortBy]
    if (!value) {
      return 0
    }

    const time = new Date(value).getTime()
    return Number.isNaN(time) ? String(value) : time
  },

  onDropdownChange(e) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail

    this.setData({
      [`${field}.value`]: value
    }, () => {
      if (field === 'sorted') {
        this.loadTasks({ silent: true })
        return
      }

      this.applyFilters()
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
      await this.loadTasks({ silent: true })
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
