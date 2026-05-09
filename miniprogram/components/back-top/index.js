Component({
  properties: {
    scrollTop: {
      type: Number,
      value: 0
    },
    visibilityHeight: {
      type: Number,
      value: 200
    },
    text: {
      type: String,
      value: '顶部'
    }
  },

  data: {
    visible: false,
    x: -1,
    y: -1,
    lastX: -1,
    lastY: -1,
    moved: false,
    DRAG_THRESHOLD: 5
  },

  observers: {
    scrollTop(val) {
      const visible = val >= this.data.visibilityHeight
      if (visible !== this.data.visible) {
        this.setData({ visible })
      }
    }
  },

  lifetimes: {
    attached() {
      const { windowWidth, windowHeight } = wx.getSystemInfoSync()
      const x = windowWidth - 60
      const y = windowHeight - 200
      this.setData({ x, y, lastX: x, lastY: y })
    }
  },

  methods: {
    onTouchStart() {
      this.setData({ moved: false })
    },

    onChange(e) {
      const { x, y, source } = e.detail
      if (source === 'touch') {
        const dx = Math.abs(x - this.data.lastX)
        const dy = Math.abs(y - this.data.lastY)
        if (dx > this.data.DRAG_THRESHOLD || dy > this.data.DRAG_THRESHOLD) {
          this.setData({ moved: true })
        }
        this.setData({ lastX: x, lastY: y })
      }
    },

    onTap() {
      if (this.data.moved) return
      this.triggerEvent('toTop')
    }
  }
})
