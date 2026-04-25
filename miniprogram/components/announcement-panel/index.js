Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    announcements: {
      type: Array,
      value: []
    }
  },

  data: {
    currentIndex: 0
  },

  observers: {
    announcements() {
      this.setData({
        currentIndex: 0
      })
    }
  },

  methods: {
    noop() {},

    getCurrentAnnouncement() {
      const list = Array.isArray(this.data.announcements) ? this.data.announcements : []
      return list[this.data.currentIndex] || null
    },

    handleRead() {
      const current = this.getCurrentAnnouncement()
      if (current) {
        this.triggerEvent('read', {
          announcement: current
        })
      }

      const list = Array.isArray(this.data.announcements) ? this.data.announcements : []
      const nextIndex = this.data.currentIndex + 1
      if (nextIndex < list.length) {
        this.setData({
          currentIndex: nextIndex
        })
        return
      }

      this.triggerEvent('close')
    },

    handleClose() {
      this.triggerEvent('close')
    },

    handleViewAll() {
      this.triggerEvent('viewall')
    },

    handleAction() {
      const current = this.getCurrentAnnouncement()
      if (current) {
        this.triggerEvent('action', {
          announcement: current
        })
      }
    }
  }
})
