// custom-tab-bar/index.js
Component({
  //  组件的属性列表
  properties: {},
  //  组件的初始数据
  data: {
    value: '/pages/index/index',
    bottomSafeHeight: 0,
    tabBar: [{
      value: '/pages/index/index',
      icon: 'home',
      label: '首页',
    }, {
      value: '/pages/rank/rank',
      icon: 'leaderboard',
      label: '排行',
    }, {
      value: '/pages/student/mine/mine',
      icon: 'user',
      label: '我的',
    }]
  },

  lifetimes: {
    attached() {
      // 获取系统信息，适配不同机型的安全区
      const windowInfo = wx.getWindowInfo();
      const deviceInfo = wx.getDeviceInfo();

      const { statusBarHeight, safeAreaInsets } = windowInfo;
      const { platform } = deviceInfo;

      // 计算胶囊按钮位置信息
      let customBarHeight = statusBarHeight + 4;
      if (platform === 'android') {
        customBarHeight = statusBarHeight + 8;
      } else {
        customBarHeight = statusBarHeight + 6;
      }

      // 获取底部安全区高度
      const bottomSafeHeight = safeAreaInsets ? safeAreaInsets.bottom : 0;

      this.setData({
        statusBarHeight,
        customBarHeight,
        bottomSafeHeight
      });
    }
  },

  methods: {

    init(e) {
      this.setData({
        value: e
      })
    },

    onChange(e) {
      // 切换到新页面
      const newPageValue = e.detail.value
      this.init(newPageValue)
      wx.switchTab({
        url: newPageValue,
        fail: (err) => {
          console.error("切换失败:", err);
        }
      });
      // 更新当前组件的选中状态
      this.init(newPageValue)
    }
  },
})
