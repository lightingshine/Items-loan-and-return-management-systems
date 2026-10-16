const { callApi } = require('../../utils/api')
const { formatTime, statusText } = require('../../utils/util')

const app = getApp()

Page({
  data: {
    item: null,
    records: [],
    loading: true,
    submitting: false,
    role: 'user',
    myOpenid: '',
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
    loadingMore: false
  },

  onLoad(options) {
    this.itemId = options.id
  },

  onShow() {
    const user = app.globalData.user
    this.setData({
      role: user ? user.role : 'user',
      myOpenid: user ? user.openid : ''
    })
    this.load()
  },

  load() {
    this.setData({ loading: true })
    callApi('getItems')
      .then((items) => {
        const item = items.find((i) => i._id === this.itemId)
        if (!item) {
          this.setData({ loading: false })
          wx.showToast({ title: '物品不存在', icon: 'none' })
          return
        }
        const orgText = [item.department, item.groupName, item.ownerName]
          .filter((x) => x && String(x).trim())
          .join(' / ')
        this.setData({
          item: {
            ...item,
            statusText: statusText(item.status),
            borrowTimeText: item.borrowTime ? formatTime(item.borrowTime) : '',
            createTimeText: formatTime(item.createTime),
            orgText
          },
          loading: false
        })
        this.loadRecords(true)
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  loadRecords(reset) {
    const page = reset ? 1 : this.data.page + 1
    callApi('getRecords', { itemId: this.itemId, page, pageSize: this.data.pageSize })
      .then((data) => {
        const mapped = (data.list || []).map((r) => ({
          ...r,
          timeText: formatTime(r.time),
          actionText: r.action === 'borrow' ? '借出' : '归还'
        }))
        const records = reset ? mapped : this.data.records.concat(mapped)
        this.setData({
          records,
          page,
          total: data.total,
          hasMore: records.length < data.total,
          loadingMore: false
        })
      })
      .catch(() => this.setData({ loadingMore: false }))
  },

  onLoadMore() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.setData({ loadingMore: true })
      this.loadRecords(false)
    }
  },

  onBorrow() {
    const item = this.data.item
    wx.showModal({
      title: '确认借出',
      content: '确认借出「' + item.name + '」吗？',
      success: (res) => {
        if (!res.confirm) return
        this.setData({ submitting: true })
        callApi('borrowItem', { code: item.code })
          .then(() => {
            wx.showToast({ title: '借出成功', icon: 'success' })
            this.load()
          })
          .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
          .finally(() => this.setData({ submitting: false }))
      }
    })
  },

  onReturn() {
    const item = this.data.item
    wx.showModal({
      title: '确认归还',
      content: '确认归还「' + item.name + '」吗？',
      success: (res) => {
        if (!res.confirm) return
        this.setData({ submitting: true })
        callApi('returnItem', { code: item.code })
          .then(() => {
            wx.showToast({ title: '归还成功', icon: 'success' })
            this.load()
          })
          .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
          .finally(() => this.setData({ submitting: false }))
      }
    })
  },

  onEdit() {
    wx.navigateTo({ url: '/pages/admin/admin?editId=' + this.itemId })
  },

  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后该物品将从列表移除，历史记录仍会保留。确认删除吗？',
      success: (res) => {
        if (!res.confirm) return
        callApi('deleteItem', { itemId: this.itemId })
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 800)
          })
          .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
      }
    })
  }
})
