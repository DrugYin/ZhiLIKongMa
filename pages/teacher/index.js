// pages/teacher/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {}, // 用户信息
    greeting: '', // 问候语
    pendingCount: 0, // 待审核打卡数量
    weeklyStats: {
      totalStudents: 0, // 总学员数
      weeklyCheckIns: 0, // 本周打卡次数
      completionRate: 0 // 完成率
    },
    recentActivities: [] // 最近动态列表
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'teacher' })
    }
    this.initPage()
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'teacher' })
      tabBar.init('/pages/teacher/index')
    }
    this.loadPageData()
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadPageData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '智力控码',
      path: '/pages/index/index'
    }
  },

  /**
   * 初始化页面
   */
  initPage() {
    // TODO: 初始化页面数据
    this.setGreeting()
    this.loadUserInfo()
  },

  /**
   * 设置问候语
   */
  setGreeting() {
    const hour = new Date().getHours()
    let greeting = '晚上好'
    if (hour < 12) {
      greeting = '上午好'
    } else if (hour < 18) {
      greeting = '下午好'
    }
    this.setData({ greeting })
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    // TODO: 从云数据库加载教师用户信息
    // 1. 获取教师基本信息（姓名、头像等）
    // 2. 更新userInfo数据
    const userInfo = wx.getStorageSync('teacherInfo') || {}
    this.setData({ userInfo })
  },

  /**
   * 加载页面数据
   */
  loadPageData() {
    // TODO: 加载所有首页需要的数据
    return Promise.all([
      this.loadPendingCount(),
      this.loadWeeklyStats(),
      this.loadRecentActivities()
    ])
  },

  /**
   * 加载待审核打卡数量
   */
  loadPendingCount() {
    // TODO: 从云数据库查询待审核的打卡记录数量
    // 1. 查询打卡状态为"待审核"的记录
    // 2. 统计数量并更新pendingCount
    // 3. 返回Promise
    return new Promise((resolve) => {
      // 临时mock数据
      this.setData({ pendingCount: 24 })
      resolve()
    })
  },

  /**
   * 加载本周统计数据
   */
  loadWeeklyStats() {
    // TODO: 从云数据库计算本周统计数据
    // 1. 统计总学员数
    // 2. 统计本周打卡次数（计算时间范围：本周一到当前）
    // 3. 计算完成率（本周打卡次数 / （总学员数 * 天数））
    // 4. 更新weeklyStats数据
    return new Promise((resolve) => {
      // 临时mock数据
      this.setData({
        weeklyStats: {
          totalStudents: 45,
          weeklyCheckIns: 86,
          completionRate: 76
        }
      })
      resolve()
    })
  },

  /**
   * 加载最近动态
   */
  loadRecentActivities() {
    // TODO: 从云数据库查询最近动态记录
    // 1. 查询最近的操作记录（打卡提交、审核通过、任务发布等）
    // 2. 按时间倒序排列
    // 3. 限制返回数量（如最近10条）
    // 4. 更新recentActivities数据
    return new Promise((resolve) => {
      // 临时mock数据
      this.setData({
        recentActivities: [
          { id: 1, type: 'checkin', content: '赵昱睿 提交打卡', time: '2分钟前' },
          { id: 2, type: 'approve', content: '兰光宸 通过审核', time: '15分钟前' },
          { id: 3, type: 'publish', content: '"测试任务"已发布', time: '1小时前' }
        ]
      })
      resolve()
    })
  },

  /**
   * 跳转到审核页面
   */
  goToReview() {
    // TODO: 跳转到待审核列表页面
    // 1. 导航到待审核打卡页面
    // 2. 可传递筛选参数（如按班级、按时间等）
    wx.navigateTo({
      url: '/pages/teacher/pending/pending'
    })
  },

  /**
   * 跳转到任务管理
   */
  goToTaskManage() {
    // TODO: 跳转到任务管理页面
    wx.switchTab({
      url: '/pages/teacher/task-manage/task-manage'
    })
  },

  /**
   * 跳转到班级管理
   */
  goToClassManage() {
    wx.navigateTo({
      url: '/pages/teacher/class-manage/class-manage',
    })
  },

  /**
   * 跳转到待审核
   */
  goToPending() {
    wx.switchTab({
      url: '/pages/teacher/pending/pending',
    })
  },

  /**
   * 查看全部动态
   */
  viewAllActivities() {
    // TODO: 跳转到全部动态/操作日志页面
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  }
})
