const { callApi } = require('../../utils/api')
const { formatTime, statusText } = require('../../utils/util')

const app = getApp()

Page({
  data: {
    loading: false,
    submitting: false,
    result: null,
    error: '',
    inputCode: '',
    role: 'user',
    myOpenid: ''
  },

  onShow() {
    const user = app.globalData.user
    this.setData({
      role: user ? user.role : 'user',
      myOpenid: user ? user.openid : ''
    })
  },

  onScan() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        const code = (res.result || '').trim()
        if (code) this.handleCode(code)
      },
      fail: () => {
        // 用户取消扫码，不处理
      }
    })
  },

  onInput(e) {
    this.setData({ inputCode: e.detail.value })
  },

  onManualSearch() {
    const code = this.data.inputCode.trim()
    if (!code) {
      wx.showToast({ title: '请输入物品编码', icon: 'none' })
      return
    }
    this.handleCode(code)
  },

  handleCode(code) {
    this.setData({ loading: true, result: null, error: '' })
    callApi('getItemByCode', { code })
      .then((data) => {
        const item = data.item
        const records = (data.records || []).map((r) => ({
          ...r,
          timeText: formatTime(r.time),
          actionText: r.action === 'borrow' ? '借出' : '归还'
        }))
        this.setData({
          result: {
            ...item,
            statusText: statusText(item.status),
            borrowTimeText: item.borrowTime ? formatTime(item.borrowTime) : ''
          },
          records,
          loading: false
        })
      })
      .catch((err) => {
        this.setData({ loading: false, error: err.message })
      })
  },

  onBorrow() {
    const item = this.data.result
    wx.showModal({
      title: '确认借出',
      content: '确认借出「' + item.name + '」吗？',
      success: (res) => {
        if (!res.confirm) return
        this.setData({ submitting: true })
        callApi('borrowItem', { code: item.code })
          .then(() => {
            wx.showToast({ title: '借出成功', icon: 'success' })
            this.handleCode(item.code)
          })
          .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
          .finally(() => this.setData({ submitting: false }))
      }
    })
  },

  onReturn() {
    const item = this.data.result
    wx.showModal({
      title: '确认归还',
      content: '确认归还「' + item.name + '」吗？',
      success: (res) => {
        if (!res.confirm) return
        this.setData({ submitting: true })
        callApi('returnItem', { code: item.code })
          .then(() => {
            wx.showToast({ title: '归还成功', icon: 'success' })
            this.handleCode(item.code)
          })
          .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
          .finally(() => this.setData({ submitting: false }))
      }
    })
  }
})
