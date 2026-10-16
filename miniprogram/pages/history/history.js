const { callApi } = require('../../utils/api')
const { formatTime } = require('../../utils/util')

Page({
  data: {
    list: [],
    filter: 'all', // all | borrow | return
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false
  },

  onShow() {
    this.load(true)
  },

  onPullDownRefresh() {
    this.load(true).finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    this.onLoadMore()
  },

  load(reset) {
    const page = reset ? 1 : this.data.page + 1
    if (reset) this.setData({ loading: true })
    const payload = { page, pageSize: this.data.pageSize }
    if (this.data.filter !== 'all') payload.action = this.data.filter
    return callApi('getRecords', payload)
      .then((data) => {
        const mapped = (data.list || []).map((r) => ({
          ...r,
          timeText: formatTime(r.time),
          actionText: r.action === 'borrow' ? '借出' : '归还'
        }))
        const list = reset ? mapped : this.data.list.concat(mapped)
        this.setData({
          list,
          page,
          total: data.total,
          hasMore: list.length < data.total,
          loading: false,
          loadingMore: false
        })
      })
      .catch((err) => {
        this.setData({ loading: false, loadingMore: false })
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  onFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.filter })
    this.load(true)
  },

  onLoadMore() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.setData({ loadingMore: true })
      this.load(false)
    }
  }
})
