// pages/teacher/class-manage/class-detail/class-detail.js
const ClassService = require('../../../../services/class')
const TaskService = require('../../../../services/task')
const Toast = require('../../../../utils/toast')
const formatUtils = require('../../../../utils/format')

Page({

  /**
   * 页面的初始数据
   */
  data: {
    classId: '',
    loading: true,
    classInfo: null,
    applications: [],
    members: [],
    reviewingApplicationId: '',
    reviewAction: '',
    memberStats: {
      total: 0,
      totalPoints: 0,
      averagePoints: 0,
      latestJoinText: '暂无成员'
    },
    taskSummary: {
      total: 0,
      published: 0,
      pending: 0
    },
    latestTask: null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const classId = String(options.class_id || '').trim()

    if (!classId) {
      Toast.showToast('缺少班级ID')
      setTimeout(() => {
        wx.navigateBack()
      }, 1200)
      return
    }

    this.setData({
      classId
    })

    this.initPage()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    if (this._pageReady) {
      this.initPage({ silent: true })
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.initPage({ refreshing: true })
  },

  async initPage({ refreshing = false, silent = false } = {}) {
    const { classId } = this.data
    if (!classId) {
      wx.stopPullDownRefresh()
      return
    }

    if (!silent && !refreshing) {
      Toast.showLoading('班级信息加载中...')
    }

    this.setData({
      loading: true
    })

    try {
      const [classInfo, applications, members, latestTaskResult] = await Promise.all([
        this.loadClassDetail(),
        this.loadApplications(),
        this.loadMembers(),
        this.loadLatestTask()
      ])

      const formattedApplications = applications.map((item, index) => this.formatApplicationItem(item, index))
      const formattedMembers = members.map((item, index) => this.formatMemberItem(item, index))
      const taskSummary = this.buildTaskSummary(classInfo, latestTaskResult.total)

      this.setData({
        classInfo: this.formatClassInfo(classInfo, formattedMembers.length, formattedApplications.length),
        applications: formattedApplications,
        members: formattedMembers,
        memberStats: this.buildMemberStats(formattedMembers),
        taskSummary,
        latestTask: this.formatLatestTask(latestTaskResult.list[0], taskSummary)
      })

      this._pageReady = true
    } catch (error) {
      console.error('[class-detail] initPage error:', error)
      Toast.showToast(error.message || '班级详情加载失败')
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

  async loadClassDetail() {
    return ClassService.getClassDetail(this.data.classId)
  },

  async loadApplications() {
    let page = 1
    let hasMore = true
    const result = []

    while (hasMore) {
      const response = await ClassService.getClassApplications({
        class_id: this.data.classId,
        page,
        page_size: 50
      })
      const list = Array.isArray(response.list) ? response.list : []

      result.push(...list)
      hasMore = Boolean(response.has_more)
      page += 1
    }

    return result
  },

  async loadMembers() {
    let page = 1
    let hasMore = true
    const result = []

    while (hasMore) {
      const response = await ClassService.getClassMembers({
        class_id: this.data.classId,
        page,
        page_size: 50
      })
      const list = Array.isArray(response.list) ? response.list : []

      result.push(...list)
      hasMore = Boolean(response.has_more)
      page += 1
    }

    return result
  },

  async loadLatestTask() {
    const response = await TaskService.getTasks({
      role: 'teacher',
      class_id: this.data.classId,
      page: 1,
      page_size: 1,
      sort_by: 'update_time',
      sort_order: 'desc'
    })

    return {
      list: Array.isArray(response.list) ? response.list : [],
      total: Number(response.total || 0)
    }
  },

  formatClassInfo(item = {}, memberTotal = 0, applicationTotal = 0) {
    const memberCount = Number(item.member_count || memberTotal || 0)
    const maxMembers = Number(item.max_members || 0)
    const pendingCount = Number(item.pending_application_count || applicationTotal || 0)
    const usageRate = maxMembers > 0
      ? Math.min(100, Math.round((memberCount / maxMembers) * 100))
      : 0

    return {
      ...item,
      className: item.class_name || '未命名班级',
      projectText: item.project_name || item.project_code || '未设置项目',
      teacherName: item.teacher_name || '待补充',
      classCode: item.class_code || '--',
      memberText: maxMembers > 0 ? `${memberCount}/${maxMembers} 人` : `${memberCount} 人`,
      pendingCount,
      pendingText: `${pendingCount} 条`,
      classTimeText: item.class_time || '未设置上课时间',
      locationText: item.location || '未设置上课地点',
      descriptionText: item.description || '暂无班级说明',
      createTimeText: this.formatDateTime(item.create_time),
      updateTimeText: this.formatDateTime(item.update_time),
      usageRateText: `${usageRate}%`,
      statusText: item.status === 'active' ? '进行中' : '已停用',
      statusClass: item.status === 'active' ? 'status-active' : 'status-inactive'
    }
  },

  formatApplicationItem(item = {}, index = 0) {
    return {
      ...item,
      displayName: item.student_name || item.student_user_name || item.student_nick_name || `申请学生${index + 1}`,
      avatar: item.student_avatar || '/assets/default-avatar.png',
      gradeText: item.student_grade || '未填写年级',
      phoneText: formatUtils.formatPhone(item.student_phone) || '未填写电话',
      applyReasonText: item.apply_reason || '未填写申请理由',
      createTimeText: this.formatDateTime(item.create_time),
      relativeTimeText: item.create_time ? formatUtils.formatRelativeTime(item.create_time) : '刚刚'
    }
  },

  formatMemberItem(item = {}, index = 0) {
    const pointsValue = Number(item.total_points || item.points || 0)

    return {
      ...item,
      displayName: item.user_name || item.nick_name || `成员${index + 1}`,
      avatar: item.avatar_url || '/assets/default-avatar.png',
      gradeText: item.grade || '未填写年级',
      phoneText: formatUtils.formatPhone(item.phone) || '未填写电话',
      joinTimeText: this.formatDateTime(item.join_class_time),
      pointsValue,
      pointsText: `${pointsValue} 分`
    }
  },

  buildMemberStats(list = []) {
    if (!list.length) {
      return {
        total: 0,
        totalPoints: 0,
        averagePoints: 0,
        latestJoinText: '暂无成员'
      }
    }

    const totalPoints = list.reduce((sum, item) => sum + Number(item.pointsValue || 0), 0)
    const latestJoinTime = list.reduce((latest, item) => {
      const current = new Date(item.join_class_time || 0).getTime()
      return current > latest ? current : latest
    }, 0)

    return {
      total: list.length,
      totalPoints,
      averagePoints: Math.round(totalPoints / list.length),
      latestJoinText: latestJoinTime ? this.formatDateTime(latestJoinTime) : '未记录'
    }
  },

  buildTaskSummary(classInfo = {}, taskTotal = 0) {
    const total = Math.max(Number(taskTotal || 0), Number(classInfo.task_count || classInfo.task_total || 0))
    const published = Number(classInfo.published_task_count || 0)

    return {
      total,
      published,
      pending: Math.max(total - published, 0)
    }
  },

  formatLatestTask(taskInfo = {}, taskSummary = {}) {
    if (!taskInfo || !taskInfo._id) {
      return null
    }

    const deadline = taskInfo.deadline
      || (taskInfo.deadline_date && taskInfo.deadline_time
        ? `${taskInfo.deadline_date} ${taskInfo.deadline_time}`
        : '')
    const updateTime = taskInfo.update_time || taskInfo.publish_time || taskInfo.create_time
    const statusMap = {
      draft: '草稿',
      published: '已发布',
      closed: '已关闭'
    }

    return {
      taskId: taskInfo._id,
      title: taskInfo.title || '未命名任务',
      description: String(taskInfo.description || '').trim() || '请前往任务详情查看完整要求、素材与状态配置。',
      projectText: taskInfo.project_name || taskInfo.project_code || '未设置项目',
      pointsText: `${Number(taskInfo.points || 0)} 分`,
      deadlineText: deadline ? this.formatDateTime(deadline) : '未设置截止时间',
      updateTimeText: this.formatDateTime(updateTime),
      statusText: statusMap[taskInfo.status] || (taskSummary.published > 0 ? '最新任务' : '待配置')
    }
  },

  formatDateTime(value) {
    if (!value) {
      return '--'
    }

    return formatUtils.formatDate(value, 'YYYY-MM-DD HH:mm')
  },

  onCopyInviteCode() {
    const { classInfo } = this.data
    if (!classInfo || !classInfo.classCode || classInfo.classCode === '--') {
      Toast.showToast('暂无可复制的邀请码')
      return
    }

    wx.setClipboardData({
      data: classInfo.classCode,
      success: () => {
        Toast.showSuccess('邀请码已复制', 2000)
      }
    })
  },

  getInviteSharePath() {
    const classCode = this.data.classInfo ? this.data.classInfo.classCode : ''

    if (!classCode || classCode === '--') {
      return `/pages/teacher/class-manage/class-detail/class-detail?class_id=${this.data.classId}`
    }

    return `/pages/student/class-manage/join-confirm/join-confirm?class_code=${encodeURIComponent(classCode)}&from=teacher_share`
  },

  goToEditClass() {
    if (!this.data.classId) {
      return
    }

    wx.navigateTo({
      url: `/pages/teacher/class-manage/class-edit/class-edit?class_id=${this.data.classId}`
    })
  },

  goToTaskManage() {
    wx.switchTab({
      url: '/pages/teacher/task-manage/task-manage'
    })
  },

  goToLatestTaskDetail() {
    const taskId = this.data.latestTask && this.data.latestTask.taskId

    if (!taskId) {
      this.goToTaskManage()
      return
    }

    wx.navigateTo({
      url: `/pages/teacher/task-manage/task-detail/task-detail?task_id=${taskId}`
    })
  },

  async onRemoveMember(e) {
    const { memberOpenid, memberName } = e.currentTarget.dataset

    if (!memberOpenid || this._removing) {
      return
    }

    const confirmed = await Toast.confirm(`确认将“${memberName || '该成员'}”移出班级吗？`)
    if (!confirmed) {
      return
    }

    this._removing = true
    Toast.showLoading('正在移出成员...')

    try {
      await ClassService.removeMember(this.data.classId, memberOpenid)
      Toast.hideLoading()
      await Toast.showSuccess('成员已移出')
      await this.initPage({ silent: true })
    } catch (error) {
      console.error('[class-detail] onRemoveMember error:', error)
      Toast.hideLoading()
      Toast.showToast(error.message || '移除成员失败')
    } finally {
      this._removing = false
    }
  },

  async onReviewApplication(e) {
    const { applicationId, action, studentName } = e.currentTarget.dataset

    if (!applicationId || !['approve', 'reject'].includes(action) || this.data.reviewingApplicationId) {
      return
    }

    const actionText = action === 'approve' ? '通过' : '拒绝'
    const confirmed = await Toast.confirm(`确认${actionText}“${studentName || '该学生'}”的入班申请吗？`)

    if (!confirmed) {
      return
    }

    this.setData({
      reviewingApplicationId: applicationId,
      reviewAction: action
    })
    Toast.showLoading(`正在${actionText}申请...`)

    try {
      await ClassService.handleApplication({
        application_id: applicationId,
        action
      })
      Toast.hideLoading()
      await Toast.showSuccess(`${actionText}成功`)
      await this.initPage({ silent: true })
    } catch (error) {
      console.error('[class-detail] onReviewApplication error:', error)
      Toast.hideLoading()
      Toast.showToast(error.message || `${actionText}申请失败`)
    } finally {
      this.setData({
        reviewingApplicationId: '',
        reviewAction: ''
      })
    }
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    const className = this.data.classInfo ? this.data.classInfo.className : '班级详情'
    return {
      title: `邀请加入 ${className}`,
      path: this.getInviteSharePath()
    }
  }
})
