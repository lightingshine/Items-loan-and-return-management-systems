const { callApi } = require('../../utils/api')
const { roleText } = require('../../utils/util')

const app = getApp()

Page({
  data: {
    users: [],
    loading: true
  },

  onShow() {
    const user = app.globalData.user
    if (!user || user.role !== 'superadmin') {
      wx.showToast({ title: '无权限访问', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    this.load()
  },

  load() {
    this.setData({ loading: true })
    callApi('getAllUsers')
      .then((users) => {
        const mapped = users.map((u) => ({ ...u, roleText: roleText(u.role) }))
        this.setData({ users: mapped, loading: false })
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  onToggleAdmin(e) {
    const id = e.currentTarget.dataset.id
    const u = this.data.users.find((x) => x._id === id)
    if (!u) return
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    const actionText = newRole === 'admin' ? '设为管理员' : '取消管理员'
    wx.showModal({
      title: actionText,
      content: '确认' + actionText + '「' + (u.nickname || '微信用户') + '」吗？',
      success: (res) => {
        if (!res.confirm) return
        callApi('setAdmin', { userId: id, role: newRole })
          .then(() => {
            wx.showToast({ title: '已更新', icon: 'success' })
            this.load()
          })
          .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
      }
    })
  }
})
