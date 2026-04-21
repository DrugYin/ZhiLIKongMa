// components/empty/empty.js
Component({
  properties: {
    // 图标类型
    icon: {
      type: String,
      value: 'default' // default, search, data, network, order, message
    },
    // 标题
    title: {
      type: String,
      value: '暂无数据'
    },
    // 描述
    description: {
      type: String,
      value: ''
    },
    // 按钮文案
    buttonText: {
      type: String,
      value: ''
    },
    // 是否显示
    show: {
      type: Boolean,
      value: true
    },
    // 图片大小
    imageSize: {
      type: String,
      value: 'medium' // small, medium, large
    }
  },

  data: {},

  methods: {
    onButtonTap() {
      this.triggerEvent('buttontap');
    }
  }
});
