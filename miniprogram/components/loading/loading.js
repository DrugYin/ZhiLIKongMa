Component({
  properties: {
    text: {
      type: String,
      value: '加载中...'
    },
    show: {
      type: Boolean,
      value: true
    },
    size: {
      type: String,
      value: 'medium' // small, medium, large
    },
    vertical: {
      type: Boolean,
      value: true
    },
    mask: {
      type: Boolean,
      value: false
    }
  }
});
