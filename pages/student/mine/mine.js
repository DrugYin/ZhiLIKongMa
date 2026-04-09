const AuthService = require('../../../services/auth')
const Toast = require('../../../utils/toast')

Page({
  data: {
    userInfo: {},
    showLogout: false,
    isLoggedIn: false,
    isTeacher: false,
    profileMeta: '登录后可同步任务、班级和积分信息',
    roleText: '游客',
    summary: {
      points: 0,
      currentRole: '学生',
      roleCount: 0,
      gradeText: '未完善'
    },
    primaryActions: [
      {
        key: 'task',
        title: '任务中心',
        desc: '查看公开任务与班级任务'
      },
      {
        key: 'class',
        title: '我的班级',
        desc: '管理邀请码、查看班级详情'
      },
      {
        key: 'records',
        title: '提交记录',
        desc: '统一查看任务提交、审核状态和历史反馈'
      },
      {
        key: 'setting',
        title: '账号设置',
        desc: '完善头像、昵称和基础资料'
      }
    ]
  },
  
  onLoad() {
    this.syncProfile()
  },

  syncProfile() {
    const isLoggedIn = AuthService.isLoggedIn()
    const userInfo = AuthService.getLocalUserInfo() || {}
    const roles = Array.isArray(userInfo.roles) ? userInfo.roles : []
    const currentRole = userInfo.current_role === 'teacher' ? '教师' : '学生'

    this.setData({
      isLoggedIn,
      userInfo,
      isTeacher: AuthService.hasRole('teacher'),
      profileMeta: isLoggedIn
        ? `${userInfo.school || '学校信息待补充'} · ${userInfo.grade || '年级未填写'}`
        : '登录后可同步任务、班级和积分信息',
      roleText: isLoggedIn ? currentRole : '游客',
      summary: {
        points: Number(userInfo.points || 0),
        currentRole,
        roleCount: roles.length,
        gradeText: userInfo.grade || '未完善'
      }
    })
  },
  
  goLogin() {
    wx.navigateTo({
      url: '/pages/login/login?userLogin=true'
    })
  },

  handlePrimaryAction(e) {
    const { key } = e.currentTarget.dataset

    if (key === 'task') {
      this.goToTaskCenter()
      return
    }

    if (key === 'class') {
      this.goToClassManage()
      return
    }

    if (key === 'setting') {
      this.goToSetting()
      return
    }

    if (key === 'records') {
      this.goToSubmissionRecords()
    }
  },

  goToSubmissionRecords() {
    wx.navigateTo({
      url: '/pages/student/task-manage/submission-records/submission-records'
    })
  },

  goToTaskCenter() {
    wx.navigateTo({
      url: '/pages/student/task-manage/task-manage'
    })
  },

  goToClassManage() {
    wx.navigateTo({
      url: '/pages/student/class-manage/class-manage'
    })
  },

  goToSetting() {
    wx.navigateTo({
      url: '/pages/student/setting/setting'
    })
  },

  goToTeacher() {
    Toast.showLoading('切换中...')
    AuthService.switchRole('teacher').then(res => {
      if (res) {
        Toast.showSuccess('切换成功')
        setTimeout(() => {
          wx.reLaunch({
            url: '/pages/teacher/index'
          })
        }, 1000)
      }
    }).catch(e => {
      Toast.showError(e.message)
      console.error(e)
    })
  },

  onLogout() {
    this.setData({
      showLogout: true
    })
  },

  closeDialog() {
    this.setData({
      showLogout: false
    })
  },

  async handleLogout() {
    await AuthService.logout()
    this.setData({
      isLoggedIn: false,
      userInfo: {},
      isTeacher: false
    })
    this.syncProfile()
    this.closeDialog()
  },

  onShow() {
    this.syncProfile()
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'student' })
      tabBar.init('/pages/student/mine/mine')
    }
  },
  

  onShareAppMessage() {
    return {
      title: '智力控码我的页',
      path: '/pages/student/mine/mine'
    }
  },

  onShareTimeline() {
    return {
      title: '智力控码我的页',
      path: '/pages/student/mine/mine'
    }
  },

  onPullDownRefresh() {
    if (this.data.isLoggedIn) {
      Toast.showLoading('加载中...')
      AuthService.getUserInfo().then(res => {
        Toast.hideLoading()
        AuthService.updateLocalUserInfo(res)
        this.setData({
          userInfo: res
        })
        this.syncProfile()
        wx.stopPullDownRefresh()
      }).catch(e => {
        Toast.showError(e.message)
        console.error(e)
        wx.stopPullDownRefresh()
      })
    } else {
      wx.stopPullDownRefresh()
    }
  }
})
