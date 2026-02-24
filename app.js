// app.js
App({
  globalData: {
    openid: ''
  },

  onLaunch: function () {
    // 云开发环境初始化
    wx.cloud.init({
      // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
      env: 'cloud-base-2g8b4jrlc57cc781',
      // 是否在将用户访问记录到用户管理中，在控制台中可见，默认为false
      traceUser: false,
    });
    // 获取用户openid
    this.getUserOpenid()
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
