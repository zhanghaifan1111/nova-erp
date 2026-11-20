import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import * as store from './store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'nova-erp-change-this-secret-in-production'

app.use(cors())
app.use(express.json({ limit: '2mb' }))

await store.initStore()

// ---------- 初始化默认账号 ----------
async function seedUsers() {
  const users = await store.all('users')
  if (users.some((u) => u.username === 'admin')) return
  await store.create('users', {
    username: 'admin',
    passwordHash: bcrypt.hashSync('admin123', 10),
    name: '系统管理员',
    role: 'admin',
    customerId: null,
    status: '启用',
  })
  console.log('已创建默认管理员账号: admin / admin123')
}
await seedUsers()

// ---------- 清空演示数据（管理员专用，一次性） ----------
app.post('/api/admin/clear-business-data', authRequired, adminRequired, async (req, res) => {
  const counts = await store.clearBusinessData()
  console.log('业务数据已清空:', JSON.stringify(counts))
  res.json({ code: 200, message: '业务数据已清空', data: counts })
})

// ---------- 鉴权中间件 ----------
function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' })
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ code: 401, message: '请先登录' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' })
  }
}

function adminRequired(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ code: 403, message: '需要管理员权限' })
  next()
}

function publicUser(u) {
  const { passwordHash, ...rest } = u
  return rest
}

// ---------- 认证 API ----------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {}
  const user = await store.findBy('users', 'username', String(username || '').trim())
  if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) {
    return res.status(401).json({ code: 401, message: '账号或密码错误' })
  }
  if (user.status !== '启用') return res.status(403).json({ code: 403, message: '账号已被停用' })
  res.json({ code: 200, data: { token: signToken(user), user: publicUser(user) } })
})

app.get('/api/auth/me', authRequired, async (req, res) => {
  const user = await store.find('users', req.user.id)
  if (!user) return res.status(401).json({ code: 401, message: '账号不存在' })
  res.json({ code: 200, data: publicUser(user) })
})

app.post('/api/auth/change-password', authRequired, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {}
  const user = await store.find('users', req.user.id)
  if (!user || !bcrypt.compareSync(String(oldPassword || ''), user.passwordHash)) {
    return res.status(400).json({ code: 400, message: '原密码错误' })
  }
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ code: 400, message: '新密码至少 6 位' })
  }
  await store.update('users', user.id, { passwordHash: bcrypt.hashSync(String(newPassword), 10) })
  res.json({ code: 200, message: '密码修改成功' })
})

// ---------- 用户/账号管理 API（管理员） ----------
app.get('/api/users', authRequired, adminRequired, async (req, res) => {
  const rows = await store.all('users')
  res.json({ code: 200, data: rows.map(publicUser), total: rows.length })
})

app.post('/api/users', authRequired, adminRequired, async (req, res) => {
  const { username, password, name, role, customerId, status } = req.body || {}
  if (!username || !password) return res.status(400).json({ code: 400, message: '账号和密码必填' })
  if (await store.findBy('users', 'username', String(username).trim())) {
    return res.status(400).json({ code: 400, message: '账号已存在' })
  }
  const rec = await store.create('users', {
    username: String(username).trim(),
    passwordHash: bcrypt.hashSync(String(password), 10),
    name: name || username,
    role: role === 'customer' ? 'customer' : 'admin',
    customerId: role === 'customer' ? (customerId || null) : null,
    status: status || '启用',
  })
  res.json({ code: 200, data: publicUser(rec), message: '账号创建成功' })
})

app.put('/api/users/:id', authRequired, adminRequired, async (req, res) => {
  const { name, role, customerId, status, password } = req.body || {}
  const patch = {}
  if (name !== undefined) patch.name = name
  if (role !== undefined) patch.role = role === 'customer' ? 'customer' : 'admin'
  if (customerId !== undefined) patch.customerId = patch.role === 'customer' ? customerId : null
  if (status !== undefined) patch.status = status
  if (password) patch.passwordHash = bcrypt.hashSync(String(password), 10)
  const rec = await store.update('users', req.params.id, patch)
  rec ? res.json({ code: 200, data: publicUser(rec), message: '更新成功' })
      : res.status(404).json({ code: 404, message: '账号不存在' })
})

app.delete('/api/users/:id', authRequired, adminRequired, async (req, res) => {
  const ok = await store.remove('users', req.params.id)
  ok ? res.json({ code: 200, message: '删除成功' }) : res.status(404).json({ code: 404, message: '账号不存在' })
})

// ---------- 客户账号专用：绑定客户档案 ----------
app.get('/api/customer-accounts', authRequired, adminRequired, async (req, res) => {
  const [users, customers] = await Promise.all([store.all('users'), store.all('customers')])
  const custMap = Object.fromEntries(customers.map((c) => [c.id, c]))
  const rows = users.filter((u) => u.role === 'customer').map((u) => ({
    ...publicUser(u),
    customer: custMap[u.customerId] || null,
  }))
  res.json({ code: 200, data: rows, total: rows.length })
})

