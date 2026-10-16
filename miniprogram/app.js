const config = require('./config')

App({
  globalData: {
    // 当前登录用户信息：{ _id, openid, nickname, avatarUrl, role }
    user: null
  },

  loginPromise: null,

  onLaunch() {
    if (!wx.cloud) {
      console.error('当前微信基础库版本过低，请升级到 2.2.3 以上以使用云能力')
      return
    }
    const initOptions = { traceUser: true }
    if (config.cloudEnv) {
      initOptions.env = config.cloudEnv
    }
    wx.cloud.init(initOptions)

    // 尝试从本地缓存恢复用户信息
    const cached = wx.getStorageSync('user')
    if (cached) {
      this.globalData.user = cached
    }

    // 自动登录：向云函数注册/获取当前用户，拿到角色权限
    this.login()
  },

  // 登录（幂等）：返回 Promise<user>
  login(payload = {}) {
    if (!this.loginPromise) {
      const { callApi } = require('./utils/api')
      this.loginPromise = callApi('login', payload)
        .then((data) => {
          this.globalData.user = data.user
          wx.setStorageSync('user', data.user)
          return data.user
        })
        .catch((err) => {
          this.loginPromise = null
          throw err
        })
    }
    return this.loginPromise
  },

  // 刷新全局用户信息
  setUser(user) {
    this.globalData.user = user
    wx.setStorageSync('user', user)
  }
})
