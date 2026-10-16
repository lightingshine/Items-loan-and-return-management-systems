/**
 * 实验室物品借还管理 - 核心云函数
 * 所有业务操作通过 action 路由到对应处理函数。
 * 权限判断统一基于云函数上下文中的 openid（openid 由服务端注入，客户端无法伪造）。
 *
 * 数据集合：
 *  - users:   { _openid, nickname, avatarUrl, role, createTime }
 *  - items:   { code, name, description, imageUrl, status, borrowerOpenid, borrowerName, borrowTime, createTime, updateTime }
 *  - records: { itemId, itemCode, itemName, openid, userName, action, time, operatorOpenid, operatorName }
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 历史记录保留时长：1 年（毫秒）
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

// 角色常量
const ROLE_SUPER_ADMIN = 'superadmin'
const ROLE_ADMIN = 'admin'
const ROLE_USER = 'user'

function ok(data = null) {
  return { code: 0, data }
}

function fail(msg) {
  return { code: -1, msg }
}

// 获取当前用户
async function getUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).get()
  return res.data[0] || null
}

// 角色校验，不满足则抛错
function requireRole(user, roles) {
  if (!user || !roles.includes(user.role)) {
    const err = new Error('无权限执行该操作')
    err.noAuth = true
    throw err
  }
}

// 生成物品编码（去掉易混淆字符 0/O/1/I）
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]
  }
  return 'IL-' + s
}

/* ---------------------------- 登录 ---------------------------- */

async function login(payload, openid) {
  let user = await getUser(openid)
  if (!user) {
    // 第一个进入系统的用户自动成为超级管理员，便于初始化
    const count = await db.collection('users').count()
    const role = count.total === 0 ? ROLE_SUPER_ADMIN : ROLE_USER
    const now = new Date()
    const data = {
      _openid: openid,
      nickname: (payload && payload.nickname) || '微信用户',
      avatarUrl: (payload && payload.avatarUrl) || '',
      role,
      createTime: now
    }
    const addRes = await db.collection('users').add({ data })
    user = Object.assign({ _id: addRes._id }, data)
  } else {
    const update = {}
    if (payload && payload.nickname) update.nickname = payload.nickname
    if (payload && payload.avatarUrl) update.avatarUrl = payload.avatarUrl
    if (Object.keys(update).length) {
      await db.collection('users').doc(user._id).update({ data: update })
      user = Object.assign({}, user, update)
    }
  }
  return ok({
    user: {
      _id: user._id,
      openid,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      role: user.role
    }
  })
}

/* ---------------------------- 物品查询 ---------------------------- */

async function getItems() {
  const res = await db.collection('items').orderBy('createTime', 'desc').limit(1000).get()
  return ok(res.data)
}

// 查询我当前借用的物品
async function getMyBorrowed(payload, openid) {
  const res = await db
    .collection('items')
    .where({ status: 'borrowed', borrowerOpenid: openid })
    .orderBy('borrowTime', 'desc')
    .get()
  return ok(res.data)
}

// 根据编码查询物品详情 + 该物品的历史记录
async function getItemByCode(payload) {
  const code = payload && payload.code
  if (!code) return fail('缺少物品编码')
  const itemRes = await db.collection('items').where({ code }).get()
  if (!itemRes.data.length) return fail('未找到该物品，请检查二维码')
  const item = itemRes.data[0]
  const records = await db
    .collection('records')
    .where({ itemId: item._id, time: _.gte(new Date(Date.now() - ONE_YEAR_MS)) })
    .orderBy('time', 'desc')
    .limit(50)
    .get()
  return ok({ item, records: records.data })
}

/* ---------------------------- 借还 ---------------------------- */

async function borrowItem(payload, openid) {
  const code = payload && payload.code
  if (!code) return fail('缺少物品编码')

  const itemRes = await db.collection('items').where({ code }).get()
  if (!itemRes.data.length) return fail('未找到该物品，请检查二维码')
  const itemId = itemRes.data[0]._id

  const user = await getUser(openid)
  const userName = user ? user.nickname : '未知用户'
  const now = new Date()

  try {
    await db.runTransaction(async (t) => {
      const doc = await t.collection('items').doc(itemId).get()
      const item = doc.data
      if (item.status === 'borrowed') {
        if (item.borrowerOpenid === openid) {
          throw new Error('您已借用该物品，请勿重复操作')
        }
        throw new Error('该物品当前已被「' + (item.borrowerName || '他人') + '」借走')
      }
      await t.collection('items').doc(itemId).update({
        data: {
          status: 'borrowed',
          borrowerOpenid: openid,
          borrowerName: userName,
          borrowTime: now,
          updateTime: now
        }
      })
      await t.collection('records').add({
        data: {
          itemId,
          itemCode: code,
          itemName: item.name,
          openid,
          userName,
          action: 'borrow',
          time: now,
          operatorOpenid: openid,
          operatorName: userName
        }
      })
    })
  } catch (e) {
    return fail(e.message)
  }
  return ok({ itemId })
}