// ---------- 通用 CRUD（鉴权 + 客户只读且仅看自己） ----------
const COLLECTIONS = [
  'products', 'customers', 'suppliers', 'salesOrders', 'purchaseOrders', 'stockLogs',
  'shops', 'warehouses', 'shippingMethods', 'shippingTemplates', 'stockTransfers', 'shipments',
]

function scopeRows(req, key, rows) {
  if (req.user?.role === 'admin') return rows
  if (key === 'salesOrders') return rows.filter((o) => o.customerId === req.user.customerId)
  if (key === 'customers') return rows.filter((c) => c.id === req.user.customerId)
  return []
}

for (const key of COLLECTIONS) {
  app.get(`/api/${key}`, authRequired, async (req, res) => {
    let rows = scopeRows(req, key, await store.all(key))
    const { keyword, status, category } = req.query
    if (keyword) {
      const kw = String(keyword).toLowerCase()
      rows = rows.filter((r) => Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(kw)))
    }
    if (status) rows = rows.filter((r) => r.status === status)
    if (category) rows = rows.filter((r) => r.category === category)
    res.json({ code: 200, data: rows, total: rows.length })
  })

  app.get(`/api/${key}/:id`, authRequired, async (req, res) => {
    const row = await store.find(key, req.params.id)
    const allowed = scopeRows(req, key, row ? [row] : []).length > 0
    row && allowed ? res.json({ code: 200, data: row }) : res.status(404).json({ code: 404, message: '记录不存在' })
  })

  const writeGuard = (req, res, next) => req.user?.role === 'admin'
    ? next()
    : res.status(403).json({ code: 403, message: '客户账号为只读权限' })

  app.post(`/api/${key}`, authRequired, writeGuard, async (req, res) => {
    const rec = await store.create(key, req.body)
    res.json({ code: 200, data: rec, message: '创建成功' })
  })

  app.put(`/api/${key}/:id`, authRequired, writeGuard, async (req, res) => {
    const rec = await store.update(key, req.params.id, req.body)
    rec ? res.json({ code: 200, data: rec, message: '更新成功' }) : res.status(404).json({ code: 404, message: '记录不存在' })
  })

  app.delete(`/api/${key}/:id`, authRequired, writeGuard, async (req, res) => {
    const ok = await store.remove(key, req.params.id)
    ok ? res.json({ code: 200, message: '删除成功' }) : res.status(404).json({ code: 404, message: '记录不存在' })
  })
}

// ---------- 仪表盘（客户只看自己数据） ----------
app.get('/api/dashboard', authRequired, async (req, res) => {
  let products = await store.all('products')
  let sales = await store.all('salesOrders')
  const purchases = await store.all('purchaseOrders')
  const customers = await store.all('customers')
  const isCustomer = req.user?.role === 'customer'
  if (isCustomer) {
    sales = sales.filter((o) => o.customerId === req.user.customerId)
  }

  const validSales = sales.filter((o) => o.status !== '已取消')
  const revenue = validSales.reduce((s, o) => s + o.total, 0)
  const purchaseAmount = isCustomer ? 0 : purchases.filter((o) => o.status !== '已取消').reduce((s, o) => s + o.total, 0)
  const stockValue = products.reduce((s, p) => s + p.costPrice * p.stock, 0)
  const lowStock = products.filter((p) => p.stock <= p.safeStock)

  const monthKeys = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const trend = monthKeys.map((m) => {
    const inMonth = validSales.filter((o) => (o.orderDate || '').startsWith(m))
    return { month: m, revenue: Math.round(inMonth.reduce((s, o) => s + o.total, 0)), orders: inMonth.length }
  })

  const statusMap = {}
  sales.forEach((o) => { statusMap[o.status] = (statusMap[o.status] || 0) + 1 })
  const statusDist = Object.entries(statusMap).map(([name, value]) => ({ name, value }))

  const catMap = {}
  validSales.forEach((o) => o.items.forEach((it) => {
    const p = products.find((x) => x.id === it.productId)
    const cat = p?.category || '其他'
    catMap[cat] = (catMap[cat] || 0) + it.qty * it.price
  }))
  const categoryDist = Object.entries(catMap).map(([name, value]) => ({ name, value: Math.round(value) }))

  const stockTop = [...products]
    .sort((a, b) => b.costPrice * b.stock - a.costPrice * a.stock)
    .slice(0, 6)
    .map((p) => ({ name: p.name, value: Math.round(p.costPrice * p.stock), stock: p.stock }))

  res.json({
    code: 200,
    data: {
      kpi: {
        revenue: Math.round(revenue), orders: validSales.length,
        customers: isCustomer ? 1 : customers.length,
        stockValue: isCustomer ? 0 : Math.round(stockValue),
        purchaseAmount: Math.round(purchaseAmount),
        profit: Math.round(revenue - purchaseAmount),
        lowStockCount: lowStock.length, productCount: products.length,
      },
      trend, statusDist, categoryDist, stockTop,
      lowStock: lowStock.slice(0, 6).map((p) => ({ sku: p.sku, name: p.name, stock: p.stock, safeStock: p.safeStock })),
      recentOrders: [...sales].sort((a, b) => (b.orderDate || '').localeCompare(a.orderDate || '')).slice(0, 6),
      isCustomer,
    },
  })
})

