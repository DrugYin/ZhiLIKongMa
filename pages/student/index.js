// pages/student/index.js
const app = getApp()
Page({
  data: {
    userInfo: {}, // 用户信息
    tempAvatarUrl: '', // 头像临时链接
    currentTask: {}, // 当前周任务
    taskProgress: { current: 0, total: 0 }, // 打卡进度
    userStats: {
      totalRank: 0, // 总排名
      completedTasks: 0, // 总完成任务数
      badgeCount: 0 // 徽章数
    },
    announcement: '', // 公告内容
    showAnnouncement: false // 是否显示公告
  },

  onLoad(options) {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'student' })
    }
    this.initPage()
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'student' })
      tabBar.init('/pages/student/index')
    }
    this.loadPageData()
  },

  onShareAppMessage() {
    return {
      title: '智力控码',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
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
    this.loadUserInfo()
    this.loadAnnouncement()
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    // TODO: 从云数据库加载学员信息
    // 1. 获取学员基本信息（姓名、头像、段位、积分等）
    // 2. 处理头像URL（如果是云存储路径需要获取临时链接）
    // 3. 更新userInfo和tempAvatarUrl数据
    const userInfo = wx.getStorageSync('userInfo') || {}
    
    // 处理头像URL
    if (userInfo.avatarUrl) {
      if (userInfo.avatarUrl.startsWith('cloud://')) {
        wx.cloud.getTempFileURL({
          fileList: [userInfo.avatarUrl]
        }).then(tempRes => {
          if (tempRes.fileList && tempRes.fileList[0] && tempRes.fileList[0].status === 0) {
            this.setData({
              tempAvatarUrl: tempRes.fileList[0].tempFileURL
            })
          }
        }).catch(err => {
          console.log('获取临时链接失败', err)
        })
      } else {
        this.setData({
          tempAvatarUrl: userInfo.avatarUrl
        })
      }
    }
    
    this.setData({ userInfo })
  },

  /**
   * 加载公告
   */
  loadAnnouncement() {
    // TODO: 从云数据库获取公告信息
    // 1. 查询最新的公告记录
    // 2. 检查公告是否过期
    // 3. 更新announcement和showAnnouncement
  },

  /**
   * 加载页面数据
   */
  loadPageData() {
    // TODO: 加载所有首页需要的数据
    return Promise.all([
      this.loadCurrentTask(),
      this.loadUserStats()
    ])
  },

  /**
   * 加载当前周任务
   */
  loadCurrentTask() {
    // TODO: 从云数据库查询当前周任务
    // 1. 查询当前生效的周任务
    // 2. 查询学员本周的打卡记录
    // 3. 计算打卡进度
    // 4. 更新currentTask和taskProgress
    return new Promise((resolve) => {
      // 临时mock数据
      this.setData({
        currentTask: {
          name: '黑羊赛道 - 第8周',
          description: '本周训练重点：速度与稳定性',
          thumbnail: '/assets/task-bg.png'
        },
        taskProgress: {
          current: 2,
          total: 3
        }
      })
      resolve()
    })
  },

  /**
   * 加载用户统计数据
   */
  loadUserStats() {
    // TODO: 从云数据库计算用户统计数据
    // 1. 查询总排名
    // 2. 统计总完成任务数
    // 3. 统计徽章数量
    // 4. 更新userStats数据
    return new Promise((resolve) => {
      // 临时mock数据
      this.setData({
        userStats: {
          totalRank: 5,
          completedTasks: 8,
          badgeCount: 8
        }
      })
      resolve()
    })
  },

  /**
   * 关闭公告
   */
  closeAnnouncement() {
    this.setData({ showAnnouncement: false })
  },

  /**
   * 去打卡
   */
  goToCheckIn(e) {
    // TODO: 跳转到打卡页面
    // 1. 检查任务状态（是否已结束）
    // 2. 检查今日是否已打卡
    // 3. 跳转到训练打卡页面
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },
  
  /**
   * 查看任务详情
   */
  viewTaskDetail() {
    // TODO: 跳转到任务详情页面
    // 1. 传递任务ID
    // 2. 显示任务详细介绍、规则说明等
    wx.navigateTo({
      url: '/pages/student/training/training'
    })
  },

  /**
   * 跳转到排行榜
   */
  goToRank() {
    wx.switchTab({
      url: '/pages/student/rank/rank'
    })
  },

  /**
   * 跳转到任务中心
   */
  goToTaskCenter() {
    // TODO: 跳转到任务中心页面
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  /**
   * 跳转到徽章墙
   */
  goToBadgeWall() {
    // TODO: 跳转到徽章墙页面
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  }
})
