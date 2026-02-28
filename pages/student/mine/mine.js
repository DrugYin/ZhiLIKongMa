// mine.js
import Toast, { hideToast } from 'tdesign-miniprogram/toast';

const app = getApp();
Page({
  data: {
    userInfo: [],
    loginCode: '',
    isLogin: false,
    showLogout: false,
  },
  onShow() {
    this.loadUserInfo()
    this.getTabBar().init('/pages/student/mine/mine')
  },

  onLoad() {

  },

  goLogin: function () {
    wx.navigateTo({
      url: '/pages/login/login?userLogin=true'
    })
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

  showLoading() {
    Toast({
      context: this,
      selector: '#t-toast',
      message: '加载中...',
      theme: 'loading',
      direction: 'column',
    });
  },

  hideLoading() {
    hideToast({
      context: this,
      selector: '#t-toast',
    });
  },

  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    const isStudentLogin = wx.getStorageSync('isStudentLogin')
    const isTeacherLogin = wx.getStorageSync('isTeacherLogin')
    if (userInfo && (isStudentLogin || isTeacherLogin)) {
      this.setData({
        userInfo: userInfo,
        isLogin: true,
      })
    }
    if (this.data.isLogin) {
      this.updateUserInfo()
    }
  },

  updateUserInfo() {
    try {
      const openid = wx.getStorageSync('openid')
      wx.cloud.callFunction({
        name: 'get-user-info',
        data: {
          openid: openid
        }
      }).then(res => {
        if (res && res.result && res.result.code === 200) {
          const userInfo = res.result.data
          this.setData({
            userInfo: userInfo
          })
          wx.setStorageSync('userInfo', userInfo)
        }
      })
    } catch(e) {
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
      console.log(e)
    }
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
    this.setData({
      showLogout: false
    })
    this.showLoading()
    wx.removeStorageSync('userInfo')
    wx.removeStorageSync('isStudentLogin')
    wx.removeStorageSync('isTeacherLogin')
    this.setData({
      userInfo: [],
      isLogin: false
    })
    this.hideLoading()
  }

})