// ---------- 利润核算 ----------
// 按销售订单逐单核算：收入 - 采购成本 - 运费 - 平台佣金 - 其他费用
app.get('/api/profit', authRequired, adminRequired, async (req, res) => {
  const [sales, products, shippingMethods, shops] = await Promise.all([
    store.all('salesOrders'), store.all('products'), store.all('shippingMethods'), store.all('shops'),
  ])
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))
  const shopMap = Object.fromEntries(shops.map((s) => [s.id, s]))
  const shipMap = Object.fromEntries(shippingMethods.map((s) => [s.id, s]))

  const rows = sales.filter((o) => o.status !== '已取消').map((o) => {
    const cost = (o.items || []).reduce((s, it) => s + (productMap[it.productId]?.costPrice || it.price || 0) * it.qty, 0)
    const revenue = o.total || 0
    const shippingFee = Number(o.shippingFee || 0)
    const shop = shopMap[o.shopId]
    const commissionRate = Number(shop?.commissionRate || 0) / 100
    const commission = revenue * commissionRate
    const otherFee = Number(o.otherFee || 0)
    const profit = revenue - cost - shippingFee - commission - otherFee
    return {
      id: o.id, orderNo: o.orderNo, customerName: o.customerName,
      shopName: shop?.name || o.shopName || '-', orderDate: o.orderDate, status: o.status,
      revenue: Math.round(revenue * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      shippingFee,
      commission: Math.round(commission * 100) / 100,
      otherFee,
      profit: Math.round(profit * 100) / 100,
      margin: revenue ? Math.round((profit / revenue) * 1000) / 10 : 0,
    }
  }).sort((a, b) => (b.orderDate || '').localeCompare(a.orderDate || ''))

  const sum = rows.reduce((acc, r) => {
    acc.revenue += r.revenue; acc.cost += r.cost; acc.shippingFee += r.shippingFee
    acc.commission += r.commission; acc.otherFee += r.otherFee; acc.profit += r.profit
    return acc
  }, { revenue: 0, cost: 0, shippingFee: 0, commission: 0, otherFee: 0, profit: 0 })
  Object.keys(sum).forEach((k) => { sum[k] = Math.round(sum[k] * 100) / 100 })
  sum.margin = sum.revenue ? Math.round((sum.profit / sum.revenue) * 1000) / 10 : 0

  res.json({ code: 200, data: { rows, sum } })
})

// ---------- 定价计算 ----------
// 给定成本/运费/平台佣金率/目标利润率，反推建议售价
app.post('/api/pricing', authRequired, (req, res) => {
  const { cost = 0, shipping = 0, commissionRate = 0, targetMargin = 0, otherFee = 0 } = req.body || {}
  const c = Number(cost) || 0, s = Number(shipping) || 0
  const cr = Number(commissionRate) || 0, tm = Number(targetMargin) || 0, of = Number(otherFee) || 0
  // 售价 P 满足：(P - P*cr/100 - c - s - of) / P = tm/100
  // => P * (1 - cr/100 - tm/100) = c + s + of
  const denominator = 1 - cr / 100 - tm / 100
  if (denominator <= 0) {
    return res.status(400).json({ code: 400, message: '佣金率 + 目标利润率 必须小于 100%' })
  }
  const price = (c + s + of) / denominator
  const commission = price * cr / 100
  const profit = price - commission - c - s - of
  res.json({
    code: 200,
    data: {
      price: Math.round(price * 100) / 100,
      commission: Math.round(commission * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      margin: Math.round((profit / price) * 1000) / 10,
    },
  })
})

app.get('/api/health', (req, res) => res.json({ code: 200, message: 'ok', db: store.isMongo() ? 'mongodb' : 'file', time: new Date().toISOString() }))

// ---------- 生产环境托管静态文件 ----------
const distDir = path.join(__dirname, '..', 'dist')
app.use(express.static(distDir))
app.get('*', (req, res) => {
  const indexFile = path.join(distDir, 'index.html')
  fs.existsSync(indexFile) ? res.sendFile(indexFile) : res.status(404).send('前端未构建，请先执行 npm run build')
})

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Nova ERP API 已启动: http://0.0.0.0:${PORT}`)
  const publicUrl = (process.env.RENDER_EXTERNAL_URL || '').replace(/^http:\/\//, 'https://')
  if (publicUrl) {
    const keepAlive = () => { try { fetch(`${publicUrl}/api/health`).catch(() => {}) } catch {} }
    setTimeout(keepAlive, 3000)
    setInterval(keepAlive, 10 * 60 * 1000)
    console.log('Render 保活已启用:', publicUrl)
  }
})

process.on('uncaughtException', (err) => console.error('uncaughtException:', err))
process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err))
