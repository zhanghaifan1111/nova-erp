import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
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
  'sourcedProducts', 'listings', 'syncConfigs', 'syncLogs', 'platformOrders', 'messages', 'replyTemplates',
  'apiEndpoints', 'pushLogs',
  'cartons', 'waybills', 'printTemplates',
  'receipts', 'stockChecks', 'returns',
  'payments', 'followUps', 'pickLists', 'exchangeRates',
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

// ---------- 商品采集 ----------
// 把用户提供的真实商品链接/信息采集进采集箱（不生成假商品）
app.post('/api/sourcing/collect', authRequired, adminRequired, async (req, res) => {
  const { platform, lines } = req.body || {}
  if (!Array.isArray(lines) || !lines.length) return res.status(400).json({ code: 400, message: '请提供至少一个商品链接' })
  let added = 0
  const existing = await store.all('sourcedProducts')
  const seen = new Set(existing.map((x) => x.sourceUrl).filter(Boolean))
  const todayStr = new Date().toISOString().slice(0, 10)
  for (const line of lines) {
    const item = typeof line === 'string' ? { url: line } : (line || {})
    const url = String(item.url || item.sourceUrl || '').trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    await store.create('sourcedProducts', {
      platform: platform || item.platform || '未知平台',
      sourceUrl: url,
      title: item.title || url.split('/').pop()?.slice(0, 60) || url,
      sourcePrice: Number(item.price || 0),
      image: item.image || '',
      status: '待刊登',
      collectedAt: todayStr,
    })
    added++
  }
  res.json({ code: 200, message: `采集完成，新增 ${added} 条`, data: { added } })
})

// ---------- 刊登 ----------
app.post('/api/listings/publish', authRequired, adminRequired, async (req, res) => {
  const { sourcedProductId, shopId, title, price, sku } = req.body || {}
  const src = await store.find('sourcedProducts', sourcedProductId)
  if (!src) return res.status(404).json({ code: 404, message: '采集商品不存在' })
  const shop = await store.find('shops', shopId)
  if (!shop) return res.status(404).json({ code: 404, message: '请选择有效店铺' })
  const listing = await store.create('listings', {
    sourcedProductId,
    sourceUrl: src.sourceUrl,
    shopId,
    shopName: shop.name,
    platform: shop.platform,
    title: title || src.title,
    sku: sku || '',
    price: Number(price || src.sourcePrice || 0),
    image: src.image || '',
    platformProductId: '',
    status: '已刊登',
    publishedAt: new Date().toISOString().slice(0, 10),
  })
  await store.update('sourcedProducts', sourcedProductId, { status: '已刊登' })
  res.json({ code: 200, message: '刊登成功', data: listing })
})

// ---------- 平台订单同步（真实数据导入，不生成假数据） ----------
app.post('/api/sync/import', authRequired, adminRequired, async (req, res) => {
  const { shopId, rows } = req.body || {}
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ code: 400, message: '请提供订单数据' })
  const shop = await store.find('shops', shopId)
  const existing = await store.all('platformOrders')
  const seen = new Set(existing.map((o) => o.platformOrderNo).filter(Boolean))
  let added = 0, skipped = 0
  for (const row of rows) {
    const no = String(row.platformOrderNo || row.orderNo || '').trim()
    if (!no || seen.has(no)) { skipped++; continue }
    seen.add(no)
    await store.create('platformOrders', {
      platformOrderNo: no,
      platform: shop?.platform || row.platform || '未知平台',
      shopId: shopId || '',
      shopName: shop?.name || row.shopName || '',
      customerName: row.customerName || '',
      amount: Number(row.amount || 0),
      currency: row.currency || 'CNY',
      orderTime: row.orderTime || new Date().toISOString().slice(0, 10),
      itemSummary: row.itemSummary || '',
      status: '待同步',
      salesOrderId: '',
    })
    added++
  }
  await store.create('syncLogs', {
    shopId: shopId || '', shopName: shop?.name || '手动导入',
    type: '导入订单', total: rows.length, added, skipped,
    result: `新增 ${added}，跳过 ${skipped}`,
    syncedAt: new Date().toISOString().slice(0, 10),
  })
  res.json({ code: 200, message: `导入完成：新增 ${added}，跳过 ${skipped}`, data: { added, skipped } })
})

