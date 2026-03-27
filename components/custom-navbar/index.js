const app = getApp()
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 导航栏标题
    title: {
      type: String,
      value: ''
    },
    // 是否显示返回按钮
    showBack: {
      type: Boolean,
      value: false
    },
    // 是否占位
    placeholder: {
      type: Boolean,
      value: false
    },
    // 自定义标题样式类
    titleClass: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
  },

  lifetimes: {
    attached() {
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    handleGoBack() {
      // 触发返回事件
      this.triggerEvent('go-back');
      // 默认返回上一页
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack({
          fail: () => {
            // 如果返回失败，跳转到首页
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        });
      } else {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }
    }
  }
})