async function returnItem(payload, openid) {
  const code = payload && payload.code
  if (!code) return fail('缺少物品编码')

  const itemRes = await db.collection('items').where({ code }).get()
  if (!itemRes.data.length) return fail('未找到该物品，请检查二维码')
  const itemId = itemRes.data[0]._id

  const user = await getUser(openid)
  const operatorName = user ? user.nickname : '未知用户'
  const now = new Date()

  try {
    await db.runTransaction(async (t) => {
      const doc = await t.collection('items').doc(itemId).get()
      const item = doc.data
      if (item.status === 'available') {
        throw new Error('该物品当前是空闲状态，无需归还')
      }
      const isAdmin = user && (user.role === ROLE_ADMIN || user.role === ROLE_SUPER_ADMIN)
      if (item.borrowerOpenid !== openid && !isAdmin) {
        throw new Error('只能归还自己借用的物品')
      }
      await t.collection('items').doc(itemId).update({
        data: {
          status: 'available',
          borrowerOpenid: '',
          borrowerName: '',
          borrowTime: null,
          updateTime: now
        }
      })
      await t.collection('records').add({
        data: {
          itemId,
          itemCode: code,
          itemName: item.name,
          openid: item.borrowerOpenid,
          userName: item.borrowerName,
          action: 'return',
          time: now,
          operatorOpenid: openid,
          operatorName
        }
      })
    })
  } catch (e) {
    return fail(e.message)
  }
  return ok({ itemId })
}

// 管理员强制修改物品借还状态
async function forceUpdateStatus(payload, openid) {
  const user = await getUser(openid)
  requireRole(user, [ROLE_ADMIN, ROLE_SUPER_ADMIN])

  const itemId = payload && payload.itemId
  const status = payload && payload.status
  if (!itemId) return fail('缺少物品ID')
  if (status !== 'borrowed' && status !== 'available') return fail('无效的状态')

  const now = new Date()
  let itemName = ''
  try {
    await db.runTransaction(async (t) => {
      const doc = await t.collection('items').doc(itemId).get()
      const item = doc.data
      itemName = item.name
      if (status === 'borrowed') {
        const name = (payload.borrowerName && String(payload.borrowerName).trim()) || '线下借出'
        await t.collection('items').doc(itemId).update({
          data: {
            status: 'borrowed',
            borrowerOpenid: '',
            borrowerName: name,
            borrowTime: now,
            updateTime: now
          }
        })
        await t.collection('records').add({
          data: {
            itemId,
            itemCode: item.code,
            itemName: item.name,
            openid: '',
            userName: name,
            action: 'borrow',
            time: now,
            operatorOpenid: openid,
            operatorName: user.nickname
          }
        })
      } else {
        await t.collection('items').doc(itemId).update({
          data: {
            status: 'available',
            borrowerOpenid: '',
            borrowerName: '',
            borrowTime: null,
            updateTime: now
          }
        })
        await t.collection('records').add({
          data: {
            itemId,
            itemCode: item.code,
            itemName: item.name,
            openid: item.borrowerOpenid,
            userName: item.borrowerName,
            action: 'return',
            time: now,
            operatorOpenid: openid,
            operatorName: user.nickname
          }
        })
      }
    })
  } catch (e) {
    return fail(e.message)
  }
  return ok({ itemName })
}

/* ---------------------------- 物品管理（管理员） ---------------------------- */