// 平台订单一键转销售订单
app.post('/api/sync/to-sales/:id', authRequired, adminRequired, async (req, res) => {
  const po = await store.find('platformOrders', req.params.id)
  if (!po) return res.status(404).json({ code: 404, message: '平台订单不存在' })
  if (po.status === '已同步') return res.status(400).json({ code: 400, message: '该订单已同步过' })
  // 客户：优先复用同名客户，否则新建
  let customer = (await store.all('customers')).find((c) => c.name === po.customerName)
  if (!customer && po.customerName) {
    customer = await store.create('customers', {
      code: 'CUS-' + Date.now().toString().slice(-6),
      name: po.customerName, contact: '', phone: '', email: '',
      address: '', level: '普通', status: '正常',
    })
  }
  const items = [{
    productId: '', sku: '', name: po.itemSummary || '平台订单商品（待补充）',
    qty: 1, price: Number(po.amount || 0),
  }]
  const sales = await store.all('salesOrders')
  const year = new Date().getFullYear()
  const seq = sales.length + 1
  const so = await store.create('salesOrders', {
    orderNo: 'SO' + year + String(seq).padStart(5, '0'),
    customerId: customer?.id || '', customerName: po.customerName || '平台客户',
    shopId: po.shopId || '', shopName: po.shopName || '',
    items, total: Number(po.amount || 0), status: '待发货',
    orderDate: po.orderTime || new Date().toISOString().slice(0, 10),
    platformOrderNo: po.platformOrderNo, shippingFee: 0, otherFee: 0,
  })
  await store.update('platformOrders', po.id, { status: '已同步', salesOrderId: so.id })
  res.json({ code: 200, message: '已转为销售订单', data: so })
})

// ---------- 客户消息回复 ----------
app.post('/api/messages/:id/reply', authRequired, async (req, res) => {
  const { content } = req.body || {}
  if (!content || !String(content).trim()) return res.status(400).json({ code: 400, message: '回复内容不能为空' })
  const msg = await store.find('messages', req.params.id)
  if (!msg) return res.status(404).json({ code: 404, message: '消息不存在' })
  const replies = Array.isArray(msg.replies) ? msg.replies : []
  replies.push({ content: String(content).trim(), at: new Date().toISOString(), by: req.user?.name || req.user?.username || '系统' })
  const rec = await store.update('messages', msg.id, { status: '已回复', replies, repliedAt: new Date().toISOString().slice(0, 10) })
  res.json({ code: 200, message: '回复成功', data: rec })
})

// ---------- 收付款管理（应收应付 + 核销） ----------
// 应收款/应付款台账：从未结清的订单计算
app.get('/api/payment-ledger', authRequired, adminRequired, async (req, res) => {
  const [sales, purchases, payments] = await Promise.all([
    store.all('salesOrders'), store.all('purchaseOrders'), store.all('payments'),
  ])
  const receivedBy = (no) => payments.filter((p) => p.direction === '收款' && p.relatedNo === no).reduce((s, p) => s + Number(p.amount || 0), 0)
  const paidBy = (no) => payments.filter((p) => p.direction === '付款' && p.relatedNo === no).reduce((s, p) => s + Number(p.amount || 0), 0)
  const receivable = sales
    .filter((o) => o.status !== '已取消')
    .map((o) => {
      const total = Number(o.total || 0), received = receivedBy(o.orderNo)
      return {
        type: '应收', relatedNo: o.orderNo, party: o.customerName || '',
        total, settled: received, balance: Math.max(0, Math.round((total - received) * 100) / 100),
        orderId: o.id, date: o.orderDate || '',
      }
    })
    .filter((r) => r.balance > 0)
  const payable = purchases
    .filter((o) => o.status !== '已取消')
    .map((o) => {
      const total = Number(o.total || 0), paid = paidBy(o.orderNo)
      return {
        type: '应付', relatedNo: o.orderNo, party: o.supplierName || '',
        total, settled: paid, balance: Math.max(0, Math.round((total - paid) * 100) / 100),
        orderId: o.id, date: o.orderDate || '',
      }
    })
    .filter((r) => r.balance > 0)
  res.json({
    code: 200,
    data: {
      rows: [...receivable, ...payable],
      sum: {
        receivable: Math.round(receivable.reduce((s, r) => s + r.balance, 0) * 100) / 100,
        payable: Math.round(payable.reduce((s, r) => s + r.balance, 0) * 100) / 100,
      },
    },
  })
})

