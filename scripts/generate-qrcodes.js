/**
 * 批量生成物品二维码
 *
 * 用法：
 *   1. 复制 codes.example.json 为 codes.json，填入物品名称和编码
 *      （编码即小程序「物品管理」中每个物品的 code，二维码内容就是这个编码）
 *   2. 在本目录执行：npm install && npm run gen
 *   3. 生成的二维码图片保存在 ./qrcodes/ 目录，打印后贴在物品上即可
 */
const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')

const inputPath = path.join(__dirname, 'codes.json')
const outputDir = path.join(__dirname, 'qrcodes')

if (!fs.existsSync(inputPath)) {
  console.error('未找到 codes.json，请先复制 codes.example.json 为 codes.json 并填写内容')
  process.exit(1)
}

const items = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))

if (!Array.isArray(items) || items.length === 0) {
  console.error('codes.json 内容为空，请至少填写一个物品')
  process.exit(1)
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

async function run() {
  for (const item of items) {
    const name = (item.name || 'item').replace(/[\\/:*?"<>|]/g, '_')
    const file = path.join(outputDir, `${name}-${item.code}.png`)
    await QRCode.toFile(file, item.code, { width: 400, margin: 2 })
    console.log('已生成:', file)
  }
  console.log(`完成，共生成 ${items.length} 个二维码`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
