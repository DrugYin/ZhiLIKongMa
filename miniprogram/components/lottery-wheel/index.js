Component({
  properties: {
    prizes: {
      type: Array,
      value: [],
      observer: 'drawWheel'
    },
    disabled: {
      type: Boolean,
      value: false
    },
    size: {
      type: Number,
      value: 300
    }
  },

  data: {
    spinning: false
  },

  lifetimes: {
    attached() {
      this._canvas = null
      this._ctx = null
      this._currentAngle = 0
      this._animTimer = null
    },
    ready() {
      this.initCanvas()
    },
    detached() {
      this._destroyed = true
      this.stopAnimation()
    }
  },

  methods: {
    initCanvas() {
      const query = this.createSelectorQuery()
      query.select('#wheel-canvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) return
          this._canvas = res[0].node
          this._ctx = this._canvas.getContext('2d')
          const dpr = wx.getWindowInfo().pixelRatio
          this._canvas.width = this.data.size * dpr
          this._canvas.height = this.data.size * dpr
          this._ctx.scale(dpr, dpr)
          this.drawWheel()
        })
    },

    drawWheel() {
      if (!this._ctx) return
      const ctx = this._ctx
      const prizes = this.data.prizes
      const r = this.data.size / 2
      const len = prizes.length

      ctx.clearRect(0, 0, this.data.size, this.data.size)

      if (!len) {
        ctx.fillStyle = '#e8edf2'
        ctx.beginPath()
        ctx.arc(r, r, r - 4, 0, 2 * Math.PI)
        ctx.fill()
        ctx.fillStyle = '#97a3b7'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('暂无奖品', r, r)
        return
      }

      const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF8C32', '#C084FC', '#F472B6', '#34D399']

      const sliceAngle = (2 * Math.PI) / len
      for (let i = 0; i < len; i += 1) {
        const startAngle = this._currentAngle + i * sliceAngle
        const endAngle = startAngle + sliceAngle

        ctx.beginPath()
        ctx.moveTo(r, r)
        ctx.arc(r, r, r - 4, startAngle, endAngle)
        ctx.closePath()
        ctx.fillStyle = colors[i % colors.length]
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.save()
        ctx.translate(r, r)
        ctx.rotate(startAngle + sliceAngle / 2)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 12px sans-serif'
        ctx.fillText(prizes[i].name || '', r * 0.58, 0)
        ctx.restore()
      }

      this.drawCenter(r)
    },

    drawCenter(r) {
      const ctx = this._ctx
      const centerR = 48

      ctx.beginPath()
      ctx.arc(r, r, centerR, 0, 2 * Math.PI)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.closePath()

      ctx.beginPath()
      ctx.arc(r, r, centerR, 0, 2 * Math.PI)
      ctx.strokeStyle = 'rgba(0,0,0,0.06)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.closePath()

      ctx.fillStyle = '#333'
      ctx.font = 'bold 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(this.data.spinning ? '旋转中' : '抽奖', r, r)
    },

    startSpin(targetIndex) {
      if (this.data.spinning || this.data.disabled) return

      const prizes = this.data.prizes
      if (!prizes.length) return

      if (targetIndex === undefined || targetIndex === null) {
        targetIndex = Math.floor(Math.random() * prizes.length)
      }

      this.setData({ spinning: true })

      const sliceAngle = (2 * Math.PI) / prizes.length
      const targetAngle = 2 * Math.PI * 5 + (2 * Math.PI - (targetIndex * sliceAngle + sliceAngle / 2 + this._currentAngle % (2 * Math.PI)))
      const duration = 4000
      const startTime = Date.now()
      const startAngle = this._currentAngle

      const animStep = () => {
        if (this._destroyed) return
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        this._currentAngle = startAngle + targetAngle * eased
        this.drawWheel()

        if (progress < 1) {
          this._animTimer = setTimeout(animStep, 16)
        } else {
          this.setData({ spinning: false })
          this.triggerEvent('result', { index: targetIndex, prize: prizes[targetIndex] })
        }
      }

      animStep()
    },

    stopAnimation() {
      if (this._animTimer) {
        clearTimeout(this._animTimer)
        this._animTimer = null
      }
    }
  }
})
