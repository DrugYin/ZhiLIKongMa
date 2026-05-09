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
    x: 630,
    y: 1100,
    lastX: 630,
    lastY: 1100,
    moved: false,
    DRAG_THRESHOLD: 5
  },

  observers: {
    scrollTop(val) {
      this.setData({ visible: val >= this.data.visibilityHeight })
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
        this.setData({ x, y, lastX: x, lastY: y })
      }
    },

    onTap() {
      if (this.data.moved) return
      this.triggerEvent('toTop')
    }
  }
})
