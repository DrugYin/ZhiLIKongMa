Component({
  properties: {
    icon: {
      type: String,
      value: 'default' // default, search, data, network, order, message
    },
    title: {
      type: String,
      value: '暂无数据'
    },
    description: {
      type: String,
      value: ''
    },
    buttonText: {
      type: String,
      value: ''
    },
    show: {
      type: Boolean,
      value: true
    },
    imageSize: {
      type: String,
      value: 'medium' // small, medium, large
    }
  },

  methods: {
    onButtonTap() {
      this.triggerEvent('buttontap');
    }
  }
});
