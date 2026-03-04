// app.js
App({
  globalData: {
    openid: '',
    navBarHeight: 0, // 导航栏高度
    menuRight: 0, // 胶囊距右方间距（方保持左、右间距一致）
    menuTop: 0, // 胶囊距底部间距（保持底部间距一致）
    menuHeight: 0, // 胶囊高度（自定义内容可与胶囊高度保证一致）
  },

  onLaunch: function (options) {
    // 云开发环境初始化
    wx.cloud.init({
      // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
      env: 'cloud-base-2g8b4jrlc57cc781',
      // 是否在将用户访问记录到用户管理中，在控制台中可见，默认为false
      traceUser: false,
    });
    // 获取用户openid
    this.getUserOpenid()
    const that = this;
    // 获取系统信息
    const systemInfo = wx.getWindowInfo();
    // 胶囊按钮位置信息
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    // 导航栏高度 = 状态栏高度 + 44
    that.globalData.navBarHeight = systemInfo.statusBarHeight + 44;
    that.globalData.menuRight = systemInfo.screenWidth - menuButtonInfo.right;
    that.globalData.menuTop=  menuButtonInfo.top;
    that.globalData.menuHeight = menuButtonInfo.height;

    this.checkLogin()
  },

  checkLogin() {
    const isTeacherLogin = wx.getStorageSync('isTeacherLogin')
    const isStudentLogin = wx.getStorageSync('isStudentLogin')
    if (isTeacherLogin) {
      wx.reLaunch({
        url: '/pages/teacher/index'
      })
    }
    if (isStudentLogin) {
      wx.reLaunch({
        url: '/pages/student/index'
      })
    }
  },
  
  getUserOpenid() {
    wx.cloud.callFunction({
      name: 'cloudbase_module',
      data: {
        name: 'wx_user_get_open_id',
      },
    }).then(res => {
      if (res && res.result && res.result.openId) {
        wx.setStorageSync('openid', res.result.openId)
      }
    })
  }
})