async function addItem(payload, openid) {
  const user = await getUser(openid)
  requireRole(user, [ROLE_ADMIN, ROLE_SUPER_ADMIN])

  const name = payload && payload.name && String(payload.name).trim()
  if (!name) return fail('请填写物品名称')

  let code = payload && payload.code ? String(payload.code).trim() : ''
  if (!code) code = genCode()

  const exist = await db.collection('items').where({ code }).count()
  if (exist.total > 0) return fail('该编码已存在，请更换')

  const now = new Date()
  const data = {
    code,
    name,
    description: (payload && payload.description) || '',
    department: (payload && payload.department) || '',
    groupName: (payload && payload.groupName) || '',
    ownerName: (payload && payload.ownerName) || '',
    imageUrl: (payload && payload.imageUrl) || '',
    status: 'available',
    borrowerOpenid: '',
    borrowerName: '',
    borrowTime: null,
    createTime: now,
    updateTime: now
  }
  const res = await db.collection('items').add({ data })
  return ok({ _id: res._id, code })
}

async function updateItem(payload, openid) {
  const user = await getUser(openid)
  requireRole(user, [ROLE_ADMIN, ROLE_SUPER_ADMIN])

  const itemId = payload && payload.itemId
  if (!itemId) return fail('缺少物品ID')

  if (payload.code) {
    const code = String(payload.code).trim()
    const exist = await db
      .collection('items')
      .where({ code, _id: _.neq(itemId) })
      .count()
    if (exist.total > 0) return fail('该编码已存在')
  }

  const data = { updateTime: new Date() }
  if (payload.name !== undefined) data.name = String(payload.name).trim()
  if (payload.description !== undefined) data.description = payload.description
  if (payload.code !== undefined) data.code = String(payload.code).trim()
  if (payload.department !== undefined) data.department = payload.department
  if (payload.groupName !== undefined) data.groupName = payload.groupName
  if (payload.ownerName !== undefined) data.ownerName = payload.ownerName
  if (payload.imageUrl !== undefined) data.imageUrl = payload.imageUrl

  await db.collection('items').doc(itemId).update({ data })
  return ok()
}

async function deleteItem(payload, openid) {
  const user = await getUser(openid)
  requireRole(user, [ROLE_ADMIN, ROLE_SUPER_ADMIN])

  const itemId = payload && payload.itemId
  if (!itemId) return fail('缺少物品ID')

  await db.collection('items').doc(itemId).remove()
  // 历史记录保留（作为审计留痕，到期后由定时任务自动清理）
  return ok()
}

/* ---------------------------- 历史记录 ---------------------------- */

async function getRecords(payload) {
  const page = (payload && payload.page) || 1
  const pageSize = (payload && payload.pageSize) || 20
  const where = { time: _.gte(new Date(Date.now() - ONE_YEAR_MS)) }
  if (payload && payload.itemId) where.itemId = payload.itemId
  if (payload && payload.action) where.action = payload.action

  const totalRes = await db.collection('records').where(where).count()
  const res = await db
    .collection('records')
    .where(where)
    .orderBy('time', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return ok({ list: res.data, total: totalRes.total, page, pageSize })
}

/* ---------------------------- 用户管理（超级管理员） ---------------------------- */

async function getAllUsers(payload, openid) {
  const user = await getUser(openid)
  requireRole(user, [ROLE_SUPER_ADMIN])
  const res = await db.collection('users').orderBy('createTime', 'asc').limit(1000).get()
  return ok(res.data)
}

async function setAdmin(payload, openid) {
  const user = await getUser(openid)
  requireRole(user, [ROLE_SUPER_ADMIN])

  const userId = payload && payload.userId
  const role = payload && payload.role
  if (!userId) return fail('缺少用户ID')
  if (role !== ROLE_ADMIN && role !== ROLE_USER) return fail('参数错误')

  const target = (await db.collection('users').doc(userId).get()).data
  if (!target) return fail('用户不存在')
  if (target.role === ROLE_SUPER_ADMIN) return fail('不能修改超级管理员的角色')

  await db.collection('users').doc(userId).update({ data: { role } })
  return ok()
}

/* ---------------------------- 路由 ---------------------------- */

const handlers = {
  login,
  getItems,
  getMyBorrowed,
  getItemByCode,
  borrowItem,
  returnItem,
  forceUpdateStatus,
  addItem,
  updateItem,
  deleteItem,
  getRecords,
  getAllUsers,
  setAdmin
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event && event.action
  const payload = event && event.payload

  if (!handlers[action]) {
    return fail('未知操作')
  }

  try {
    return await handlers[action](payload, OPENID)
  } catch (e) {
    console.error('[api]', action, e)
    return fail(e.message || '服务器错误')
  }
}
