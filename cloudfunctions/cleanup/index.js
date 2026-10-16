/**
 * 定时清理云函数
 * 每天凌晨自动删除超过 1 年的借还历史记录。
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

exports.main = async () => {
  const oneYearAgo = new Date(Date.now() - ONE_YEAR_MS)
  let removed = 0

  // 分批删除，避免单次删除量过大
  while (true) {
    const res = await db
      .collection('records')
      .where({ time: _.lt(oneYearAgo) })
      .limit(100)
      .get()

    if (!res.data.length) break

    for (const doc of res.data) {
      await db.collection('records').doc(doc._id).remove()
      removed++
    }
  }

  return { removed, oneYearAgo: oneYearAgo.toISOString() }
}
