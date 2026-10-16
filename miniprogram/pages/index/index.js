const { callApi } = require('../../utils/api')
const { formatTime, statusText } = require('../../utils/util')

const app = getApp()

Page({
  data: {
    items: [],
    displayItems: [],
    loading: true,
    keyword: '',
    filter: 'all', // all | available | borrowed
    role: 'user',
    stats: { total: 0, available: 0, borrowed: 0 }
  },

  onShow() {
    this.setData({ role: app.globalData.user ? app.globalData.user.role : 'user' })
    this.loadItems()
  },

  onPullDownRefresh() {
    this.loadItems().finally(() => wx.stopPullDownRefresh())
  },

  loadItems() {
    this.setData({ loading: true })
    return callApi('getItems')
      .then((items) => {
        const mapped = items.map((it) => ({
          ...it,
          statusText: statusText(it.status),
          borrowTimeText: it.borrowTime ? formatTime(it.borrowTime) : ''
        }))
        const stats = {
          total: items.length,
          available: items.filter((i) => i.status === 'available').length,
          borrowed: items.filter((i) => i.status === 'borrowed').length
        }
        this.setData({ items: mapped, stats, loading: false })
        this.applyFilter()
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
    this.applyFilter()
  },

  onFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.filter })
    this.applyFilter()
  },

  applyFilter() {
    const { items, filter, keyword } = this.data
    let list = items
    if (filter !== 'all') {
      list = list.filter((it) => it.status === filter)
    }
    const kw = keyword.trim()
    if (kw) {
      list = list.filter(
        (it) =>
          (it.name && it.name.indexOf(kw) >= 0) ||
          (it.code && it.code.indexOf(kw) >= 0)
      )
    }
    this.setData({ displayItems: list })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/itemDetail/itemDetail?id=' + id })
  },

  goScan() {
    wx.navigateTo({ url: '/pages/scan/scan' })
  }
})
