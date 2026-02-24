Component({
  //  组件的属性列表
  properties: { },
  //  组件的初始数据
  data: {
    value: '/pages/index/index',
    tabBar: [{
      value: '/pages/index/index',
      icon: 'home',
      label: '首页',
    }, {
      value: '/pages/student/mine/mine',
      icon: 'user',
      label: '我的',
    }]
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
