// pages/teacher/class-manage/class-manage.js
const projectService = require('../../../config/project')
const ClassService = require('../../../services/class')
const Toast = require('../../../utils/toast')
const formatUtils = require('../../../utils/format.js')

const DEFAULT_PROJECT_OPTIONS = [
  { value: 'all', label: '全部项目' }
]

const DEFAULT_SORT_OPTIONS = [
  { value: 'create_time desc', label: '时间降序' },
  { value: 'create_time asc', label: '时间升序' },
  { value: 'member_count desc', label: '人数降序' },
  { value: 'member_count asc', label: '人数升序' }
]

Page({

  /**
   * 页面的初始数据
   */
  data: {
    loading: true,
    refreshing: false,
    classes: [],
    displayClasses: [],
    stats: {
      total: 0,
      active: 0
    },
    emptyText: '暂未创建班级，点击右下角按钮开始创建',
    projects: {
      value: 'all',
      options: DEFAULT_PROJECT_OPTIONS
    },
    sorted: {
      value: 'create_time desc',
      options: DEFAULT_SORT_OPTIONS
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.initPage()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    if (this._pageReady) {
      this.loadClasses({ silent: true })
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
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
        this.loadClasses({ silent: refreshing })
      ])
      this._pageReady = true
    } catch (error) {
      console.error('[class-manage] initPage error:', error)
      Toast.showToast(error.message || '班级列表加载失败')
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
      console.error('[class-manage] loadProjects error:', error)
      Toast.showToast('项目列表加载失败')
    }
  },

  async loadClasses({ silent = false } = {}) {
    if (!silent) {
      Toast.showLoading('班级加载中...')
    }

    try {
      const sortConfig = this.parseSortValue(this.data.sorted.value)
      const classes = await this.fetchAllClasses(sortConfig)
      const formattedClasses = classes.map((item) => this.formatClassItem(item))

      this.setData({
        classes: formattedClasses
      })
      this.applyFilters()
    } catch (error) {
      console.error('[class-manage] loadClasses error:', error)
      Toast.showToast(error.message || '班级列表加载失败')
    } finally {
      if (!silent) {
        Toast.hideLoading()
      }
    }
  },

  async fetchAllClasses(sortConfig) {
    let page = 1
    let hasMore = true
    const result = []

    while (hasMore) {
      const response = await ClassService.getClasses({
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
    const [sortBy = 'create_time', sortOrder = 'desc'] = String(value || '').split(' ')
    return {
      sortBy,
      sortOrder
    }
  },

  formatClassItem(item = {}) {
    const memberCount = Number(item.member_count || 0)
    const maxMembers = Number(item.max_members || 0)
    const createTime = this.formatClassDateTime(item.create_time)
    const updateTime = this.formatClassDateTime(item.update_time)

    return {
      ...item,
      memberText: maxMembers > 0 ? `${memberCount}/${maxMembers} 人` : `${memberCount} 人`,
      projectText: item.project_name || item.project_code || '未设置项目',
      classTimeText: item.class_time || '未设置上课时间',
      locationText: item.location || '未设置上课地点',
      descriptionText: item.description || '暂无班级说明',
      createTimeText: createTime || '暂无创建时间',
      updateTimeText: updateTime || '暂无更新时间',
      statusText: this.getStatusText(item.status),
      statusClass: item.status === 'active' ? 'status-active' : 'status-inactive'
    }
  },

  formatClassDateTime(value) {
    if (!value) {
      return ''
    }

    return formatUtils.formatDate(value, 'YYYY-MM-DD HH:mm')
  },

  getStatusText(status) {
    switch (status) {
      case 'active':
        return '进行中'
      case 'inactive':
        return '已停用'
      default:
        return status || '未知状态'
    }
  },

  applyFilters() {
    const { classes, projects, sorted } = this.data
    const projectCode = projects.value
    const { sortBy, sortOrder } = this.parseSortValue(sorted.value)

    let displayClasses = classes.slice()

    if (projectCode !== 'all') {
      displayClasses = displayClasses.filter((item) => item.project_code === projectCode)
    }

    displayClasses.sort((left, right) => this.compareClassItem(left, right, sortBy, sortOrder))

    const activeCount = displayClasses.filter((item) => item.status === 'active').length

    this.setData({
      displayClasses,
      stats: {
        total: displayClasses.length,
        active: activeCount
      },
      emptyText: projectCode === 'all'
        ? '暂未创建班级，点击右下角按钮开始创建'
        : '当前筛选条件下暂无班级'
    })
  },

  compareClassItem(left, right, sortBy, sortOrder) {
    const direction = sortOrder === 'asc' ? 1 : -1
    const leftValue = this.getSortableValue(left, sortBy)
    const rightValue = this.getSortableValue(right, sortBy)

    if (leftValue === rightValue) {
      return 0
    }

    return leftValue > rightValue ? direction : -direction
  },

  getSortableValue(item, sortBy) {
    const value = item[sortBy]

    if (sortBy === 'member_count') {
      return Number(value || 0)
    }

    if (sortBy === 'class_name') {
      return String(value || '')
    }

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
        this.loadClasses({ silent: true })
        return
      }

      this.applyFilters()
    })
  },

  goToAddClass() {
    wx.navigateTo({
      url: '/pages/teacher/class-manage/class-edit/class-edit'
    })
  },

  goToEditClass(e) {
    const { classId } = e.currentTarget.dataset
    if (!classId) {
      return
    }

    wx.navigateTo({
      url: `/pages/teacher/class-manage/class-edit/class-edit?class_id=${classId}`
    })
  },

  async onDeleteClass(e) {
    const { classId, className } = e.currentTarget.dataset
    if (!classId) {
      return
    }

    const confirmed = await Toast.confirm(`确认删除班级“${className || '未命名班级'}”吗？`)
    if (!confirmed) {
      return
    }

    Toast.showToast('删除接口待接入，当前仅完成页面交互')
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '班级管理',
      path: '/pages/teacher/class-manage/class-manage'
    }
  }
})