// 登记收款/付款（核销到订单，支持部分收付）
app.post('/api/payment-record', authRequired, adminRequired, async (req, res) => {
  const { direction, relatedNo, amount, method, date, note } = req.body || {}
  if (!['收款', '付款'].includes(direction)) return res.status(400).json({ code: 400, message: '方向必须是收款或付款' })
  const amt = Number(amount || 0)
  if (amt <= 0) return res.status(400).json({ code: 400, message: '金额必须大于 0' })
  const collection = direction === '收款' ? 'salesOrders' : 'purchaseOrders'
  const field = direction === '收款' ? 'customerName' : 'supplierName'
  const order = (await store.all(collection)).find((o) => o.orderNo === relatedNo)
  if (!order) return res.status(404).json({ code: 404, message: '关联订单不存在' })
  const rec = await store.create('payments', {
    direction, relatedNo, party: order[field] || '',
    amount: amt, method: method || '银行转账', date: date || new Date().toISOString().slice(0, 10),
    note: note || '', orderId: order.id,
  })
  // 回写订单已收/已付金额与状态
  const key = direction === '收款' ? 'paidAmount' : 'paidAmount'
  const all = await store.all('payments')
  const settled = all.filter((p) => p.direction === direction && p.relatedNo === relatedNo).reduce((s, p) => s + Number(p.amount || 0), 0)
  const total = Number(order.total || 0)
  const patch = { [key]: Math.round(settled * 100) / 100 }
  if (settled >= total) patch.status = direction === '收款' ? '已完成' : '已完成'
  else if (settled > 0) patch.status = direction === '收款' ? '部分收款' : '部分付款'
  await store.update(collection, order.id, patch)
  res.json({ code: 200, message: `${direction}登记成功`, data: rec })
})

// ---------- 客户跟进 CRM ----------
// 新增跟进：同时更新客户的最新跟进与下次跟进日期
app.post('/api/crm/follow-up', authRequired, adminRequired, async (req, res) => {
  const { customerId, stage, method, content, result, nextDate } = req.body || {}
  if (!customerId) return res.status(400).json({ code: 400, message: '请选择客户' })
  const customer = await store.find('customers', customerId)
  if (!customer) return res.status(404).json({ code: 404, message: '客户不存在' })
  const rec = await store.create('followUps', {
    customerId, customerName: customer.name || '',
    stage: stage || '初步接触', method: method || '电话',
    content: content || '', result: result || '',
    nextDate: nextDate || '', followDate: new Date().toISOString().slice(0, 10),
  })
  await store.update('customers', customerId, {
    stage: stage || '初步接触',
    lastFollowUp: rec.followDate,
    nextFollowUp: nextDate || '',
  })
  res.json({ code: 200, message: '跟进已记录', data: rec })
})

// ---------- 拣货单 ----------
// 从销售订单生成：按 SKU 汇总拣货数量
app.post('/api/wms/pick-from-order/:id', authRequired, adminRequired, async (req, res) => {
  const order = await store.find('salesOrders', req.params.id)
  if (!order) return res.status(404).json({ code: 404, message: '订单不存在' })
  const products = await store.all('products')
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))
  const merged = {}
  ;(order.items || []).forEach((it) => {
    const sku = it.sku || productMap[it.productId]?.sku || 'NO-SKU'
    const name = it.name || productMap[it.productId]?.name || ''
    if (!merged[sku]) merged[sku] = { productId: it.productId || '', sku, name, qty: 0, location: productMap[it.productId]?.location || '' }
    merged[sku].qty += Number(it.qty || 0)
  })
  const rec = await store.create('pickLists', {
    pickNo: 'PK-' + String(order.orderNo || Date.now()).replace(/\W/g, ''),
    orderNo: order.orderNo || '', orderId: order.id,
    customerName: order.customerName || '',
    items: Object.values(merged),
    status: '待拣货', pickedAt: '',
  })
  res.json({ code: 200, message: '拣货单已生成', data: rec })
})

// 确认拣货
app.post('/api/wms/pick-confirm/:id', authRequired, adminRequired, async (req, res) => {
  const rec = await store.find('pickLists', req.params.id)
  if (!rec) return res.status(404).json({ code: 404, message: '拣货单不存在' })
  if (rec.status === '已拣货') return res.status(400).json({ code: 400, message: '该拣货单已确认过' })
  await store.update('pickLists', rec.id, { status: '已拣货', pickedAt: new Date().toISOString().slice(0, 10) })
  res.json({ code: 200, message: '拣货确认成功' })
})

