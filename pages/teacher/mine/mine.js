// pages/teacher/mine/mine.js
const AuthService = require('../../../services/auth')
const Toast = require('../../../utils/toast')

Page({
  data: {
    userInfo: {},
    summary: {
      currentRole: '教师',
      roleCount: 0,
      points: 0,
      gradeText: '未填写'
    }
  },

  onLoad() {
    this.syncProfile()
  },

  goToStudent() {
    Toast.showLoading('切换中...')
    AuthService.switchRole('student').then(res => {
      if (res) {
        Toast.showSuccess('切换成功')
        setTimeout(() => {
          wx.reLaunch({
            url: '/pages/student/index'
          })
        }, 1000)
      }
    }).catch(e => {
      Toast.showError(e.message)
    })
  },

  goToPending() {
    wx.switchTab({
      url: '/pages/teacher/pending/pending'
    })
  },

  goToTaskManage() {
    wx.switchTab({
      url: '/pages/teacher/task-manage/task-manage'
    })
  },

  goToClassManage() {
    wx.navigateTo({
      url: '/pages/teacher/class-manage/class-manage'
    })
  },

  syncProfile() {
    const userInfo = AuthService.getLocalUserInfo() || {}
    const roles = Array.isArray(userInfo.roles) ? userInfo.roles : []

    this.setData({
      userInfo,
      summary: {
        currentRole: userInfo.current_role === 'student' ? '学生' : '教师',
        roleCount: roles.length,
        points: Number(userInfo.points || 0),
        gradeText: userInfo.grade || '未填写'
      }
    })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出当前教师账号吗？',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        await AuthService.logout()
        wx.reLaunch({
          url: '/pages/login/login'
        })
      }
    })
  },
  onShow() {
    this.syncProfile()
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'teacher' })
      tabBar.init('/pages/teacher/mine/mine')
    }
  },

  onPullDownRefresh() {
    this.syncProfile()
    wx.stopPullDownRefresh()
  },

  onShareAppMessage() {
    return {
      title: '智力控码教师资料页',
      path: '/pages/teacher/mine/mine'
    }
  }
})
