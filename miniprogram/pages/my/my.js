const { callApi } = require('../../utils/api')
const { formatTime, statusText, roleText } = require('../../utils/util')

const app = getApp()

Page({
  data: {
    user: null,
    myItems: [],
    loading: true
  },

  onShow() {
    this.refreshUser()
    this.loadMyItems()
  },

  refreshUser() {
    const user = app.globalData.user
    this.setData({
      user: user ? { ...user, roleText: roleText(user.role) } : null
    })
  },

  onSetProfile() {
    wx.getUserProfile({
      desc: '用于展示昵称头像',
      success: (res) => {
        app
          .login({
            nickname: res.userInfo.nickName,
            avatarUrl: res.userInfo.avatarUrl
          })
          .then(() => {
            this.refreshUser()
            this.loadMyItems()
          })
          .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
      }
    })
  },

  loadMyItems() {
    this.setData({ loading: true })
    callApi('getMyBorrowed')
      .then((items) => {
        const mapped = items.map((it) => ({
          ...it,
          statusText: statusText(it.status),
          borrowTimeText: it.borrowTime ? formatTime(it.borrowTime) : ''
        }))
        this.setData({ myItems: mapped, loading: false })
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/itemDetail/itemDetail?id=' + e.currentTarget.dataset.id })
  },

  goScan() {
    wx.navigateTo({ url: '/pages/scan/scan' })
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },

  goAdminManage() {
    wx.navigateTo({ url: '/pages/adminManage/adminManage' })
  }
})
