// app.js
const AuthService = require('./services/auth')

App({

  onLaunch: function (options) {
    // 云开发环境初始化
    wx.cloud.init({
      // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
      env: 'zhi-li-kong-ma-7gy2aqcr1add21a7',
      // 是否在将用户访问记录到用户管理中，在控制台中可见，默认为false
      traceUser: false,
    });
    if (!AuthService.isLoggedIn()) {
      // 用户未登录，执行登录流程
      AuthService.wxLogin().then(res => {
        if (res.is_registered) {
          AuthService.updateLocalUserInfo(res.user_info);
        }
      }).catch((error) => {
        console.error('登录失败:', error);
      });
    } else {
      AuthService.getUserInfo().then(res => {
        if (res.is_registered) {
          AuthService.updateLocalUserInfo(res);
        }
        if (res.current_role === 'teacher') {
          wx.reLaunch({
            url: '/pages/teacher/index'
          })
        }
      }).catch(e => {
        console.error('获取用户信息失败:', e);
      })
    }

  }

})