// ---------- 汇率 ----------
// 换算：金额 * 汇率 = 人民币
app.post('/api/fx/convert', authRequired, adminRequired, async (req, res) => {
  const { currency, amount } = req.body || {}
  const rates = await store.all('exchangeRates')
  const rate = rates.find((r) => r.currency === currency)
  if (!rate) return res.status(404).json({ code: 404, message: '未找到该币种汇率，请先在汇率管理中添加' })
  const cny = Math.round(Number(amount || 0) * Number(rate.rate || 0) * 100) / 100
  res.json({ code: 200, data: { currency, amount: Number(amount || 0), rate: Number(rate.rate), cny } })
})

// ---------- 库存联动：调整库存并写流水 ----------
async function adjustStock(productId, delta, { type, relatedNo, note }) {
  const product = await store.find('products', productId)
  if (!product) throw new Error('商品不存在')
  const newStock = Math.max(0, Number(product.stock || 0) + delta)
  await store.update('products', productId, { stock: newStock })
  await store.create('stockLogs', {
    type, productId, sku: product.sku || '', name: product.name || '',
    qty: Math.abs(delta), relatedNo: relatedNo || '-', note: note || '',
  })
  return newStock
}

// ---------- 采购入库 ----------
// 从采购订单生成入库单（明细来自采购订单）
app.post('/api/stock/receipt-from-purchase/:id', authRequired, adminRequired, async (req, res) => {
  const po = await store.find('purchaseOrders', req.params.id)
  if (!po) return res.status(404).json({ code: 404, message: '采购订单不存在' })
  const products = await store.all('products')
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))
  const items = (po.items || []).length ? po.items : [{ name: '采购商品', sku: '', qty: 1, price: po.total || 0 }]
  const rec = await store.create('receipts', {
    receiptNo: 'RK-' + String(po.orderNo || Date.now()).replace(/\W/g, ''),
    purchaseNo: po.orderNo || '',
    supplierName: po.supplierName || '',
    items: items.map((it) => ({
      productId: it.productId || '', sku: it.sku || productMap[it.productId]?.sku || '',
      name: it.name || productMap[it.productId]?.name || '',
      qty: Number(it.qty || 0), price: Number(it.price || 0),
    })),
    total: Number(po.total || 0),
    warehouse: po.warehouse || '',
    status: '待入库',
    receivedAt: '',
  })
  res.json({ code: 200, message: '入库单已生成', data: rec })
})

// 确认入库：增加库存 + 写流水 + 采购单标记到货
app.post('/api/stock/receipt-confirm/:id', authRequired, adminRequired, async (req, res) => {
  const rec = await store.find('receipts', req.params.id)
  if (!rec) return res.status(404).json({ code: 404, message: '入库单不存在' })
  if (rec.status === '已入库') return res.status(400).json({ code: 400, message: '该入库单已确认过' })
  for (const it of rec.items || []) {
    const pid = it.productId || (await store.all('products')).find((p) => p.sku === it.sku)?.id
    if (pid) await adjustStock(pid, Number(it.qty || 0), { type: '入库', relatedNo: rec.receiptNo, note: `采购入库 ${rec.supplierName || ''}` })
  }
  await store.update('receipts', rec.id, { status: '已入库', receivedAt: new Date().toISOString().slice(0, 10) })
  if (rec.purchaseNo) {
    const pos = await store.all('purchaseOrders')
    const po = pos.find((p) => p.orderNo === rec.purchaseNo)
    if (po) await store.update('purchaseOrders', po.id, { status: '已完成' })
  }
  res.json({ code: 200, message: '入库确认成功，库存已更新' })
})

// ---------- 库存盘点 ----------
// 生成盘点单：以当前商品库存为账面数
app.post('/api/stock/check-create', authRequired, adminRequired, async (req, res) => {
  const { items } = req.body || {}
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ code: 400, message: '请选择要盘点的商品' })
  const products = await store.all('products')
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))
  const lines = items.map((it) => {
    const pid = it.productId
    const p = productMap[pid]
    const book = p ? Number(p.stock || 0) : 0
    const actual = Number(it.actual ?? book)
    return {
      productId: pid, sku: p?.sku || '', name: p?.name || '',
      bookQty: book, actualQty: actual, diff: actual - book,
    }
  })
  const rec = await store.create('stockChecks', {
    checkNo: 'PD-' + Date.now().toString().slice(-8),
    warehouse: req.body?.warehouse || '',
    items: lines,
    diffTotal: lines.reduce((s, l) => s + l.diff, 0),
    status: '待盘点',
    checkedAt: '',
  })
  res.json({ code: 200, message: '盘点单已生成', data: rec })
})

