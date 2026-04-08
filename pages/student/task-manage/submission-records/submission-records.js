const TaskService = require('../../../../services/task')
const Toast = require('../../../../utils/toast')
const formatUtils = require('../../../../utils/format')
const {
  SUBMISSION_STATUS_TEXT,
  SUBMISSION_STATUS_COLOR
} = require('../../../../utils/constant')

Page({
  data: {
    taskId: '',
    loading: true,
    loadingMore: false,
    taskInfo: null,
    records: [],
    total: 0,
    page: 1,
    pageSize: 10,
    hasMore: false,
    stats: {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0
    }
  },

  onLoad(options) {
    const taskId = String(options.task_id || '').trim()

    if (!taskId) {
      Toast.showToast('缺少任务ID')
      setTimeout(() => {
        wx.navigateBack()
      }, 1200)
      return
    }

    this.setData({
      taskId
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

  async initPage({ silent = false, refreshing = false } = {}) {
    if (!silent && !refreshing) {
      Toast.showLoading('提交记录加载中...')
    }

    this.setData({
      loading: true,
      page: 1
    })

    try {
      const [taskInfo, submissionRes] = await Promise.all([
        TaskService.getTaskDetail(this.data.taskId),
        TaskService.getSubmissions({
          task_id: this.data.taskId,
          page: 1,
          page_size: this.data.pageSize
        })
      ])

      const records = this.formatSubmissionList(submissionRes.list)
      this.setData({
        taskInfo: this.formatTaskInfo(taskInfo),
        records,
        total: Number(submissionRes.total || 0),
        hasMore: Boolean(submissionRes.has_more),
        stats: this.buildStats(records, Number(submissionRes.total || 0))
      })
      this._pageReady = true
    } catch (error) {
      console.error('[submission-records] initPage error:', error)
      Toast.showToast(error.message || '提交记录加载失败')
    } finally {
      this.setData({
        loading: false
      })
      Toast.hideLoading()
      wx.stopPullDownRefresh()
    }
  },

  formatTaskInfo(item = {}) {
    return {
      ...item,
      titleText: item.title || '未命名任务',
      projectText: item.project_name || item.project_code || '未设置项目',
      classText: item.task_type === 'class'
        ? (item.class_name || '未设置班级')
        : '公开任务'
    }
  },

  formatSubmissionList(list = []) {
    return (Array.isArray(list) ? list : []).map((item) => this.formatSubmissionItem(item))
  },

  formatSubmissionItem(item = {}) {
    const status = item.status || 'pending'
    const statusColor = SUBMISSION_STATUS_COLOR[status] || '#faad14'
    const imageCount = Array.isArray(item.images) ? item.images.length : 0
    const fileCount = Array.isArray(item.files) ? item.files.length : 0
    const submitNo = Number(item.submit_no || 0)
    const scoreValue = item.score === null || item.score === undefined ? '' : `${Number(item.score)} 分`

    return {
      ...item,
      submitNoText: submitNo || '--',
      statusText: SUBMISSION_STATUS_TEXT[status] || '待处理',
      statusStyle: `color:${statusColor};background:${this.toRgba(statusColor, 0.12)};`,
      submitTimeText: item.submit_time ? this.formatDateTime(item.submit_time) : '刚刚提交',
      descriptionText: String(item.description || '').trim() || '本次提交未填写说明',
      materialText: `${imageCount} 张图片 / ${fileCount} 个附件`,
      feedbackText: String(item.feedback || '').trim(),
      scoreText: scoreValue || '待评分',
      overtimeText: item.is_overtime ? '已超截止时间提交' : '按时提交'
    }
  },

  buildStats(records = [], total = 0) {
    return {
      total,
      pending: records.filter((item) => item.status === 'pending').length,
      approved: records.filter((item) => item.status === 'approved').length,
      rejected: records.filter((item) => item.status === 'rejected').length
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

  async onLoadMore() {
    if (this.data.loadingMore || !this.data.hasMore) {
      return
    }

    const nextPage = this.data.page + 1

    this.setData({
      loadingMore: true
    })

    try {
      const submissionRes = await TaskService.getSubmissions({
        task_id: this.data.taskId,
        page: nextPage,
        page_size: this.data.pageSize
      })
      const records = this.data.records.concat(this.formatSubmissionList(submissionRes.list))

      this.setData({
        page: nextPage,
        records,
        total: Number(submissionRes.total || 0),
        hasMore: Boolean(submissionRes.has_more),
        stats: this.buildStats(records, Number(submissionRes.total || 0))
      })
    } catch (error) {
      console.error('[submission-records] onLoadMore error:', error)
      Toast.showToast(error.message || '加载更多失败')
    } finally {
      this.setData({
        loadingMore: false
      })
    }
  },

  goToSubmit() {
    wx.navigateTo({
      url: `/pages/student/task-manage/submission-edit/submission-edit?task_id=${this.data.taskId}`
    })
  }
})
