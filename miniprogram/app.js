// app.js
const AuthService = require('./services/auth')

App({

  onLaunch: function (options) {
    wx.cloud.init({
      env: 'zhi-li-kong-ma-7gy2aqcr1add21a7',
      traceUser: false,
    });

    this._loginReady = this._doAutoLogin();
  },

  async _doAutoLogin() {
    try {
      if (!AuthService.isLoggedIn()) {
        const res = await AuthService.wxLogin()
        if (res.is_registered) {
          AuthService.updateLocalUserInfo(res.user_info)
          this._redirectTeacherIfNeeded(res.user_info)
        }
      } else {
        const res = await AuthService.getUserInfo()
        if (res.is_registered) {
          AuthService.updateLocalUserInfo(res)
          this._redirectTeacherIfNeeded(res)
        }
      }
    } catch (error) {
      console.error('自动登录失败:', error)
    }
  },

  _redirectTeacherIfNeeded(userInfo) {
    if (!userInfo || userInfo.current_role !== 'teacher') {
      return
    }
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    if (currentPage && currentPage.route === 'pages/teacher/index') {
      return
    }
    wx.reLaunch({ url: '/pages/teacher/index' })
  },

  async awaitLogin() {
    if (this._loginReady) {
      await this._loginReady
    }
  }

})