// 更新盘点单实盘数（重算差异）
app.post('/api/stock/check-update/:id', authRequired, adminRequired, async (req, res) => {
  const rec = await store.find('stockChecks', req.params.id)
  if (!rec) return res.status(404).json({ code: 404, message: '盘点单不存在' })
  if (rec.status === '已盘点') return res.status(400).json({ code: 400, message: '已盘点的单据不能修改' })
  const actualMap = req.body?.actual || {}
  const items = (rec.items || []).map((it) => {
    const actual = Number(actualMap[it.productId] ?? it.actualQty ?? it.bookQty)
    return { ...it, actualQty: actual, diff: actual - Number(it.bookQty || 0) }
  })
  const diffTotal = items.reduce((s, l) => s + l.diff, 0)
  await store.update('stockChecks', rec.id, { items, diffTotal })
  res.json({ code: 200, message: '实盘数已保存', data: { diffTotal } })
})

// 确认盘点：按差异调整库存 + 写流水
app.post('/api/stock/check-confirm/:id', authRequired, adminRequired, async (req, res) => {
  const rec = await store.find('stockChecks', req.params.id)
  if (!rec) return res.status(404).json({ code: 404, message: '盘点单不存在' })
  if (rec.status === '已盘点') return res.status(400).json({ code: 400, message: '该盘点单已确认过' })
  for (const it of rec.items || []) {
    if (!it.diff || !it.productId) continue
    await adjustStock(it.productId, it.diff, { type: it.diff > 0 ? '盘盈' : '盘亏', relatedNo: rec.checkNo, note: `盘点差异 ${it.diff > 0 ? '+' : ''}${it.diff}` })
  }
  await store.update('stockChecks', rec.id, { status: '已盘点', checkedAt: new Date().toISOString().slice(0, 10) })
  res.json({ code: 200, message: '盘点确认成功，库存已按差异调整' })
})

// ---------- 销售退货 ----------
// 从销售订单生成退货单
app.post('/api/stock/return-from-order/:id', authRequired, adminRequired, async (req, res) => {
  const order = await store.find('salesOrders', req.params.id)
  if (!order) return res.status(404).json({ code: 404, message: '订单不存在' })
  const products = await store.all('products')
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))
  const rec = await store.create('returns', {
    returnNo: 'TH-' + String(order.orderNo || Date.now()).replace(/\W/g, ''),
    orderNo: order.orderNo || '',
    customerId: order.customerId || '',
    customerName: order.customerName || '',
    items: (order.items || []).map((it) => ({
      productId: it.productId || '', sku: it.sku || productMap[it.productId]?.sku || '',
      name: it.name || productMap[it.productId]?.name || '',
      qty: Number(it.qty || 0), price: Number(it.price || 0),
    })),
    refundAmount: Number(req.body?.refundAmount ?? order.total ?? 0),
    reason: req.body?.reason || '',
    status: '待退货',
    returnedAt: '',
  })
  res.json({ code: 200, message: '退货单已生成', data: rec })
})

// 确认退货：回补库存 + 写流水
app.post('/api/stock/return-confirm/:id', authRequired, adminRequired, async (req, res) => {
  const rec = await store.find('returns', req.params.id)
  if (!rec) return res.status(404).json({ code: 404, message: '退货单不存在' })
  if (rec.status === '已退货') return res.status(400).json({ code: 400, message: '该退货单已确认过' })
  const products = await store.all('products')
  for (const it of rec.items || []) {
    const pid = it.productId || (it.sku && products.find((p) => p.sku === it.sku)?.id)
    if (pid && Number(it.qty) > 0) await adjustStock(pid, Number(it.qty), { type: '退货入库', relatedNo: rec.returnNo, note: `销售退货 ${rec.customerName || ''}` })
  }
  await store.update('returns', rec.id, { status: '已退货', returnedAt: new Date().toISOString().slice(0, 10) })
  const so = (await store.all('salesOrders')).find((o) => o.orderNo === rec.orderNo)
  if (so) await store.update('salesOrders', so.id, { status: '已取消' })
  res.json({ code: 200, message: '退货确认成功，库存已回补' })
})

