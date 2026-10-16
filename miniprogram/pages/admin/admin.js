const { callApi } = require('../../utils/api')
const { formatTime, statusText } = require('../../utils/util')

const app = getApp()

Page({
  data: {
    items: [],
    loading: true,
    showForm: false,
    formMode: 'add', // add | edit
    editingId: '',
    form: { name: '', description: '', code: '', department: '', groupName: '', ownerName: '' },
    submitting: false
  },

  onLoad(options) {
    if (options.editId) {
      this.editIdFromUrl = options.editId
    }
  },

  onShow() {
    const user = app.globalData.user
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      wx.showToast({ title: '无权限访问', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    this.load()
  },

  load() {
    this.setData({ loading: true })
    callApi('getItems')
      .then((items) => {
        const mapped = items.map((it) => ({
          ...it,
          statusText: statusText(it.status),
          borrowTimeText: it.borrowTime ? formatTime(it.borrowTime) : ''
        }))
        this.setData({ items: mapped, loading: false })

        if (this.editIdFromUrl) {
          const target = mapped.find((i) => i._id === this.editIdFromUrl)
          this.editIdFromUrl = null
          if (target) this.openEdit(target)
        }
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  onAdd() {
    this.setData({
      showForm: true,
      formMode: 'add',
      editingId: '',
      form: { name: '', description: '', code: '', department: '', groupName: '', ownerName: '' }
    })
  },

  openEdit(item) {
    this.setData({
      showForm: true,
      formMode: 'edit',
      editingId: item._id,
      form: {
        name: item.name,
        description: item.description || '',
        code: item.code,
        department: item.department || '',
        groupName: item.groupName || '',
        ownerName: item.ownerName || ''
      }
    })
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.items.find((i) => i._id === id)
    if (item) this.openEdit(item)
  },

  onFormInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ ['form.' + key]: e.detail.value })
  },

  onCancelForm() {
    this.setData({ showForm: false })
  },

  onSubmit() {
    const { form, formMode, editingId } = this.data
    if (!form.name.trim()) {
      wx.showToast({ title: '请填写物品名称', icon: 'none' })
      return
    }
    if (!form.department.trim()) {
      wx.showToast({ title: '请填写部门名', icon: 'none' })
      return
    }
    if (!form.ownerName.trim()) {
      wx.showToast({ title: '请填写人员名', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    const action = formMode === 'add' ? 'addItem' : 'updateItem'
    const payload = {
      name: form.name.trim(),
      description: form.description,
      code: form.code.trim(),
      department: form.department.trim(),
      groupName: form.groupName.trim(),
      ownerName: form.ownerName.trim()
    }
    if (formMode === 'edit') payload.itemId = editingId

    callApi(action, payload)
      .then(() => {
        wx.showToast({ title: formMode === 'add' ? '已添加' : '已保存', icon: 'success' })
        this.setData({ showForm: false, submitting: false })
        this.load()
      })
      .catch((err) => {
        this.setData({ submitting: false })
        wx.showToast({ title: err.message, icon: 'none' })
      })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.items.find((i) => i._id === id)
    wx.showModal({
      title: '确认删除',
      content: '确认删除「' + item.name + '」吗？历史记录将保留。',
      success: (res) => {
        if (!res.confirm) return
        callApi('deleteItem', { itemId: id })
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.load()
          })
          .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
      }
    })
  },

  onMarkBorrow(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.items.find((i) => i._id === id)
    wx.showModal({
      title: '标记借出',
      editable: true,
      placeholderText: '请输入借用人姓名（如：张三）',
      content: '',
      success: (res) => {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) {
          wx.showToast({ title: '请输入借用人姓名', icon: 'none' })
          return
        }
        callApi('forceUpdateStatus', { itemId: id, status: 'borrowed', borrowerName: name })
          .then(() => {
            wx.showToast({ title: '已标记借出', icon: 'success' })
            this.load()
          })
          .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
      }
    })
  },

  onMarkReturn(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.items.find((i) => i._id === id)
    wx.showModal({
      title: '标记归还',
      content: '确认将「' + item.name + '」标记为已归还吗？',
      success: (res) => {
        if (!res.confirm) return
        callApi('forceUpdateStatus', { itemId: id, status: 'available' })
          .then(() => {
            wx.showToast({ title: '已标记归还', icon: 'success' })
            this.load()
          })
          .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
      }
    })
  }
})
