/**
 * 云函数调用封装
 * 统一调用名为 `api` 的云函数，通过 action 区分业务操作
 */
function callApi(action, payload = {}) {
  return wx.cloud
    .callFunction({
      name: 'api',
      data: { action, payload }
    })
    .then((res) => {
      const r = res.result
      if (r && r.code === 0) {
        return r.data
      }
      const msg = (r && r.msg) || '操作失败'
      const err = new Error(msg)
      err.msg = msg
      throw err
    })
}

module.exports = { callApi }