// ---------- 数据导入导出 ----------
// CSV 导入（商品/客户），body: { key, rows: [{...}] }
app.post('/api/import', authRequired, adminRequired, async (req, res) => {
  const { key, rows } = req.body || {}
  if (!['products', 'customers'].includes(key)) return res.status(400).json({ code: 400, message: '仅支持导入商品和客户' })
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ code: 400, message: '没有可导入的数据' })
  let added = 0, skipped = 0
  const existing = await store.all(key)
  const keyField = key === 'products' ? 'sku' : 'name'
  const seen = new Set(existing.map((r) => r[keyField]).filter(Boolean))
  for (const row of rows) {
    const k = String(row[keyField] || '').trim()
    if (!k || seen.has(k)) { skipped++; continue }
    seen.add(k)
    const rec = { ...row }
    if (key === 'products') {
      rec.stock = Number(row.stock || 0)
      rec.costPrice = Number(row.costPrice || 0)
      rec.salePrice = Number(row.salePrice || 0)
      rec.safeStock = Number(row.safeStock || 0)
      rec.status = rec.status || '在售'
    }
    if (key === 'customers') { rec.status = rec.status || '正常'; rec.level = rec.level || '普通' }
    await store.create(key, rec)
    added++
  }
  res.json({ code: 200, message: `导入完成：新增 ${added}，跳过 ${skipped}`, data: { added, skipped } })
})

// 导出：返回指定集合全部数据（前端转 CSV 下载）
app.get('/api/export/:key', authRequired, adminRequired, async (req, res) => {
  const key = req.params.key
  const allowed = ['products', 'customers', 'suppliers', 'salesOrders', 'purchaseOrders', 'stockLogs', 'shops', 'platformOrders', 'cartons', 'waybills']
  if (!allowed.includes(key)) return res.status(400).json({ code: 400, message: '该集合不支持导出' })
  const rows = await store.all(key)
  res.json({ code: 200, data: rows })
})

// ---------- 箱唛 / 面单生成 ----------
// 从销售订单生成箱唛（外箱标签）：按订单商品明细，每个 SKU 一箱，自动编号
app.post('/api/label/cartons/from-order/:id', authRequired, adminRequired, async (req, res) => {
  const order = await store.find('salesOrders', req.params.id)
  if (!order) return res.status(404).json({ code: 404, message: '订单不存在' })
  const products = await store.all('products')
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))
  const cartons = await store.all('cartons')
  const items = (order.items || []).length ? order.items : [{ name: '订单商品', sku: '', qty: 1 }]
  const created = []
  let boxNo = cartons.filter((c) => (c.orderNo || '') === order.orderNo).length
  for (const it of items) {
    const qty = Number(it.qty || 1)
    const cartonNo = `BX-${String(order.orderNo || 'ORD').replace(/\W/g, '')}-${String(boxNo + 1).padStart(2, '0')}`
    const rec = await store.create('cartons', {
      cartonNo,
      orderNo: order.orderNo || '',
      orderId: order.id,
      sku: it.sku || productMap[it.productId]?.sku || '',
      productName: it.name || productMap[it.productId]?.name || '',
      qty,
      grossWeight: Number(it.grossWeight || 0),
      netWeight: Number(it.netWeight || 0),
      destination: order.shopName || order.customerName || '',
      trackingNo: order.trackingNo || '',
      carrier: order.carrier || order.shippingMethod || '',
      remark: order.remark || '',
      status: '待打印',
    })
    created.push(rec); boxNo++
  }
  res.json({ code: 200, message: `已生成 ${created.length} 个箱唛`, data: created })
})

