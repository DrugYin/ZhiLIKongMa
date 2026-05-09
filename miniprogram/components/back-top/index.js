Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    }
  },

  data: {
    x: -1,
    y: -1,
    lastX: -1,
    lastY: -1,
    moved: false,
    DRAG_THRESHOLD: 5
  },

  lifetimes: {
    attached() {
      const { windowWidth, windowHeight } = wx.getWindowInfo()
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
