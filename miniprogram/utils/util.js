/**
 * 通用工具函数
 */

// 时间格式化：兼容 Date 对象 / 时间戳 / ISO 字符串
function formatTime(value, withTime = true) {
  if (!value) return ''
  let d
  if (value instanceof Date) {
    d = value
  } else if (typeof value === 'number') {
    d = new Date(value)
  } else {
    d = new Date(value)
  }
  if (isNaN(d.getTime())) return ''
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (!withTime) return date
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 状态文案
function statusText(status) {
  return status === 'borrowed' ? '已借出' : '空闲'
}

// 角色文案
function roleText(role) {
  const map = {
    superadmin: '超级管理员',
    admin: '管理员',
    user: '普通用户'
  }
  return map[role] || '普通用户'
}

module.exports = { formatTime, statusText, roleText }