// 从销售订单生成快递面单（寄件=店铺/仓库，收件=客户）
app.post('/api/label/waybills/from-order/:id', authRequired, adminRequired, async (req, res) => {
  const order = await store.find('salesOrders', req.params.id)
  if (!order) return res.status(404).json({ code: 404, message: '订单不存在' })
  const [shops, warehouses, customers] = await Promise.all([store.all('shops'), store.all('warehouses'), store.all('customers')])
  const shop = shops.find((s) => s.id === order.shopId)
  const warehouse = warehouses.find((w) => w.id === order.warehouseId)
  const customer = customers.find((c) => c.id === order.customerId)
  const items = order.items || []
  const rec = await store.create('waybills', {
    waybillNo: order.trackingNo || '',
    orderNo: order.orderNo || '',
    orderId: order.id,
    carrier: order.carrier || order.shippingMethod || shop?.platform || '',
    // 寄件人
    senderName: warehouse?.name || shop?.name || '发货仓',
    senderPhone: warehouse?.phone || '',
    senderAddress: warehouse?.address || '',
    // 收件人
    receiverName: order.customerName || customer?.name || '',
    receiverPhone: order.phone || customer?.phone || '',
    receiverAddress: order.address || customer?.address || '',
    itemSummary: items.map((i) => `${i.name || '商品'} x${i.qty || 1}`).join('；'),
    totalQty: items.reduce((s, i) => s + Number(i.qty || 0), 0),
    weight: Number(order.weight || 0),
    cod: Number(order.cod || 0),
    remark: order.remark || '',
    status: '待打印',
  })
  res.json({ code: 200, message: '面单已生成', data: rec })
})

// ---------- 订单推送到外部系统（Webhook / open API） ----------
const PUSH_TIMEOUT = 15000

function buildOrderPayload(order, products, shops) {
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))
  const shop = shops.find((s) => s.id === order.shopId)
  return {
    event: 'order.created',
    eventId: order.id,
    timestamp: new Date().toISOString(),
    data: {
      orderNo: order.orderNo,
      platformOrderNo: order.platformOrderNo || '',
      orderDate: order.orderDate || '',
      status: order.status || '',
      customer: {
        id: order.customerId || '',
        name: order.customerName || '',
      },
      shop: { id: order.shopId || '', name: shop?.name || order.shopName || '', platform: shop?.platform || '' },
      items: (order.items || []).map((it) => ({
        sku: it.sku || productMap[it.productId]?.sku || '',
        name: it.name || productMap[it.productId]?.name || '',
        qty: Number(it.qty || 0),
        price: Number(it.price || 0),
        subtotal: Math.round(Number(it.qty || 0) * Number(it.price || 0) * 100) / 100,
      })),
      total: Number(order.total || 0),
      shippingFee: Number(order.shippingFee || 0),
      otherFee: Number(order.otherFee || 0),
      currency: order.currency || 'CNY',
    },
  }
}

