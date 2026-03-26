// mine.js
const AuthService = require('../../../services/auth');

const app = getApp();
Page({
  data: {
    userInfo: {},
    showLogout: false,
    isLoggedIn: false,
  },
  
  onLoad() {
    this.checkLogin()
  },

  checkLogin() {
    if (AuthService.isLoggedIn()) {
      this.setData({
        isLoggedIn: true,
        userInfo: AuthService.getUserInfo()
      })
      console.log(this.data)
    }
  },

  
  goLogin: function () {
    wx.navigateTo({
      url: '/pages/login/login?userLogin=true'
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

  handleLogout() {
    AuthService.logout()
    this.setData({
      isLoggedIn: false,
      userInfo: {}
    })
    this.closeDialog()
  },

  onShow() {
    this.checkLogin()
    this.getTabBar().changeData({ type: 'student' })
    this.getTabBar().init('/pages/student/mine/mine')
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


})
