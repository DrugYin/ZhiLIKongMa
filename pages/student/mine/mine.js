// mine.js
const AuthService = require('../../../services/auth')
const Toast = require('../../../utils/toast')

const app = getApp();
Page({
  data: {
    userInfo: {},
    showLogout: false,
    isLoggedIn: false,
    isTeacher: false
  },
  
  onLoad() {
    this.checkLogin()
  },

  checkLogin() {
    if (AuthService.isLoggedIn()) {
      this.setData({
        isLoggedIn: true,
        userInfo: AuthService.getLocalUserInfo()
      })
      if (AuthService.hasRole('teacher')) {
        this.setData({
          isTeacher: true
        })
      }
    }
  },
  
  goLogin: function () {
    wx.navigateTo({
      url: '/pages/login/login?userLogin=true'
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
    this.closeDialog()
  },

  onShow() {
    this.checkLogin()
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'student' })
      tabBar.init('/pages/student/mine/mine')
    }
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

  onPullDownRefresh() {
    if (this.data.isLoggedIn) {
      Toast.showLoading('加载中...')
      AuthService.getUserInfo().then(res => {
        Toast.hideLoading()
        AuthService.updateLocalUserInfo(res)
        this.setData({
          userInfo: res
        })
        this.checkLogin()
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
