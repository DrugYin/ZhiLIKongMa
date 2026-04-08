const TaskService = require('../../../services/task')
const Toast = require('../../../utils/toast')
const formatUtils = require('../../../utils/format')

const STATUS_TEXT_MAP = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回'
}

const REVIEW_ACTION_TEXT = {
  approved: {
    title: '确认通过',
    content: '通过后会给学生同步审核结果和任务积分，确认继续吗？',
    feedback: '审核通过，继续保持。',
    success: '已通过'
  },
  rejected: {
    title: '确认驳回',
    content: '驳回后学生会看到处理结果，确认继续吗？',
    feedback: '当前提交未通过，请补充说明或附件后再次提交。',
    success: '已驳回'
  }
}

Page({
  data: {
    loading: true,
    processingId: '',
    statusFilter: 'all',
    classFilter: 'all',
    statusOptions: [
      { value: 'all', label: '全部' },
      { value: 'pending', label: '待审核' },
      { value: 'processed', label: '已处理' }
    ],
    classOptions: [
      { value: 'all', label: '全部班级' }
    ],
    records: [],
    displayRecords: [],
    stats: {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0
    }
  },

  onLoad() {
    this.initPage()
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'teacher' })
      tabBar.init('/pages/teacher/pending/pending')
    }

    if (this._pageReady) {
      this.initPage({ silent: true })
    }
  },

  onPullDownRefresh() {
    this.initPage({ refreshing: true })
  },

  async initPage({ silent = false, refreshing = false } = {}) {
    if (!silent && !refreshing) {
      Toast.showLoading('审核记录加载中...')
    }

    this.setData({
      loading: true
    })

    try {
      const records = await this.loadAllSubmissions()
      const classes = Array.from(new Set(records.map((item) => item.className).filter(Boolean)))

      this.setData({
        records,
        classOptions: [{ value: 'all', label: '全部班级' }].concat(
          classes.map((item) => ({
            value: item,
            label: item
          }))
        )
      })

      this.applyFilters()
      this._pageReady = true
    } catch (error) {
      console.error('[teacher-pending] initPage error:', error)
      Toast.showToast(error.message || '审核记录加载失败')
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

  async loadAllSubmissions() {
    const result = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await TaskService.getSubmissions({
        role: 'teacher',
        page,
        page_size: 50
      })
      const list = Array.isArray(response.list) ? response.list : []

      result.push(...list.map((item) => this.formatRecord(item)))
      hasMore = Boolean(response.has_more)
      page += 1
    }

    return result
  },

  formatRecord(item = {}) {
    const status = item.status || 'pending'
    const imageCount = Array.isArray(item.images) ? item.images.length : 0
    const fileCount = Array.isArray(item.files) ? item.files.length : 0
    const summary = String(item.description || '').trim()
    const feedback = String(item.feedback || '').trim()

    return {
      ...item,
      id: item._id,
      studentName: item.student_name || '未命名学生',
      className: item.class_name || '未分班',
      taskTitle: item.task_title || '未命名任务',
      projectText: item.project_name || item.project_code || '未设置项目',
      status,
      statusText: STATUS_TEXT_MAP[status] || '待处理',
      summary: summary || (status === 'pending' ? '学生未填写提交说明。' : (feedback || '该提交已完成审核。')),
      feedbackText: feedback,
      submittedAt: item.submit_time ? this.formatDateTime(item.submit_time) : '刚刚提交',
      source: '任务提交',
      attachmentText: `${imageCount} 张图片 · ${fileCount} 个附件`,
      scoreText: item.score === null || item.score === undefined ? '待评分' : `${Number(item.score)} 分`,
      pointsText: `${Number(item.points_earned || 0)} 分`,
      overtimeText: item.is_overtime ? '超时提交' : '按时提交'
    }
  },

  applyFilters() {
    const { records, statusFilter, classFilter } = this.data
    const displayRecords = records.filter((item) => {
      const matchedStatus = statusFilter === 'all'
        ? true
        : statusFilter === 'processed'
          ? item.status !== 'pending'
          : item.status === statusFilter
      const matchedClass = classFilter === 'all' ? true : item.className === classFilter
      return matchedStatus && matchedClass
    })

    this.setData({
      displayRecords,
      stats: {
        total: records.length,
        pending: records.filter((item) => item.status === 'pending').length,
        approved: records.filter((item) => item.status === 'approved').length,
        rejected: records.filter((item) => item.status === 'rejected').length
      }
    })
  },

  formatDateTime(value) {
    if (!value) {
      return '--'
    }

    return formatUtils.formatDate(value, 'YYYY-MM-DD HH:mm')
  },

  onStatusFilterChange(e) {
    const { value } = e.currentTarget.dataset
    this.setData(
      {
        statusFilter: value
      },
      () => {
        this.applyFilters()
      }
    )
  },

  onClassFilterChange(e) {
    const { value } = e.currentTarget.dataset
    this.setData(
      {
        classFilter: value
      },
      () => {
        this.applyFilters()
      }
    )
  },

  async handleReviewAction(status, record) {
    if (!record || !record.id || this.data.processingId) {
      return
    }

    const actionConfig = REVIEW_ACTION_TEXT[status]
    const confirmed = await Toast.confirm(actionConfig.content, actionConfig.title)

    if (!confirmed) {
      return
    }

    this.setData({
      processingId: record.id
    })

    try {
      const reviewedRecord = await TaskService.reviewSubmission({
        submission_id: record.id,
        status,
        feedback: actionConfig.feedback
      })

      const records = this.data.records.map((item) => (
        item.id === record.id ? this.formatRecord(reviewedRecord) : item
      ))

      this.setData({
        records
      }, () => {
        this.applyFilters()
      })

      Toast.showSuccess(actionConfig.success, 1500)
    } catch (error) {
      console.error('[teacher-pending] handleReviewAction error:', error)
      Toast.showToast(error.message || '审核操作失败')
    } finally {
      this.setData({
        processingId: ''
      })
    }
  },

  handleApprove(e) {
    const { id } = e.currentTarget.dataset
    const record = this.data.records.find((item) => item.id === id)
    this.handleReviewAction('approved', record)
  },

  handleReject(e) {
    const { id } = e.currentTarget.dataset
    const record = this.data.records.find((item) => item.id === id)
    this.handleReviewAction('rejected', record)
  },

  goToTaskManage() {
    wx.switchTab({
      url: '/pages/teacher/task-manage/task-manage'
    })
  },

  onShareAppMessage() {
    return {
      title: '智力控码任务审核',
      path: '/pages/teacher/pending/pending'
    }
  }
})
