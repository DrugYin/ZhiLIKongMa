Page({
  data: {
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
      this.applyFilters()
    }
  },

  onPullDownRefresh() {
    this.initPage()
  },

  initPage() {
    const records = this.buildMockRecords()
    const classes = Array.from(new Set(records.map((item) => item.className)))

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
    wx.stopPullDownRefresh()
  },

  buildMockRecords() {
    return [
      {
        id: 'pending-1',
        studentName: '赵昱睿',
        className: '黑羊赛道一班',
        status: 'pending',
        statusText: '待审核',
        summary: '已提交周任务训练记录，等待老师确认。',
        submittedAt: '5分钟前',
        source: '任务打卡',
        attachmentText: '2 张图片 · 1 个附件'
      },
      {
        id: 'pending-2',
        studentName: '兰光宸',
        className: '机器人创想班',
        status: 'pending',
        statusText: '待审核',
        summary: '申请加入班级并填写了入班原因。',
        submittedAt: '12分钟前',
        source: '入班申请',
        attachmentText: '1 条申请说明'
      },
      {
        id: 'pending-3',
        studentName: '李雨桐',
        className: '黑羊赛道一班',
        status: 'pending',
        statusText: '待审核',
        summary: '提交本周算法训练记录，备注了题目难点。',
        submittedAt: '32分钟前',
        source: '任务打卡',
        attachmentText: '3 张图片'
      },
      {
        id: 'approved-1',
        studentName: '陈知予',
        className: '无人机体验班',
        status: 'approved',
        statusText: '已通过',
        summary: '入班申请已处理，等待学生查看结果。',
        submittedAt: '今天 09:10',
        source: '入班申请',
        attachmentText: '已完成审核'
      },
      {
        id: 'rejected-1',
        studentName: '吴梓涵',
        className: '机器人创想班',
        status: 'rejected',
        statusText: '已驳回',
        summary: '提交材料不完整，已提醒补充后再提交。',
        submittedAt: '昨天 17:40',
        source: '任务打卡',
        attachmentText: '需补充说明'
      },
      {
        id: 'approved-2',
        studentName: '周若溪',
        className: '黑羊赛道二班',
        status: 'approved',
        statusText: '已通过',
        summary: '本周训练记录审核通过，已计入班级进度。',
        submittedAt: '昨天 15:00',
        source: '任务打卡',
        attachmentText: '2 张图片'
      }
    ]
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

  updateRecordStatus(id, status) {
    const statusTextMap = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已驳回'
    }

    const records = this.data.records.map((item) => (
      item.id === id
        ? {
          ...item,
          status,
          statusText: statusTextMap[status],
          attachmentText: status === 'approved' ? '审核完成，结果已同步' : '已记录处理意见'
        }
        : item
    ))

    this.setData({ records }, () => {
      this.applyFilters()
    })
  },

  handleApprove(e) {
    const { id } = e.currentTarget.dataset
    this.updateRecordStatus(id, 'approved')
    wx.showToast({
      title: '已通过',
      icon: 'success'
    })
  },

  handleReject(e) {
    const { id } = e.currentTarget.dataset
    this.updateRecordStatus(id, 'rejected')
    wx.showToast({
      title: '已驳回',
      icon: 'success'
    })
  },

  goToClassManage() {
    wx.navigateTo({
      url: '/pages/teacher/class-manage/class-manage'
    })
  },

  goToTaskManage() {
    wx.switchTab({
      url: '/pages/teacher/task-manage/task-manage'
    })
  },

  onShareAppMessage() {
    return {
      title: '智力控码审核中心',
      path: '/pages/teacher/pending/pending'
    }
  }
})
