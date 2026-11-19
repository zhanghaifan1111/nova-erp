import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as store from './store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '2mb' }))

// ---------- 通用 CRUD 工厂 ----------
const COLLECTIONS = ['products', 'customers', 'suppliers', 'salesOrders', 'purchaseOrders', 'stockLogs']

for (const key of COLLECTIONS) {
  app.get(`/api/${key}`, (req, res) => {
    let rows = store.all(key)
    const { keyword, status, category } = req.query
    if (keyword) {
      const kw = String(keyword).toLowerCase()
      rows = rows.filter((r) => Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(kw)))
    }
    if (status) rows = rows.filter((r) => r.status === status)
    if (category) rows = rows.filter((r) => r.category === category)
    res.json({ code: 200, data: rows, total: rows.length })
  })

  app.get(`/api/${key}/:id`, (req, res) => {
    const row = store.find(key, req.params.id)
    row ? res.json({ code: 200, data: row }) : res.status(404).json({ code: 404, message: '记录不存在' })
  })

  app.post(`/api/${key}`, (req, res) => {
    const rec = store.create(key, req.body)
    res.json({ code: 200, data: rec, message: '创建成功' })
  })

  app.put(`/api/${key}/:id`, (req, res) => {
    const rec = store.update(key, req.params.id, req.body)
    rec ? res.json({ code: 200, data: rec, message: '更新成功' }) : res.status(404).json({ code: 404, message: '记录不存在' })
  })

  app.delete(`/api/${key}/:id`, (req, res) => {
    store.remove(key, req.params.id)
      ? res.json({ code: 200, message: '删除成功' })
      : res.status(404).json({ code: 404, message: '记录不存在' })
  })
}

// ---------- 仪表盘统计 ----------
app.get('/api/dashboard', (req, res) => {
  const products = store.all('products')
  const sales = store.all('salesOrders')
  const purchases = store.all('purchaseOrders')
  const customers = store.all('customers')

  const validSales = sales.filter((o) => o.status !== '已取消')
  const revenue = validSales.reduce((s, o) => s + o.total, 0)
  const purchaseAmount = purchases.filter((o) => o.status !== '已取消').reduce((s, o) => s + o.total, 0)
  const stockValue = products.reduce((s, p) => s + p.costPrice * p.stock, 0)
  const lowStock = products.filter((p) => p.stock <= p.safeStock)

  // 近 12 个月销售趋势
  const monthKeys = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const trend = monthKeys.map((m) => {
    const inMonth = validSales.filter((o) => (o.orderDate || '').startsWith(m))
    return {
      month: m,
      revenue: Math.round(inMonth.reduce((s, o) => s + o.total, 0)),
      orders: inMonth.length,
    }
  })

  // 订单状态分布
  const statusMap = {}
  sales.forEach((o) => { statusMap[o.status] = (statusMap[o.status] || 0) + 1 })
  const statusDist = Object.entries(statusMap).map(([name, value]) => ({ name, value }))

  // 分类销售占比
  const catMap = {}
  validSales.forEach((o) => o.items.forEach((it) => {
    const p = products.find((x) => x.id === it.productId)
    const cat = p?.category || '其他'
    catMap[cat] = (catMap[cat] || 0) + it.qty * it.price
  }))
  const categoryDist = Object.entries(catMap).map(([name, value]) => ({ name, value: Math.round(value) }))

  // 库存金额 TOP6
  const stockTop = [...products]
    .sort((a, b) => b.costPrice * b.stock - a.costPrice * a.stock)
    .slice(0, 6)
    .map((p) => ({ name: p.name, value: Math.round(p.costPrice * p.stock), stock: p.stock }))

  res.json({
    code: 200,
    data: {
      kpi: {
        revenue: Math.round(revenue),
        orders: validSales.length,
        customers: customers.length,
        stockValue: Math.round(stockValue),
        purchaseAmount: Math.round(purchaseAmount),
        profit: Math.round(revenue - purchaseAmount),
        lowStockCount: lowStock.length,
        productCount: products.length,
      },
      trend,
      statusDist,
      categoryDist,
      stockTop,
      lowStock: lowStock.slice(0, 6).map((p) => ({ sku: p.sku, name: p.name, stock: p.stock, safeStock: p.safeStock })),
      recentOrders: [...sales].sort((a, b) => (b.orderDate || '').localeCompare(a.orderDate || '')).slice(0, 6),
    },
  })
})

// ---------- 健康检查 ----------
app.get('/api/health', (req, res) => res.json({ code: 200, message: 'ok', time: new Date().toISOString() }))

// ---------- 生产环境托管静态文件 ----------
const distDir = path.join(__dirname, '..', 'dist')
app.use(express.static(distDir))
app.get('*', (req, res) => {
  const indexFile = path.join(distDir, 'index.html')
  if (fs.existsSync(indexFile)) res.sendFile(indexFile)
  else res.status(404).send('前端未构建，请先执行 npm run build 或使用 npm run dev')
})

import fs from 'node:fs'

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Nova ERP API 已启动: http://0.0.0.0:${PORT}`)

  // Render 免费版 15 分钟无请求会休眠。用外部公网地址定时自我访问，
  // 保持服务常驻、避免临时文件系统被重置。用 https 公网域名，兼容内部/外部注入。
  let publicUrl = process.env.RENDER_EXTERNAL_URL || ''
  if (publicUrl) publicUrl = publicUrl.replace(/^http:\/\//, 'https://')
  if (publicUrl) {
    const keepAlive = () => {
      try { fetch(`${publicUrl}/api/health`).catch(() => {}) } catch { /* 忽略，保活失败不影响主服务 */ }
    }
    setTimeout(keepAlive, 3000) // 启动后先 ping 一次
    setInterval(keepAlive, 10 * 60 * 1000)
    console.log('Render 保活已启用:', publicUrl)
  }
})

// 未捕获异常不要让进程静默退出（免费实例重启代价高）
process.on('uncaughtException', (err) => console.error('uncaughtException:', err))
process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err))
