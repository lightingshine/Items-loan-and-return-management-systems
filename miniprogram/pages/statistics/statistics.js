const { callApi } = require('../../utils/api')
const { formatTime, statusText } = require('../../utils/util')

const UNGROUPED = '未分组'
const UNASSIGNED = '未分配'

Page({
  data: {
    mode: 'department', // department | group | person
    loading: true,
    stats: { total: 0, available: 0, borrowed: 0 },
    departments: [],
    groups: [],
    persons: [],
    drilled: null, // { type, title }
    drilledItems: []
  },

  onShow() {
    this.load()
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  load() {
    this.setData({ loading: true })
    return callApi('getItems')
      .then((items) => {
        this.buildData(items)
        this.setData({ loading: false })
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  norm(v, fallback) {
    const s = (v && String(v).trim()) || ''
    return s || fallback
  },

  buildData(items) {
    const stats = {
      total: items.length,
      available: items.filter((i) => i.status === 'available').length,
      borrowed: items.filter((i) => i.status === 'borrowed').length
    }

    const deptMap = {}
    const grpMap = {}
    const personMap = {}

    items.forEach((it) => {
      const dept = this.norm(it.department, UNGROUPED)
      const group = this.norm(it.groupName, UNGROUPED)
      const owner = this.norm(it.ownerName, UNASSIGNED)
      const borrowed = it.status === 'borrowed'

      if (!deptMap[dept]) deptMap[dept] = { name: dept, total: 0, available: 0, borrowed: 0 }
      deptMap[dept].total++
      borrowed ? deptMap[dept].borrowed++ : deptMap[dept].available++

      const gKey = dept + '||' + group
      if (!grpMap[gKey]) {
        grpMap[gKey] = { key: gKey, name: group, department: dept, total: 0, available: 0, borrowed: 0 }
      }
      grpMap[gKey].total++
      borrowed ? grpMap[gKey].borrowed++ : grpMap[gKey].available++

      const pKey = dept + '||' + group + '||' + owner
      if (!personMap[pKey]) {
        personMap[pKey] = {
          key: pKey,
          name: owner,
          department: dept,
          group,
          total: 0,
          available: 0,
          borrowed: 0
        }
      }
      personMap[pKey].total++
      borrowed ? personMap[pKey].borrowed++ : personMap[pKey].available++
    })

    const sortByName = (a, b) => a.name.localeCompare(b.name, 'zh')
    const departments = Object.values(deptMap).sort(sortByName)
    const groups = Object.values(grpMap).sort((a, b) => (a.department + a.name).localeCompare(b.department + b.name, 'zh'))
    const persons = Object.values(personMap).sort((a, b) =>
      (a.department + a.group + a.name).localeCompare(b.department + b.group + b.name, 'zh')
    )

    this.setData({ items, stats, departments, groups, persons })
  },

  onMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode, drilled: null, drilledItems: [] })
  },

  onDrill(e) {
    const type = e.currentTarget.dataset.type
    const value = e.currentTarget.dataset.value
    const dept = e.currentTarget.dataset.dept || ''
    const group = e.currentTarget.dataset.group || ''

    const items = this.data.items
      .filter((it) => {
        const itDept = this.norm(it.department, UNGROUPED)
        const itGroup = this.norm(it.groupName, UNGROUPED)
        const itOwner = this.norm(it.ownerName, UNASSIGNED)
        if (type === 'department') return itDept === value
        if (type === 'group') return itDept === dept && itGroup === value
        if (type === 'person') return itDept === dept && itGroup === group && itOwner === value
        return false
      })
      .map((it) => ({
        ...it,
        statusText: statusText(it.status),
        borrowTimeText: it.borrowTime ? formatTime(it.borrowTime) : ''
      }))

    let title = value
    if (type === 'group') title = dept + ' / ' + value
    if (type === 'person') title = dept + ' / ' + group + ' / ' + value

    this.setData({ drilled: { type, title }, drilledItems: items })
  },

  onBack() {
    this.setData({ drilled: null, drilledItems: [] })
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/itemDetail/itemDetail?id=' + e.currentTarget.dataset.id })
  }
})
