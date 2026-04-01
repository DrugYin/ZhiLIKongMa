// custom-tab-bar/index.js
Component({
  //  组件的属性列表
  properties: {},
  //  组件的初始数据
  data: {
    value: '',
    bottomSafeHeight: 0,
    tabBar: []
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

    changeData(e) {
      const { type } = e
      if (type === 'student') {
        this.setData({
          tabBar: [{
            value: '/pages/student/index',
            icon: 'home',
            label: '首页',
          }, {
            value: '/pages/student/rank/rank',
            icon: 'leaderboard',
            label: '排行',
          }, {
            value: '/pages/student/mine/mine',
            icon: 'user',
            label: '我的',
          }]
        })
      } else {
        this.setData({
          tabBar: [{
            value: '/pages/teacher/index',
            icon: 'home',
            label: '首页',
          }, {
            value: '/pages/teacher/pending/pending',
            icon: 'pen-ball',
            label: '审核'
          }, {
            value: '/pages/teacher/mission-manage/mission-manage',
            icon: 'task',
            label: '任务'
          }, {
            value: '/pages/teacher/mine/mine',
            icon: 'user',
            label: '我的'
          }]
        })
      }
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