// 实际执行一次 HTTP 推送，返回 {ok, status, response, error}
async function doPush(endpoint, payload) {
  const body = JSON.stringify(payload)
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'ZhouGuixiang-ERP/1.0' }
  const authType = endpoint.authType || 'none'
  try {
    if (authType === 'bearer' && endpoint.token) headers.Authorization = `Bearer ${endpoint.token}`
    if (authType === 'apikey' && endpoint.apiKey) {
      headers[endpoint.headerName || 'X-API-Key'] = endpoint.apiKey
    }
    if (authType === 'hmac' && endpoint.secret) {
      const sig = crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex')
      headers['X-Signature'] = sig
      headers['X-Signature-Alg'] = 'hmac-sha256'
      if (endpoint.apiKey) headers[endpoint.headerName || 'X-API-Key'] = endpoint.apiKey
    }
    // 自定义请求头
    if (Array.isArray(endpoint.headers)) {
      endpoint.headers.forEach((h) => { if (h?.key && h?.value) headers[h.key] = h.value })
    }
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), PUSH_TIMEOUT)
    let res, text
    try {
      res = await fetch(endpoint.url, {
        method: endpoint.method || 'POST',
        headers,
        body,
        signal: ctl.signal,
      })
      text = await res.text()
    } finally { clearTimeout(timer) }
    const ok = res.status >= 200 && res.status < 300
    return { ok, status: res.status, response: text.slice(0, 2000), error: ok ? '' : `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, status: 0, response: '', error: String(e?.message || e) }
  }
}

async function pushOrders(orderIds, endpointId) {
  const endpoints = await store.all('apiEndpoints')
  const endpoint = endpointId
    ? endpoints.find((e) => e.id === endpointId)
    : endpoints.find((e) => e.enabled === '启用')
  if (!endpoint) return { error: '没有找到可用的推送目标，请先在「API 对接」配置' }
  if (endpoint.enabled !== '启用') return { error: '该推送目标已停用' }
  if (!endpoint.url) return { error: '推送目标未填写 URL' }

  const [sales, products, shops] = await Promise.all([
    store.all('salesOrders'), store.all('products'), store.all('shops'),
  ])
  const results = []
  for (const id of orderIds) {
    const order = sales.find((o) => o.id === id)
    if (!order) { results.push({ orderId: id, ok: false, error: '订单不存在' }); continue }
    const payload = buildOrderPayload(order, products, shops)
    const r = await doPush(endpoint, payload)
    await store.create('pushLogs', {
      endpointId: endpoint.id, endpointName: endpoint.name,
      orderId: order.id, orderNo: order.orderNo,
      payload: JSON.stringify(payload).slice(0, 4000),
      status: r.ok ? '成功' : '失败',
      httpCode: r.status, response: r.response, error: r.error,
      pushedAt: new Date().toISOString(),
    })
    results.push({ orderId: order.id, orderNo: order.orderNo, ok: r.ok, status: r.status, error: r.error })
  }
  const okCount = results.filter((r) => r.ok).length
  return { endpoint: endpoint.name, total: results.length, okCount, failCount: results.length - okCount, results }
}

app.post('/api/push/order/:id', authRequired, adminRequired, async (req, res) => {
  const r = await pushOrders([req.params.id], req.body?.endpointId)
  r.error ? res.status(400).json({ code: 400, message: r.error }) : res.json({ code: 200, message: `推送完成：成功 ${r.okCount}，失败 ${r.failCount}`, data: r })
})

app.post('/api/push/orders', authRequired, adminRequired, async (req, res) => {
  const ids = req.body?.orderIds
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ code: 400, message: '请选择要推送的订单' })
  const r = await pushOrders(ids, req.body?.endpointId)
  r.error ? res.status(400).json({ code: 400, message: r.error }) : res.json({ code: 200, message: `推送完成：成功 ${r.okCount}，失败 ${r.failCount}`, data: r })
})

app.post('/api/push/retry/:logId', authRequired, adminRequired, async (req, res) => {
  const log = await store.find('pushLogs', req.params.logId)
  if (!log) return res.status(404).json({ code: 404, message: '推送记录不存在' })
  const endpoint = await store.find('apiEndpoints', log.endpointId)
  if (!endpoint) return res.status(404).json({ code: 404, message: '推送目标不存在' })
  let payload
  try { payload = JSON.parse(log.payload) } catch { return res.status(400).json({ code: 400, message: '原始报文损坏，无法重试' }) }
  // 刷新时间戳与事件 ID，表明是重试
  payload.timestamp = new Date().toISOString()
  payload.retryOf = log.id
  const r = await doPush(endpoint, payload)
  await store.create('pushLogs', {
    endpointId: endpoint.id, endpointName: endpoint.name,
    orderId: log.orderId, orderNo: log.orderNo,
    payload: JSON.stringify(payload).slice(0, 4000),
    status: r.ok ? '成功' : '失败',
    httpCode: r.status, response: r.response, error: r.error,
    pushedAt: new Date().toISOString(), retryOf: log.id,
  })
  r.ok ? res.json({ code: 200, message: '重试成功', data: r })
      : res.status(502).json({ code: 502, message: `重试失败：${r.error}` })
})

app.post('/api/push/test', authRequired, adminRequired, async (req, res) => {
  const endpointId = req.body?.endpointId
  const endpoints = await store.all('apiEndpoints')
  const endpoint = endpointId ? endpoints.find((e) => e.id === endpointId) : endpoints.find((e) => e.enabled === '启用')
  if (!endpoint) return res.status(400).json({ code: 400, message: '没有找到推送目标' })
  if (!endpoint.url) return res.status(400).json({ code: 400, message: '推送目标未填写 URL' })
  const payload = {
    event: 'connection.test',
    timestamp: new Date().toISOString(),
    data: { message: '这是来自周桂祥的ERP的测试推送', endpoint: endpoint.name },
  }
  const r = await doPush(endpoint, payload)
  r.ok ? res.json({ code: 200, message: '连接成功', data: r })
      : res.status(502).json({ code: 502, message: `连接失败：${r.error}`, data: r })
})

// 获取可预览的订单推送报文（不实际发送）
app.get('/api/push/preview/:id', authRequired, adminRequired, async (req, res) => {
  const [order, products, shops] = await Promise.all([
    store.find('salesOrders', req.params.id), store.all('products'), store.all('shops'),
  ])
  if (!order) return res.status(404).json({ code: 404, message: '订单不存在' })
  res.json({ code: 200, data: buildOrderPayload(order, products, shops) })
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
  console.log(`周桂祥的ERP API 已启动: http://0.0.0.0:${PORT}`)
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
