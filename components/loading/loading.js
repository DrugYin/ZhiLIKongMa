// components/loading/loading.js
Component({
  properties: {
    // 加载文案
    text: {
      type: String,
      value: '加载中...'
    },
    // 是否显示
    show: {
      type: Boolean,
      value: true
    },
    // 加载图标大小
    size: {
      type: String,
      value: 'medium' // small, medium, large
    },
    // 是否垂直排列
    vertical: {
      type: Boolean,
      value: true
    },
    // 遮罩层
    mask: {
      type: Boolean,
      value: false
    }
  },

  data: {},

  methods: {}
});
