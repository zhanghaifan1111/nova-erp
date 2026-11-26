import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import * as store from './store.js'
import { tenantCtx } from './tenantContext.js'

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
    roleKey: 'admin',
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
  return jwt.sign({ id: user.id, username: user.username, role: user.role, roleKey: user.roleKey, customerId: user.customerId || null, tenantId: user.tenantId || null, name: user.name }, JWT_SECRET, { expiresIn: '7d' })
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ code: 401, message: '请先登录' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    // 把当前租户放进 AsyncLocalStorage，后续所有 store.all/find 自动按租户隔离
    tenantCtx.run({ tenantId: req.user.tenantId, role: req.user.role, userId: req.user.id }, () => next())
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
  const { username, password, name, role, customerId, status, roleKey } = req.body || {}
  if (!username || !password) return res.status(400).json({ code: 400, message: '账号和密码必填' })
  if (await store.findBy('users', 'username', String(username).trim())) {
    return res.status(400).json({ code: 400, message: '账号已存在' })
  }
  const rec = await store.create('users', {
    username: String(username).trim(),
    passwordHash: bcrypt.hashSync(String(password), 10),
    name: name || username,
    role: role === 'customer' ? 'customer' : 'admin',
    roleKey: roleKey || (role === 'customer' ? 'customer' : 'admin'),
    customerId: role === 'customer' ? (customerId || null) : null,
    status: status || '启用',
  })
  res.json({ code: 200, data: publicUser(rec), message: '账号创建成功' })
})

app.put('/api/users/:id', authRequired, adminRequired, async (req, res) => {
  const { name, role, customerId, status, password, roleKey } = req.body || {}
  const patch = {}
  if (name !== undefined) patch.name = name
  if (role !== undefined) patch.role = role === 'customer' ? 'customer' : 'admin'
  if (roleKey !== undefined) patch.roleKey = roleKey
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

// ---------- SaaS：订阅套餐定义 ----------
const PLAN_DEFS = {
  free: { key: 'free', name: '免费版', price: 0, limits: { products: 50, orders: 100, users: 1, apiCalls: 100 } },
  pro: { key: 'pro', name: '专业版', price: 199, limits: { products: 2000, orders: 10000, users: 5, apiCalls: 10000 } },
  flagship: { key: 'flagship', name: '旗舰版', price: 599, limits: { products: 100000, orders: 1000000, users: 50, apiCalls: 1000000 } },
}

// 初始化套餐（幂等）
async function ensurePlans() {
  for (const p of Object.values(PLAN_DEFS)) {
    if (!(await store.findBy('plans', 'key', p.key))) await store.create('plans', p)
  }
}
ensurePlans()

// 租户注册：创建租户+管理员账号+免费订阅
app.post('/api/saas/register', async (req, res) => {
  const { company, username, password, plan } = req.body || {}
  if (!company || !username || !password) return res.status(400).json({ code: 400, message: '公司名/账号/密码必填' })
  if (String(password).length < 6) return res.status(400).json({ code: 400, message: '密码至少6位' })
  if (await store.findBy('users', 'username', String(username).trim())) return res.status(400).json({ code: 400, message: '账号已存在' })
  const planKey = PLAN_DEFS[plan] ? plan : 'free'
  const tenant = await store.create('tenants', {
    name: String(company).trim(),
    code: 'T' + Date.now().toString().slice(-8),
    status: '启用',
    createdAt: new Date().toISOString().slice(0, 10),
  })
  await store.create('users', {
    username: String(username).trim(),
    passwordHash: bcrypt.hashSync(String(password), 10),
    name: String(username).trim(),
    role: 'admin',
    roleKey: 'tenant_admin',
    tenantId: tenant.id,
    status: '启用',
  })
  await store.create('subscriptions', {
    tenantId: tenant.id,
    plan: planKey,
    status: '生效',
    startDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  })
  res.json({ code: 200, message: `租户「${company}」已创建，免费版试用30天`, data: { tenant, plan: planKey } })
})

// 当前租户信息 + 套餐额度
app.get('/api/saas/me', authRequired, async (req, res) => {
  const tid = req.user?.tenantId
  if (!tid) return res.json({ code: 200, data: { isPlatformAdmin: true, plan: 'flagship', limits: PLAN_DEFS.flagship.limits } })
  const tenant = await store.find('tenants', tid)
  const sub = (await store.all('subscriptions')).find((s) => s.tenantId === tid && s.status === '生效')
  const planKey = sub?.plan || 'free'
  const plan = PLAN_DEFS[planKey] || PLAN_DEFS.free
  const [products, sales, users] = await Promise.all([store.all('products'), store.all('salesOrders'), store.all('users')])
  const usage = {
    products: products.filter((p) => p.tenantId === tid).length,
    orders: sales.filter((o) => o.tenantId === tid).length,
    users: users.filter((u) => u.tenantId === tid).length,
  }
  res.json({ code: 200, data: { isPlatformAdmin: false, tenant, subscription: sub, plan: planKey, planName: plan.name, limits: plan.limits, usage } })
})

// 升级套餐
app.post('/api/saas/subscribe', authRequired, async (req, res) => {
  const tid = req.user?.tenantId
  if (!tid) return res.status(403).json({ code: 403, message: '平台管理员无需订阅' })
  const { plan } = req.body || {}
  if (!PLAN_DEFS[plan]) return res.status(400).json({ code: 400, message: '套餐不存在' })
  const subs = await store.all('subscriptions')
  const current = subs.find((s) => s.tenantId === tid && s.status === '生效')
  if (current) await store.update('subscriptions', current.id, { status: '已过期', endedAt: new Date().toISOString().slice(0, 10) })
  const sub = await store.create('subscriptions', {
    tenantId: tid, plan, status: '生效',
    startDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  })
  res.json({ code: 200, message: `已升级到「${PLAN_DEFS[plan].name}」`, data: sub })
})

// 额度校验中间件（用于写操作）
async function checkQuota(req, key) {
  const tid = req.user?.tenantId
  if (!tid) return true
  const sub = (await store.all('subscriptions')).find((s) => s.tenantId === tid && s.status === '生效')
  const limits = (PLAN_DEFS[sub?.plan] || PLAN_DEFS.free).limits
  const metric = key === 'products' ? 'products' : key === 'salesOrders' ? 'orders' : null
  if (!metric) return true
  const used = (await store.all(key)).filter((r) => r.tenantId === tid).length
  return used < limits[metric]
}

// ---------- 平台授权中心 ----------
// 授权记录（真实 OAuth 需要各平台 App Key/Secret，这里建框架+模拟连通）
app.post('/api/platform-auth/test', authRequired, async (req, res) => {
  const tid = req.user?.tenantId || 'platform'
  const { platform, shopName, appKey, appSecret, accessToken } = req.body || {}
  if (!platform || !shopName) return res.status(400).json({ code: 400, message: '平台和店铺名必填' })
  // 真实对接时用 appKey/appSecret 走各平台 OAuth；这里做凭据完整性检查
  const hasCredential = !!(accessToken || (appKey && appSecret))
  const auth = await store.create('platformAuths', {
    tenantId: tid, platform, shopName,
    appKey: appKey || '', appSecret: appSecret ? '***' + String(appSecret).slice(-4) : '',
    hasToken: !!accessToken,
    status: hasCredential ? '已授权' : '待授权',
    lastTest: new Date().toISOString().slice(0, 10),
  })
  res.json({
    code: 200,
    data: auth,
    message: hasCredential ? '授权信息已保存（凭据完整）' : '授权信息已保存，请补充 Token 或 App Key/Secret 后才能真正拉取数据',
  })
})

// ---------- 开放 API：API Key ----------
app.post('/api/saas/apikey', authRequired, async (req, res) => {
  const tid = req.user?.tenantId
  if (!tid) return res.status(403).json({ code: 403, message: '平台管理员不适用' })
  const { name } = req.body || {}
  const key = 'nva_' + crypto.randomBytes(16).toString('hex')
  const rec = await store.create('apiKeys', { tenantId: tid, name: name || '默认密钥', key, status: '启用', createdAt: new Date().toISOString().slice(0, 10), calls: 0 })
  res.json({ code: 200, message: 'API Key 已生成，请妥善保存', data: rec })
})

// API Key 鉴权（供外部系统调用）
app.use('/api/open', async (req, res, next) => {
  const key = req.headers['x-api-key'] || req.query.apiKey
  const rec = (await store.all('apiKeys')).find((k) => k.key === key && k.status === '启用')
  if (!rec) return res.status(401).json({ code: 401, message: 'API Key 无效或已停用' })
  req.apiTenantId = rec.tenantId
  req.apiKeyId = rec.id
  await store.update('apiKeys', rec.id, { calls: Number(rec.calls || 0) + 1, lastUsed: new Date().toISOString() })
  next()
})

app.get('/api/open/products', async (req, res) => {
  const rows = (await store.all('products')).filter((p) => p.tenantId === req.apiTenantId)
  res.json({ code: 200, data: rows, total: rows.length })
})
app.get('/api/open/orders', async (req, res) => {
  const rows = (await store.all('salesOrders')).filter((o) => o.tenantId === req.apiTenantId)
  res.json({ code: 200, data: rows, total: rows.length })
})

// ---------- Webhook ----------
app.post('/api/saas/webhook', authRequired, async (req, res) => {
  const tid = req.user?.tenantId || 'platform'
  const { url, events } = req.body || {}
  if (!url) return res.status(400).json({ code: 400, message: '请填写推送地址' })
  const rec = await store.create('webhooks', { tenantId: tid, url, events: events || ['订单创建'], status: '启用', createdAt: new Date().toISOString().slice(0, 10) })
  res.json({ code: 200, message: 'Webhook 已订阅', data: rec })
})

// 手动触发测试推送（记录日志；真实 HTTP 推送在生产环境发出）
app.post('/api/saas/webhook/test/:id', authRequired, async (req, res) => {
  const wh = await store.find('webhooks', req.params.id)
  if (!wh) return res.status(404).json({ code: 404, message: 'Webhook 不存在' })
  const payload = { event: '测试事件', data: { message: '这是一条来自 ERP 的测试推送' }, timestamp: new Date().toISOString() }
  const log = await store.create('webhookLogs', { tenantId: wh.tenantId, webhookId: wh.id, url: wh.url, payload, status: '已模拟推送', at: new Date().toISOString() })
  res.json({ code: 200, message: '测试推送已记录', data: log })
})

// ---------- 操作审计：记录所有写操作 ----------
app.use('/api', async (req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const originalSend = res.send.bind(res)
    res.send = function (body) {
      // 响应成功才记录（2xx）
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.create('auditLogs', {
          method: req.method,
          path: req.originalUrl.split('?')[0],
          actor: req.user?.name || req.user?.username || '匿名',
          actorId: req.user?.id || '',
          role: req.user?.role || '',
          ip: (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim(),
          body: req.body && Object.keys(req.body).length ? JSON.stringify(req.body).slice(0, 2000) : '',
          at: new Date().toISOString(),
        }).catch(() => {})
      }
      return originalSend(body)
    }
  }
  next()
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
  'approvals', 'expenses', 'invoices', 'auditLogs', 'locations',
  'glAccounts', 'vouchers', 'settlements', 'kpiTargets',
  'automationRules', 'ruleLogs', 'roles', 'notifications', 'afterSales', 'bundles',
  'rfqs', 'qualityChecks', 'batches', 'reports',
  'adCampaigns', 'deals',
  'shipments_tracking', 'stockLocks', 'coupons',
  'csRules', 'blacklist', 'products_research', 'competitors',
  'waves', 'orderRules', 'inventorySyncRules', 'scheduledListings',
  'tenants', 'plans', 'subscriptions', 'platformAuths', 'apiKeys', 'webhooks', 'webhookLogs', 'quotaLogs',
]

const TENANT_META_KEYS = ['tenants', 'plans', 'subscriptions', 'users', 'apiKeys', 'webhooks', 'webhookLogs', 'quotaLogs']
function scopeRows(req, key, rows) {
  const tid = req.user?.tenantId
  // 租户数据隔离：带 tenantId 的用户（含租户管理员）只能看自己租户的数据
  // 老 admin（tenantId 为空）保持兼容，看全部
  if (tid && !TENANT_META_KEYS.includes(key)) {
    return rows.filter((r) => r.tenantId === tid)
  }
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
    // 套餐配额：租户创建商品/订单时校验上限
    if (['products', 'salesOrders'].includes(key) && !(await checkQuota(req, key))) {
      return res.status(403).json({ code: 403, message: '已达到套餐用量上限，请升级套餐' })
    }
    const body = { ...req.body }
    if (req.user?.tenantId && !TENANT_META_KEYS.includes(key)) body.tenantId = req.user.tenantId
    const rec = await store.create(key, body)
    res.json({ code: 200, data: rec, message: '创建成功' })
  })

  app.put(`/api/${key}/:id`, authRequired, writeGuard, async (req, res) => {
    const existing = await store.find(key, req.params.id)
    if (req.user?.tenantId && !TENANT_META_KEYS.includes(key) && existing?.tenantId !== req.user.tenantId) {
      return res.status(403).json({ code: 403, message: '无权修改其他租户的数据' })
    }
    const rec = await store.update(key, req.params.id, req.body)
    rec ? res.json({ code: 200, data: rec, message: '更新成功' }) : res.status(404).json({ code: 404, message: '记录不存在' })
  })

  app.delete(`/api/${key}/:id`, authRequired, writeGuard, async (req, res) => {
    const existing = await store.find(key, req.params.id)
    if (req.user?.tenantId && !TENANT_META_KEYS.includes(key) && existing?.tenantId !== req.user.tenantId) {
      return res.status(403).json({ code: 403, message: '无权删除其他租户的数据' })
    }
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

// ---------- 产品搬家（跨平台批量复制） ----------
// 把源店铺商品批量复制到目标店铺，支持加价系数与字段覆盖
app.post('/api/migrate/products', authRequired, adminRequired, async (req, res) => {
  const { sourceShop, targetShop, productIds, priceFactor, status } = req.body || {}
  if (!sourceShop || !targetShop) return res.status(400).json({ code: 400, message: '请选择源店铺和目标店铺' })
  const products = await store.all('products')
  const factor = Number(priceFactor || 1)
  const ids = Array.isArray(productIds) && productIds.length ? productIds : products.filter((p) => p.shopName === sourceShop).map((p) => p.id)
  let copied = 0
  for (const pid of ids) {
    const p = products.find((x) => x.id === pid)
    if (!p) continue
    await store.create('listings', {
      title: p.name || '', sku: p.sku,
      shopName: targetShop,
      sourceShop,
      price: Math.round(Number(p.price || 0) * factor * 100) / 100,
      costPrice: Number(p.costPrice || 0),
      images: p.images || [],
      category: p.category || '',
      status: status || '草稿',
      source: '产品搬家',
      migratedAt: new Date().toISOString().slice(0, 10),
    })
    copied++
  }
  res.json({ code: 200, message: `已从「${sourceShop}」搬家 ${copied} 个商品到「${targetShop}」`, data: { copied } })
})

// ---------- 波次发货（多订单合并拣货） ----------
// 创建波次：选多个订单，按SKU汇总拣货清单
app.post('/api/wave/create', authRequired, adminRequired, async (req, res) => {
  const { waveNo, orderNos } = req.body || {}
  if (!Array.isArray(orderNos) || !orderNos.length) return res.status(400).json({ code: 400, message: '请选择至少一个订单' })
  const sales = await store.all('salesOrders')
  const chosen = sales.filter((o) => orderNos.includes(o.orderNo))
  if (!chosen.length) return res.status(404).json({ code: 404, message: '订单不存在' })
  // 按SKU汇总
  const pickMap = {}
  chosen.forEach((o) => (o.items || []).forEach((it) => {
    const key = it.sku || it.name || '未知'
    if (!pickMap[key]) pickMap[key] = { sku: key, name: it.name || '', qty: 0, orders: [] }
    pickMap[key].qty += Number(it.qty || 0)
    pickMap[key].orders.push(o.orderNo)
  }))
  const wave = await store.create('waves', {
    waveNo: waveNo || 'WAVE-' + Date.now().toString().slice(-6),
    orderNos: chosen.map((o) => o.orderNo),
    orderCount: chosen.length,
    pickList: Object.values(pickMap),
    status: '待拣货',
    createdAt: new Date().toISOString().slice(0, 10),
  })
  res.json({ code: 200, message: `波次已创建，${chosen.length} 单，${Object.keys(pickMap).length} 个SKU待拣`, data: wave })
})

// 波次发货完成
app.post('/api/wave/ship/:id', authRequired, adminRequired, async (req, res) => {
  const wave = await store.find('waves', req.params.id)
  if (!wave) return res.status(404).json({ code: 404, message: '波次不存在' })
  if (wave.status === '已发货') return res.status(400).json({ code: 400, message: '该波次已发货' })
  const sales = await store.all('salesOrders')
  let shipped = 0
  for (const no of wave.orderNos || []) {
    const order = sales.find((o) => o.orderNo === no)
    if (order) { await store.update('salesOrders', order.id, { status: '已发货', shippedAt: new Date().toISOString().slice(0, 10) }); shipped++ }
  }
  await store.update('waves', wave.id, { status: '已发货', shippedAt: new Date().toISOString().slice(0, 10), shippedCount: shipped })
  res.json({ code: 200, message: `波次已发货，${shipped} 个订单状态更新为已发货` })
})

// ---------- 自动审单规则 ----------
// 规则条件：金额区间/地区/关键词 → 动作：自动审核/拦截/分配物流
app.post('/api/order-rule/evaluate', authRequired, adminRequired, async (req, res) => {
  const { orderNo } = req.body || {}
  const order = (await store.all('salesOrders')).find((o) => o.orderNo === orderNo)
  if (!order) return res.status(404).json({ code: 404, message: '订单不存在' })
  const rules = (await store.all('orderRules')).filter((r) => r.enabled !== '停用')
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
  const sales = await store.all('salesOrders')
  const methods = await store.all('shippingMethods')
  const total = Number(order.total || 0)
  let action = '手动处理', reason = '未命中任何规则', matched = null, shippingMethod = ''
  for (const r of rules) {
    // 兼容两种存储：UI表单平铺字段(conditionType/min/max/value) 与 API嵌套(condition:{...})
    const c = r.condition || {}
    const ctype = c.type || r.conditionType || ''
    const cmin = c.min !== undefined ? c.min : r.min
    const cmax = c.max !== undefined ? c.max : r.max
    const cval = c.value !== undefined ? c.value : r.value
    let hit = false
    if (ctype === 'amount') {
      hit = total >= Number(cmin || 0) && (cmax === undefined || cmax === '' || total <= Number(cmax))
    } else if (ctype === 'keyword') {
      hit = String(order.customerName || '').includes(cval || '') || (order.items || []).some((it) => String(it.name || '').includes(cval || ''))
    } else if (ctype === 'region') {
      hit = String(order.region || order.customerName || '').includes(cval || '')
    }
    if (hit) {
      matched = r
      action = r.action || '手动处理'
      reason = `命中规则「${r.name}」`
      shippingMethod = r.shippingMethod || ''
      break
    }
  }
  // 自动分配物流渠道（未指定则从物流商列表取最便宜的）
  if (!shippingMethod && action === '自动审核') {
    const cheapest = [...methods].sort((a, b) => Number(a.cost || 0) - Number(b.cost || 0))[0]
    shippingMethod = cheapest?.name || ''
  }
  if (action === '自动审核') {
    await store.update('salesOrders', order.id, { status: '待发货', autoReviewed: true, reviewNote: reason })
  } else if (action === '拦截') {
    await store.update('salesOrders', order.id, { status: '已拦截', reviewNote: reason })
  }
  res.json({ code: 200, data: { orderNo, total, action, reason, rule: matched?.name || '', shippingMethod, newStatus: action === '自动审核' ? '待发货' : action === '拦截' ? '已拦截' : order.status } })
})

// 批量审单
app.post('/api/order-rule/batch', authRequired, adminRequired, async (req, res) => {
  const orders = (await store.all('salesOrders')).filter((o) => ['待审核', '新建'].includes(o.status))
  const methods = await store.all('shippingMethods')
  const rules = (await store.all('orderRules')).filter((r) => r.enabled !== '停用')
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
  let autoPassed = 0, blocked = 0
  for (const o of orders) {
    const total = Number(o.total || 0)
    const hit = rules.find((r) => {
      const c = r.condition || {}
      const ctype = c.type || r.conditionType || ''
      const cmin = c.min !== undefined ? c.min : r.min
      const cmax = c.max !== undefined ? c.max : r.max
      const cval = c.value !== undefined ? c.value : r.value
      if (ctype === 'amount') return total >= Number(cmin || 0) && (cmax === '' || cmax === undefined || total <= Number(cmax))
      if (ctype === 'keyword') return String(o.customerName || '').includes(cval || '')
      if (ctype === 'region') return String(o.region || o.customerName || '').includes(cval || '')
      return false
    })
    if (hit?.action === '自动审核') { await store.update('salesOrders', o.id, { status: '待发货', autoReviewed: true, reviewNote: `自动审核:${hit.name}` }); autoPassed++ }
    else if (hit?.action === '拦截') { await store.update('salesOrders', o.id, { status: '已拦截', reviewNote: `拦截:${hit.name}` }); blocked++ }
  }
  res.json({ code: 200, message: `批量审单完成：自动通过 ${autoPassed}，拦截 ${blocked}`, data: { autoPassed, blocked } })
})

// ---------- 多店铺库存同步规则 ----------
// 按规则把总库存分配到各店铺，防超卖
app.post('/api/inventory-sync/apply', authRequired, adminRequired, async (req, res) => {
  const { ruleId } = req.body || {}
  const rule = await store.find('inventorySyncRules', ruleId)
  if (!rule) return res.status(404).json({ code: 404, message: '同步规则不存在' })
  const products = await store.all('products')
  const product = products.find((p) => p.sku === rule.sku)
  if (!product) return res.status(404).json({ code: 404, message: `商品 ${rule.sku} 不存在` })
  const totalStock = Number(product.stock || 0)
  const allocations = []
  const shops = Array.isArray(rule.shops) && rule.shops.length ? rule.shops : []
  for (const shop of shops) {
    let qty = 0
    if (rule.mode === '按比例') {
      qty = Math.floor(totalStock * Number(shop.ratio || 0) / 100)
    } else {
      qty = Math.min(Number(shop.fixed || 0), totalStock)
    }
    allocations.push({ shop: shop.name, qty, ratio: shop.ratio || 0 })
  }
  const allocated = allocations.reduce((s, a) => s + a.qty, 0)
  await store.update('inventorySyncRules', rule.id, { lastSync: new Date().toISOString().slice(0, 10), lastAllocations: allocations })
  res.json({
    code: 200,
    message: `已同步 ${rule.sku} 库存到 ${allocations.length} 个店铺`,
    data: { sku: rule.sku, totalStock, allocations, allocated, reserved: totalStock - allocated, mode: rule.mode },
  })
})

// ---------- 定时上下架任务 ----------
app.get('/api/schedule/process', authRequired, adminRequired, async (req, res) => {
  const tasks = await store.all('scheduledListings')
  const now = new Date().toISOString()
  let executed = 0
  for (const t of tasks) {
    if (t.status !== '待执行' || !t.runAt || t.runAt > now) continue
    // 更新对应刊登/商品状态
    if (t.targetId) {
      const col = t.targetType === 'product' ? 'products' : 'listings'
      const target = await store.find(col, t.targetId)
      if (target) await store.update(col, t.targetId, { status: t.action === '上架' ? '在售' : '已下架' })
    }
    await store.update('scheduledListings', t.id, { status: '已执行', executedAt: now })
    executed++
  }
  res.json({ code: 200, message: `定时任务处理完成，执行 ${executed} 条`, data: { executed } })
})

// ---------- AI 工具箱（对标店小秘，本地规则引擎，无外部API依赖） ----------
// 违禁词库（按平台）
const BANNED_WORDS = {
  通用: ['最好', '第一', '最佳', '绝对', '100%', '全网最低', '最便宜', '顶级', '唯一', '永久', '包治', '特效', '国家级', '驰名商标'],
  亚马逊: ['best', 'No.1', 'number one', 'cheapest', '100% safe', 'guaranteed', 'free gift', 'sale', 'discount', 'review'],
  Shopee: ['最好', '最便宜', '第一', '100%正品', '绝对正品', '国家级'],
  TikTok: ['最好', '第一', '全网最低', '100%有效', '绝对'],
}
// AI 描述生成：基于产品名+卖点+关键词，模板化生成结构化描述
app.post('/api/ai/description', authRequired, adminRequired, async (req, res) => {
  const { name, keywords, sellingPoints, category, language, tone } = req.body || {}
  if (!name) return res.status(400).json({ code: 400, message: '请提供产品名称' })
  const kws = Array.isArray(keywords) ? keywords.filter(Boolean) : String(keywords || '').split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
  const points = Array.isArray(sellingPoints) ? sellingPoints.filter(Boolean) : String(sellingPoints || '').split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
  const lang = language || 'zh'
  const isEn = lang === 'en'
  const t = (zh, en) => isEn ? en : zh
  const titleKws = kws.slice(0, 4)
  const title = isEn
    ? `${name} ${titleKws.join(' ')} ${tone === 'professional' ? 'Premium Quality' : 'For Everyday Use'}`.trim()
    : `${name} ${titleKws.join(' ')} ${tone === 'professional' ? '高品质精选' : '日常实用款'}`.trim()
  const bullets = points.length ? points : [
    t('优质材料，耐用可靠，长期使用不变形', 'Premium material, durable and built to last'),
    t('人性化设计，操作简单，新手也能轻松上手', 'User-friendly design, easy to use even for beginners'),
    t('多场景适用，满足日常各种需求', 'Versatile for multiple scenarios and daily needs'),
  ]
  const description = [
    t(`【${category || '优选好物'}】${name}`, `[${category || 'Featured'}] ${name}`),
    '',
    t('产品亮点：', 'Key Features:'),
    ...bullets.map((p, i) => `${isEn ? '•' : '✦'} ${p}`),
    '',
    t('产品规格：', 'Specifications:'),
    t(`· 商品名称：${name}`, `· Product: ${name}`),
    t(`· 核心关键词：${kws.join(' / ') || '—'}`, `· Keywords: ${kws.join(' / ') || '—'}`),
    t(`· 适用场景：${category || '日常家用 / 办公 / 出行'}`, `· Application: ${category || 'Home / Office / Travel'}`),
    '',
    t('为什么选择我们？我们专注于每一处细节，从选材到出厂严格把关，只为给你更好的使用体验。现货速发，售后无忧，放心购买。', 'Why choose us? We focus on every detail, from material selection to strict quality control. Fast shipping and worry-free after-sales.'),
  ].join('\n')
  res.json({ code: 200, data: { title, description, bullets, language: lang, wordCount: description.length } })
})

// 一键翻译：电商常用词词典（本地可运行，非完整机器翻译）
const DICT = {
  zh2en: {
    '手机壳': 'Phone Case', '蓝牙耳机': 'Bluetooth Earbuds', '移动电源': 'Power Bank', '充电宝': 'Power Bank',
    '数据线': 'Charging Cable', '保护套': 'Protective Cover', '防水': 'Waterproof', '便携': 'Portable',
    '无线': 'Wireless', '高品质': 'Premium Quality', '耐用': 'Durable', '实用': 'Practical', '精选': 'Selected',
    '材料': 'Material', '设计': 'Design', '适用': 'Suitable for', '颜色': 'Color', '尺寸': 'Size',
    '高品质精选': 'Premium Selection', '日常实用款': 'For Everyday Use', '产品亮点': 'Key Features',
    '产品规格': 'Specifications', '商品名称': 'Product Name', '核心关键词': 'Key Words', '适用场景': 'Application',
    '优质材料，耐用可靠': 'Premium material, durable and reliable', '操作简单': 'Easy operation',
    '多场景适用': 'Suitable for multiple scenarios', '现货速发': 'Fast shipping', '售后无忧': 'Worry-free after-sales',
  },
  zh2ja: { '手机壳': 'スマホケース', '蓝牙耳机': 'ワイヤレスイヤホン', '移动电源': 'モバイルバッテリー', '防水': '防水', '便携': 'ポータブル', '无线': 'ワイヤレス', '高品质': '高品質', '耐用': '耐久性', '实用': '実用', '颜色': 'カラー', '尺寸': 'サイズ' },
  zh2ko: { '手机壳': '휴대폰 케이스', '蓝牙耳机': '무선 이어폰', '移动电源': '보조배터리', '防水': '방수', '便携': '휴대용', '无线': '무선', '高品质': '고품질', '耐用': '내구성', '实用': '실용적', '颜色': '색상', '尺寸': '크기' },
}
app.post('/api/ai/translate', authRequired, adminRequired, async (req, res) => {
  const { text, from, to } = req.body || {}
  if (!text) return res.status(400).json({ code: 400, message: '请提供要翻译的文本' })
  const key = `${from || 'zh'}2${to || 'en'}`
  const dict = DICT[key] || DICT.zh2en
  let result = String(text)
  // 长句优先替换
  const entries = Object.entries(dict).sort((a, b) => b[0].length - a[0].length)
  for (const [zh, en] of entries) result = result.split(zh).join(en)
  const hitRate = Object.keys(dict).filter((k) => text.includes(k)).length
  res.json({ code: 200, data: { original: text, translated: result, from: from || 'zh', to: to || 'en', mode: 'dictionary', matchedTerms: hitRate } })
})

// 违禁词检测强化（对标店小秘合规检测）
app.post('/api/ai/compliance', authRequired, adminRequired, async (req, res) => {
  const { text, platform } = req.body || {}
  if (!text) return res.status(400).json({ code: 400, message: '请提供检测文本' })
  const groups = [...(BANNED_WORDS['通用'] || []), ...(BANNED_WORDS[platform] || [])]
  const found = []
  for (const word of groups) {
    if (String(text).toLowerCase().includes(word.toLowerCase())) found.push(word)
  }
  res.json({
    code: 200,
    data: {
      passed: found.length === 0,
      found,
      count: found.length,
      platform: platform || '通用',
      suggestion: found.length ? `建议删除或替换：${found.join('、')}` : '合规检测通过，未发现违禁词',
    },
  })
})

// ---------- 智能客服：自动回复规则 + 云黑名单 ----------
// 用消息内容匹配规则关键词，返回建议回复
app.post('/api/cs/auto-reply', authRequired, adminRequired, async (req, res) => {
  const { message } = req.body || {}
  if (!message) return res.status(400).json({ code: 400, message: '请提供消息内容' })
  const [rules, blacklist] = await Promise.all([store.all('csRules'), store.all('blacklist')])
  // 黑名单拦截
  const blocked = blacklist.find((b) => b.active !== '否' && b.active !== false && message.toLowerCase().includes(String(b.keyword || '').toLowerCase()))
  if (blocked) return res.json({ code: 200, data: { blocked: true, reply: '', rule: blocked, reason: '命中云黑名单' } })
  // 关键词匹配规则（按优先级）
  // keywords 可能是数组（API创建）或逗号分隔字符串（CrudPage表单），统一处理
  const kwList = (r) => Array.isArray(r.keywords) ? r.keywords : String(r.keywords || '').split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
  const matched = rules.filter((r) => r.enabled !== '停用' && kwList(r).some((k) => message.toLowerCase().includes(String(k).toLowerCase())))
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))[0]
  res.json({
    code: 200,
    data: {
      blocked: false,
      matched: !!matched,
      reply: matched ? matched.reply : '',
      rule: matched || null,
      category: matched?.category || '未匹配',
    },
  })
})

// ---------- 选品开发：爆款评分 ----------
// 综合评分 = 销量分40% + 增速分30% + 利润分20% + 低竞争分10%
app.post('/api/research/score', authRequired, adminRequired, async (req, res) => {
  const { rows } = req.body || {}
  if (!Array.isArray(rows)) return res.status(400).json({ code: 400, message: '请提供选品数据数组' })
  const maxSales = Math.max(...rows.map((r) => Number(r.sales || 0)), 1)
  const maxGrowth = Math.max(...rows.map((r) => Number(r.growth || 0)), 1)
  const scored = rows.map((r) => {
    const sales = Number(r.sales || 0), growth = Number(r.growth || 0)
    const margin = Number(r.margin || 0) // 利润率%
    const competition = Number(r.competition || 5) // 竞争度1-10，越低越好
    const salesScore = Math.min(100, sales / maxSales * 100)
    const growthScore = Math.min(100, growth / maxGrowth * 100)
    const marginScore = Math.min(100, margin * 2)
    const compScore = Math.max(0, (10 - competition) * 10)
    const score = Math.round(salesScore * 0.4 + growthScore * 0.3 + marginScore * 0.2 + compScore * 0.1)
    return {
      ...r, score,
      verdict: score >= 80 ? '强烈推荐' : score >= 65 ? '值得关注' : score >= 50 ? '观察' : '不推荐',
    }
  }).sort((a, b) => b.score - a.score)
  res.json({ code: 200, data: { rows: scored, analyzed: scored.length } })
})

// ---------- 物流轨迹追踪 ----------
// 添加轨迹节点
app.post('/api/tracking/add-event/:id', authRequired, adminRequired, async (req, res) => {
  const rec = await store.find('shipments_tracking', req.params.id)
  if (!rec) return res.status(404).json({ code: 404, message: '运单不存在' })
  const { status, location, note, at } = req.body || {}
  if (!status) return res.status(400).json({ code: 400, message: '请填写轨迹状态' })
  const events = [...(rec.events || []), { status, location: location || '', note: note || '', at: at || new Date().toISOString() }]
  const patch = { events, lastStatus: status, lastUpdate: new Date().toISOString() }
  if (status === '已签收') patch.delivered = true
  await store.update('shipments_tracking', rec.id, patch)
  res.json({ code: 200, message: '轨迹已更新' })
})

// 异常件：超过 N 天未更新且未签收
app.get('/api/tracking/exceptions', authRequired, adminRequired, async (req, res) => {
  const days = Number(req.query.days || 7)
  const rows = (await store.all('shipments_tracking')).filter((t) => {
    if (t.delivered) return false
    const last = t.lastUpdate || t.createdAt
    if (!last) return false
    return (Date.now() - new Date(last)) / 86400000 > days
  }).map((t) => ({
    ...t,
    stuckDays: Math.floor((Date.now() - new Date(t.lastUpdate || t.createdAt)) / 86400000),
  }))
  res.json({ code: 200, data: { rows, total: rows.length } })
})

// ---------- 多店铺库存共享（防超卖） ----------
// 锁定库存：创建销售订单时锁库，检查可用库存（共享库存 - 已锁定）
app.post('/api/stock/lock', authRequired, adminRequired, async (req, res) => {
  const { sku, qty, orderNo } = req.body || {}
  const n = Number(qty || 0)
  if (n <= 0) return res.status(400).json({ code: 400, message: '锁定数量必须大于0' })
  const products = await store.all('products')
  const product = products.find((p) => p.sku === sku)
  if (!product) return res.status(404).json({ code: 404, message: '商品不存在' })
  const locks = await store.all('stockLocks')
  const locked = locks.filter((l) => l.sku === sku && !l.released).reduce((s, l) => s + Number(l.qty || 0), 0)
  const available = Number(product.stock || 0) - locked
  if (available < n) return res.status(400).json({ code: 400, message: `库存不足：可用 ${available}，需锁定 ${n}` })
  const rec = await store.create('stockLocks', { sku, productId: product.id, qty: n, orderNo: orderNo || '', released: false })
  res.json({ code: 200, message: `已锁定 ${n} 件（可用剩余 ${available - n}）`, data: { ...rec, available: available - n } })
})

// 释放锁定
app.post('/api/stock/unlock/:id', authRequired, adminRequired, async (req, res) => {
  const rec = await store.find('stockLocks', req.params.id)
  if (!rec) return res.status(404).json({ code: 404, message: '锁定记录不存在' })
  if (rec.released) return res.status(400).json({ code: 400, message: '已释放过' })
  await store.update('stockLocks', rec.id, { released: true, releasedAt: new Date().toISOString() })
  res.json({ code: 200, message: '库存已释放' })
})

// 库存占用概览：每个SKU的真实库存/已锁定/可用
app.get('/api/stock/availability', authRequired, adminRequired, async (req, res) => {
  const [products, locks] = await Promise.all([store.all('products'), store.all('stockLocks')])
  const rows = products.map((p) => {
    const locked = locks.filter((l) => l.sku === p.sku && !l.released).reduce((s, l) => s + Number(l.qty || 0), 0)
    const stock = Number(p.stock || 0)
    return { sku: p.sku, name: p.name, stock, locked, available: stock - locked }
  }).filter((r) => r.locked > 0)
  res.json({ code: 200, data: { rows } })
})

// ---------- 智能定价 ----------
// 反推售价：目标售价 = (成本 + 平台固定费) / (1 - 佣金率 - 利润率)
app.post('/api/pricing/suggest', authRequired, adminRequired, async (req, res) => {
  const { cost, platformFee, commissionRate, profitRate, shipping } = req.body || {}
  const c = Number(cost || 0), fixed = Number(platformFee || 0) + Number(shipping || 0)
  const cr = Number(commissionRate || 0) / 100, pr = Number(profitRate || 0) / 100
  const denom = 1 - cr - pr
  if (denom <= 0) return res.status(400).json({ code: 400, message: '佣金率+利润率必须小于100%' })
  const price = Math.round(((c + fixed) / denom) * 100) / 100
  const commission = Math.round(price * cr * 100) / 100
  const profit = Math.round(price * pr * 100) / 100
  res.json({
    code: 200,
    data: {
      cost: c, fixed, commissionRate: Number(commissionRate || 0), profitRate: Number(profitRate || 0),
      suggestPrice: price, commission, profit,
      margin: Math.round((profit / price) * 10000) / 100,
      formula: `(${c} + ${fixed}) / (1 - ${commissionRate}% - ${profitRate}%)`,
    },
  })
})

// ---------- 数据备份与恢复 ----------
app.get('/api/backup/export', authRequired, adminRequired, async (req, res) => {
  const data = {}
  for (const key of COLLECTIONS) {
    if (key === 'users') continue // 不备份账号密码
    data[key] = await store.all(key)
  }
  res.json({ code: 200, data: { exportedAt: new Date().toISOString(), collections: Object.keys(data).length, data } })
})
app.post('/api/backup/restore', authRequired, adminRequired, async (req, res) => {
  const { data, mode } = req.body || {}
  if (!data || typeof data !== 'object') return res.status(400).json({ code: 400, message: '备份数据格式错误' })
  let restored = 0, skipped = 0
  for (const key of Object.keys(data)) {
    if (!COLLECTIONS.includes(key) || key === 'users') { skipped++; continue }
    if (!Array.isArray(data[key])) { skipped++; continue }
    for (const row of data[key]) {
      const exists = row.id && await store.find(key, row.id)
      if (exists) { if (mode === 'replace') await store.update(key, row.id, row); else skipped++; }
      else { await store.create(key, row); restored++ }
    }
  }
  res.json({ code: 200, message: `恢复完成：新增 ${restored}，跳过 ${skipped}`, data: { restored, skipped } })
})

// ---------- 系统健康监控 ----------
app.get('/api/system/health', authRequired, adminRequired, async (req, res) => {
  const counts = {}
  for (const key of COLLECTIONS) {
    if (key === 'users') continue
    counts[key] = (await store.all(key)).length
  }
  const [audit, pushLogs, syncLogs] = await Promise.all([store.all('auditLogs'), store.all('pushLogs'), store.all('syncLogs')])
  const recentErrors = [...pushLogs, ...syncLogs].filter((l) => l.status === '失败' || l.success === false).slice(0, 10)
  res.json({
    code: 200,
    data: {
      counts,
      totalRecords: Object.values(counts).reduce((s, n) => s + n, 0),
      writeOps: audit.length,
      recentErrors,
      errorCount: recentErrors.length,
      serverTime: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    },
  })
})

// ---------- 促销优惠券 ----------
app.post('/api/coupon/validate', authRequired, adminRequired, async (req, res) => {
  const { code, amount } = req.body || {}
  const coupon = (await store.all('coupons')).find((c) => c.code === code)
  if (!coupon) return res.status(404).json({ code: 404, message: '优惠码不存在' })
  if (coupon.status !== '启用') return res.status(400).json({ code: 400, message: '优惠券已停用' })
  if (coupon.expiryDate && coupon.expiryDate < new Date().toISOString().slice(0, 10)) return res.status(400).json({ code: 400, message: '优惠券已过期' })
  const amt = Number(amount || 0)
  if (amt < Number(coupon.minAmount || 0)) return res.status(400).json({ code: 400, message: `未达到最低消费 ${coupon.minAmount}` })
  let discount = 0
  if (coupon.type === '满减') discount = Number(coupon.value || 0)
  else if (coupon.type === '折扣') discount = amt * (1 - Number(coupon.value || 1))
  discount = Math.min(discount, amt)
  res.json({ code: 200, data: { coupon, discount: Math.round(discount * 100) / 100, payable: Math.round((amt - discount) * 100) / 100 } })
})

// ---------- 广告投放 ROI 分析 ----------
// ACOS = 广告花费/广告销售额；ROAS = 广告销售额/花费；ROI = 毛利/花费
app.get('/api/ads/roi', authRequired, adminRequired, async (req, res) => {
  const [campaigns, sales, products] = await Promise.all([store.all('adCampaigns'), store.all('salesOrders'), store.all('products')])
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))
  const rows = campaigns.map((c) => {
    const spend = Number(c.spend || 0)
    const clicks = Number(c.clicks || 0)
    const orders = Number(c.orders || 0)
    // 广告销售额：优先用手填的 adSales，否则找同SKU的销售订单金额
    let adSales = Number(c.adSales || 0)
    if (!adSales && c.sku) {
      adSales = sales.filter((o) => o.status !== '已取消' && (o.items || []).some((it) => it.sku === c.sku))
        .reduce((s, o) => s + Number((o.items || []).filter((it) => it.sku === c.sku).reduce((t, it) => t + Number(it.qty || 0) * Number(it.price || 0), 0)), 0)
    }
    const acos = adSales > 0 ? Math.round((spend / adSales) * 10000) / 100 : null
    const roas = spend > 0 ? Math.round((adSales / spend) * 100) / 100 : null
    const roi = spend > 0 ? Math.round(((adSales - spend) / spend) * 100) / 100 : null
    return {
      id: c.id, name: c.name || '', platform: c.platform || '', sku: c.sku || '',
      spend, clicks, orders, adSales: Math.round(adSales * 100) / 100,
      cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : null,
      acos, roas, roi,
      health: acos == null ? '无数据' : acos <= 20 ? '优秀' : acos <= 35 ? '良好' : acos <= 50 ? '一般' : '亏损',
    }
  })
  const totalSpend = rows.reduce((s, r) => s + r.spend, 0)
  const totalSales = rows.reduce((s, r) => s + r.adSales, 0)
  res.json({
    code: 200,
    data: {
      rows,
      sum: {
        spend: Math.round(totalSpend * 100) / 100,
        adSales: Math.round(totalSales * 100) / 100,
        acos: totalSales > 0 ? Math.round((totalSpend / totalSales) * 10000) / 100 : null,
        roas: totalSpend > 0 ? Math.round((totalSales / totalSpend) * 100) / 100 : null,
      },
    },
  })
})

// ---------- 智能调拨建议 ----------
// 按各仓库存与近30天销量算：哪些仓缺货、哪些仓积压，建议从哪调到哪
app.get('/api/transfer/suggest', authRequired, adminRequired, async (req, res) => {
  const [products, warehouses, sales, stockTransfers] = await Promise.all([
    store.all('products'), store.all('warehouses'), store.all('salesOrders'), store.all('stockTransfers'),
  ])
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  // 近30天各SKU销量
  const sold = {}
  sales.filter((o) => (o.orderDate || '') >= cutoff && o.status !== '已取消')
    .forEach((o) => (o.items || []).forEach((it) => { if (it.sku) sold[it.sku] = (sold[it.sku] || 0) + Number(it.qty || 0) }))
  // 各仓各SKU库存：从 locations/库存明细找 warehouseId；若无明细，用商品的 warehouse 字段
  const inv = {}
  products.forEach((p) => {
    const wh = p.warehouse || p.warehouseName || warehouses[0]?.name || '主仓'
    const key = `${wh}|${p.sku}`
    inv[key] = (inv[key] || 0) + Number(p.stock || 0)
  })
  // 按SKU汇总各仓库存
  const bySku = {}
  Object.entries(inv).forEach(([key, qty]) => {
    const [wh, sku] = key.split('|')
    ;(bySku[sku] || (bySku[sku] = [])) .push({ warehouse: wh, qty })
  })
  const suggestions = []
  Object.entries(bySku).forEach(([sku, whs]) => {
    if (whs.length < 2) return // 至少需要两个仓才能调拨
    const demand = sold[sku] || 0
    const sorted = [...whs].sort((a, b) => b.qty - a.qty)
    const from = sorted[0], to = sorted[sorted.length - 1]
    if (from.qty > demand * 1.5 && to.qty < demand * 0.5 && from.qty > to.qty) {
      const qty = Math.min(Math.floor((from.qty - to.qty) / 2), Math.max(demand, 10))
      suggestions.push({
        sku, name: (products.find((p) => p.sku === sku)?.name) || '',
        demand, fromWarehouse: from.warehouse, fromQty: from.qty,
        toWarehouse: to.warehouse, toQty: to.qty,
        suggestQty: qty,
        reason: `调出仓库存充裕（${from.qty}），调入仓偏低（${to.qty}），近30天销量 ${demand}`,
      })
    }
  })
  res.json({ code: 200, data: { rows: suggestions, warehouses: warehouses.length } })
})

// ---------- 员工绩效 ----------
// 按销售订单的 owner/operator 字段统计员工业绩
app.get('/api/performance/team', authRequired, adminRequired, async (req, res) => {
  const [sales, users] = await Promise.all([store.all('salesOrders'), store.all('users')])
  const stats = {}
  sales.filter((o) => o.status !== '已取消').forEach((o) => {
    const owner = o.owner || o.operator || o.salesperson || '未分配'
    const s = stats[owner] || (stats[owner] = { name: owner, orders: 0, amount: 0 })
    s.orders++
    s.amount += Number(o.total || 0)
  })
  const rows = Object.values(stats).map((s) => ({
    ...s, amount: Math.round(s.amount * 100) / 100,
    avg: Math.round((s.amount / Math.max(1, s.orders)) * 100) / 100,
  })).sort((a, b) => b.amount - a.amount)
  rows.forEach((r, i) => { r.rank = i + 1 })
  res.json({ code: 200, data: { rows, total: rows.length } })
})

// ---------- 销售漏斗 ----------
// 按商机阶段统计数量与金额（用 followUps 的 stage + 客户跟进）
app.get('/api/funnel/stages', authRequired, adminRequired, async (req, res) => {
  const [followUps, deals] = await Promise.all([store.all('followUps'), store.all('deals')])
  const stages = ['初步接触', '需求确认', '报价中', '谈判中', '已成交', '已流失']
  const rows = stages.map((stage) => {
    const fs = followUps.filter((f) => f.stage === stage)
    const ds = deals.filter((d) => d.stage === stage)
    return {
      stage,
      count: fs.length + ds.length,
      amount: Math.round(ds.reduce((s, d) => s + Number(d.amount || 0), 0) * 100) / 100,
    }
  })
  res.json({ code: 200, data: { rows } })
})

// ---------- 商品标题优化建议 ----------
app.post('/api/copy/title-check', authRequired, adminRequired, async (req, res) => {
  const { title } = req.body || {}
  if (!title || typeof title !== 'string') return res.status(400).json({ code: 400, message: '请提供标题' })
  const issues = []
  const suggestions = []
  const len = title.trim().length
  if (len < 20) issues.push('标题过短（建议 20-100 字符）')
  if (len > 120) issues.push('标题过长（部分平台限制 100-120 字符）')
  if (/\s{2,}/.test(title)) issues.push('存在连续空格')
  if (/(免费|最|第一|绝对|100%|最便宜)/.test(title)) issues.push('含平台违禁词（最/第一/100% 等）')
  if (!/[0-9]/.test(title)) suggestions.push('加入规格/型号数字提升搜索命中')
  const words = title.trim().split(/\s+/).filter((w) => w.length > 2)
  if (words.length < 4) suggestions.push('增加核心关键词（当前词数偏少）')
  const hasBrand = /[A-Z]{2,}/.test(title)
  if (!hasBrand) suggestions.push('如有品牌名建议前置')
  res.json({
    code: 200,
    data: {
      length: len, score: Math.max(0, 100 - issues.length * 15 - suggestions.length * 5),
      issues, suggestions,
    },
  })
})

// ---------- RFQ 询价比价 ----------
// 选中标报价 → 生成采购单
app.post('/api/rfq/award/:id', authRequired, adminRequired, async (req, res) => {
  const rfq = await store.find('rfqs', req.params.id)
  if (!rfq) return res.status(404).json({ code: 404, message: '询价单不存在' })
  if (rfq.status === '已完成') return res.status(400).json({ code: 400, message: '该询价单已完成' })
  const { quoteId } = req.body || {}
  const quote = (rfq.quotes || []).find((q) => q.id === quoteId)
  if (!quote) return res.status(404).json({ code: 404, message: '报价不存在' })
  const po = await store.create('purchaseOrders', {
    orderNo: 'PO-RFQ-' + Date.now().toString().slice(-6),
    supplierName: quote.supplierName || '',
    items: rfq.items && rfq.items.length
      ? rfq.items.map((it) => ({ sku: it.sku, name: it.name, qty: Number(it.qty || 1), price: Number(quote.unitPrice || 0) }))
      : [{ sku: rfq.sku || '', name: rfq.productName || '询价商品', qty: Number(rfq.qty || 1), price: Number(quote.unitPrice || 0) }],
    total: Math.round((rfq.items && rfq.items.length
      ? rfq.items.reduce((s, it) => s + Number(it.qty || 1) * Number(quote.unitPrice || 0), 0)
      : Number(rfq.qty || 1) * Number(quote.unitPrice || 0)) * 100) / 100,
    status: '待审批', source: `询价比价:${rfq.rfqNo || ''}`,
  })
  await store.update('rfqs', rfq.id, { status: '已完成', awardedQuoteId: quoteId, awardedSupplier: quote.supplierName, purchaseNo: po.orderNo })
  res.json({ code: 200, message: `已授标给 ${quote.supplierName}，采购单 ${po.orderNo} 已生成`, data: po })
})

// 比价：把各家报价按总价排序
app.get('/api/rfq/compare/:id', authRequired, adminRequired, async (req, res) => {
  const rfq = await store.find('rfqs', req.params.id)
  if (!rfq) return res.status(404).json({ code: 404, message: '询价单不存在' })
  const totalQty = rfq.items && rfq.items.length
    ? rfq.items.reduce((s, it) => s + Number(it.qty || 1), 0)
    : Number(rfq.qty || 1)
  const rows = (rfq.quotes || []).map((q) => ({
    ...q,
    totalAmount: Math.round(Number(q.unitPrice || 0) * totalQty * 100) / 100,
  })).sort((a, b) => a.totalAmount - b.totalAmount)
  res.json({ code: 200, data: { rows, totalQty, best: rows[0] || null } })
})

// ---------- 质检管理 ----------
// 质检判定：合格 → 联动入库（增加库存+流水）；不合格 → 退货流程提示
app.post('/api/qc/judge/:id', authRequired, adminRequired, async (req, res) => {
  const qc = await store.find('qualityChecks', req.params.id)
  if (!qc) return res.status(404).json({ code: 404, message: '质检单不存在' })
  if (['合格', '不合格'].includes(qc.status)) return res.status(400).json({ code: 400, message: '该质检单已判定' })
  const { result, passQty, note } = req.body || {}
  if (!['合格', '不合格'].includes(result)) return res.status(400).json({ code: 400, message: '判定必须是合格或不合格' })
  const patch = { status: result, result, note: note || '', checkedAt: new Date().toISOString().slice(0, 10) }
  if (result === '合格') {
    const pid = qc.productId
    const qty = Number(passQty ?? qc.qty ?? 0)
    if (pid && qty > 0) {
      const product = await store.find('products', pid)
      if (product) {
        await store.update('products', pid, { stock: Number(product.stock || 0) + qty })
        await store.create('stockLogs', {
          type: '入库', productId: pid, sku: product.sku || '', name: product.name || '',
          qty, relatedNo: qc.qcNo || '', note: '质检合格入库',
        })
        patch.stockedQty = qty
      }
    }
  } else {
    await notify(`[质检不合格] ${qc.qcNo || ''}`, `${qc.sku || ''} ${note || '需退货处理'}`, '质检', '/quality')
  }
  await store.update('qualityChecks', qc.id, patch)
  res.json({ code: 200, message: result === '合格' ? '质检合格，库存已入库' : '已标记不合格并通知' })
})

// ---------- 批次追溯 ----------
// 按批次号查询相关出入库流水
app.get('/api/batch/trace/:batchNo', authRequired, adminRequired, async (req, res) => {
  const batchNo = req.params.batchNo
  const batch = (await store.all('batches')).find((b) => b.batchNo === batchNo)
  if (!batch) return res.status(404).json({ code: 404, message: '批次不存在' })
  const logs = (await store.all('stockLogs')).filter((l) => l.relatedNo === batchNo || l.batchNo === batchNo)
  res.json({ code: 200, data: { batch, logs, traceCount: logs.length } })
})

// ---------- 自定义报表 ----------
// 动态查询：从白名单集合按选定字段与筛选条件生成数据
app.post('/api/report/run', authRequired, adminRequired, async (req, res) => {
  const { collection, fields, filters } = req.body || {}
  const allowed = ['products', 'customers', 'suppliers', 'salesOrders', 'purchaseOrders', 'stockLogs', 'payments', 'settlements', 'invoices', 'expenses']
  if (!allowed.includes(collection)) return res.status(400).json({ code: 400, message: '该数据源不支持报表' })
  let rows = await store.all(collection)
  for (const f of (filters || [])) {
    if (!f.field || f.value === '' || f.value == null) continue
    rows = rows.filter((r) => String(r[f.field] ?? '').toLowerCase().includes(String(f.value).toLowerCase()))
  }
  const cols = Array.isArray(fields) && fields.length ? fields : Object.keys(rows[0] || {}).filter((k) => k !== '_id').slice(0, 12)
  const data = rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? ''])))
  res.json({ code: 200, data: { columns: cols, rows: data, total: data.length } })
})

// ---------- 自动化规则引擎 ----------
const notify = async (title, content, category, link) => {
  await store.create('notifications', { title, content, category: category || '系统', link: link || '', read: false })
}

// 运行单条规则（供手动触发与批量共用）
async function runRule(rule) {
  let matched = 0, actions = []
  const products = await store.all('products')
  const sales = await store.all('salesOrders')
  const payments = await store.all('payments')
  const cond = rule.condition || {}
  let targets = []

  if (cond.type === 'lowStock') {
    targets = products.filter((p) => Number(p.stock || 0) <= Number(p.safeStock || 0))
  } else if (cond.type === 'overdueOrder') {
    const days = Number(cond.days || 3)
    targets = sales.filter((o) => {
      if (['已完成', '已取消', '已发货'].includes(o.status)) return false
      if (!o.orderDate) return false
      return Math.floor((Date.now() - new Date(o.orderDate)) / 86400000) > days
    })
  } else if (cond.type === 'overdueReceivable') {
    const days = Number(cond.days || 30)
    targets = sales.filter((o) => {
      if (o.status === '已取消') return false
      const received = payments.filter((p) => p.direction === '收款' && p.relatedNo === o.orderNo).reduce((s, p) => s + Number(p.amount || 0), 0)
      const balance = Number(o.total || 0) - received
      const age = o.orderDate ? Math.floor((Date.now() - new Date(o.orderDate)) / 86400000) : 0
      return balance > 0 && age > days
    })
  }
  matched = targets.length

  for (const t of targets) {
    for (const action of (rule.actions || [])) {
      if (action === 'createPurchase') {
        if (cond.type === 'lowStock' && t.id) {
          const qty = Math.max(Number(t.safeStock || 10) * 2 - Number(t.stock || 0), 1)
          await store.create('purchaseOrders', {
            orderNo: 'PO-AUTO-' + Date.now().toString().slice(-6),
            supplierName: '', items: [{ productId: t.id, sku: t.sku, name: t.name, qty, price: Number(t.costPrice || 0) }],
            total: Math.round(qty * Number(t.costPrice || 0) * 100) / 100,
            status: '待审批', source: `自动化规则:${rule.name}`,
          })
          actions.push(`为 ${t.sku} 生成采购单`)
        }
      } else if (action === 'notify') {
        await notify(`[自动提醒] ${rule.name}`, `${t.sku || t.orderNo || ''} 触发条件`, '自动化', rule.link || '')
        actions.push(`通知: ${t.sku || t.orderNo || ''}`)
      } else if (action === 'createAlert') {
        await notify(`[预警] ${rule.name}`, `${t.sku || t.orderNo || ''} 需要处理`, '预警', rule.link || '')
        actions.push(`预警: ${t.sku || t.orderNo || ''}`)
      }
    }
  }
  return { matched, actions: actions.slice(0, 20) }
}

app.post('/api/rule/run/:id', authRequired, adminRequired, async (req, res) => {
  const rule = await store.find('automationRules', req.params.id)
  if (!rule) return res.status(404).json({ code: 404, message: '规则不存在' })
  const result = await runRule(rule)
  await store.create('ruleLogs', {
    ruleId: rule.id, ruleName: rule.name,
    matched: result.matched, actions: result.actions.join('；'),
    at: new Date().toISOString(), triggeredBy: req.user?.name || '系统',
  })
  await store.update('automationRules', rule.id, { lastRun: new Date().toISOString(), lastMatched: result.matched })
  res.json({ code: 200, message: `规则执行完成，命中 ${result.matched} 条`, data: result })
})

app.post('/api/rule/run-all', authRequired, adminRequired, async (req, res) => {
  const rules = (await store.all('automationRules')).filter((r) => r.enabled === '启用')
  let total = 0
  for (const rule of rules) {
    const result = await runRule(rule)
    total += result.matched
    await store.create('ruleLogs', {
      ruleId: rule.id, ruleName: rule.name, matched: result.matched,
      actions: result.actions.join('；'), at: new Date().toISOString(), triggeredBy: '批量运行',
    })
    await store.update('automationRules', rule.id, { lastRun: new Date().toISOString(), lastMatched: result.matched })
  }
  res.json({ code: 200, message: `${rules.length} 条规则执行完成，共命中 ${total} 条`, data: { rules: rules.length, total } })
})

// ---------- 通知中心 ----------
app.post('/api/notification/read/:id', authRequired, async (req, res) => {
  const rec = await store.find('notifications', req.params.id)
  if (!rec) return res.status(404).json({ code: 404, message: '通知不存在' })
  await store.update('notifications', rec.id, { read: true, readAt: new Date().toISOString() })
  res.json({ code: 200, message: '已标记为已读' })
})
app.post('/api/notification/read-all', authRequired, async (req, res) => {
  const rows = await store.all('notifications')
  for (const n of rows.filter((n) => !n.read)) await store.update('notifications', n.id, { read: true, readAt: new Date().toISOString() })
  res.json({ code: 200, message: '全部已读' })
})

// ---------- 初始化默认角色 ----------
app.post('/api/rbac/init-roles', authRequired, adminRequired, async (req, res) => {
  const existing = await store.all('roles')
  const defaults = [
    { key: 'operator', name: '操作员', menus: ['/', '/products', '/inventory', '/sales', '/purchase', '/shipments', '/labels'], desc: '日常订单与商品操作' },
    { key: 'warehouse', name: '仓库管理员', menus: ['/', '/products', '/inventory', '/stock-flow', '/warehouses', '/stock-transfers', '/warehouse-fx', '/warehouse-intel', '/labels'], desc: '库存与仓库作业' },
    { key: 'finance', name: '财务人员', menus: ['/', '/finance', '/payments', '/profit', '/pricing', '/compliance', '/gl', '/reconciliation', '/performance'], desc: '财务与结算' },
    { key: 'service', name: '客服人员', menus: ['/', '/sales', '/customers', '/crm', '/messages', '/after-sales'], desc: '客户与售后' },
  ]
  let added = 0
  for (const r of defaults) {
    if (existing.some((x) => x.key === r.key)) continue
    await store.create('roles', { ...r, status: '启用' })
    added++
  }
  res.json({ code: 200, message: `已初始化 ${added} 个角色`, data: { added } })
})

// ---------- 客户门户数据（客户账号仅看自己） ----------
app.get('/api/portal/summary', authRequired, async (req, res) => {
  const cid = req.user?.customerId
  if (!cid) return res.status(403).json({ code: 403, message: '仅客户账号可访问' })
  const [sales, customer, payments] = await Promise.all([store.all('salesOrders'), store.all('customers'), store.all('payments')])
  const mine = sales.filter((o) => o.customerId === cid)
  const valid = mine.filter((o) => o.status !== '已取消')
  const received = payments.filter((p) => p.direction === '收款' && mine.some((o) => o.orderNo === p.relatedNo)).reduce((s, p) => s + Number(p.amount || 0), 0)
  const me = customer.find((c) => c.id === cid)
  res.json({
    code: 200,
    data: {
      customer: me || {},
      orders: mine.slice(0, 20),
      stats: {
        orderCount: mine.length,
        totalAmount: Math.round(valid.reduce((s, o) => s + Number(o.total || 0), 0) * 100) / 100,
        received: Math.round(received * 100) / 100,
        unpaid: Math.round((valid.reduce((s, o) => s + Number(o.total || 0), 0) - received) * 100) / 100,
      },
    },
  })
})

// ---------- 组合商品 BOM：价格与库存换算 ----------
app.post('/api/bom/calc', authRequired, adminRequired, async (req, res) => {
  const { bundleId, qty } = req.body || {}
  const bundle = await store.find('bundles', bundleId)
  if (!bundle) return res.status(404).json({ code: 404, message: '组合商品不存在' })
  const products = await store.all('products')
  const rows = (bundle.items || []).map((it) => {
    const p = products.find((x) => x.id === it.productId)
    return {
      productId: it.productId, sku: it.sku || p?.sku || '', name: it.name || p?.name || '',
      perSet: Number(it.qty || 1), needed: Number(it.qty || 1) * Number(qty || 1),
      stock: p ? Number(p.stock || 0) : 0,
      cost: Math.round(Number(it.qty || 1) * Number(p?.costPrice || 0) * 100) / 100,
      enough: p ? Number(p.stock || 0) >= Number(it.qty || 1) * Number(qty || 1) : false,
    }
  })
  const costTotal = Math.round(rows.reduce((s, r) => s + r.cost, 0) * 100) / 100
  const canAssemble = rows.every((r) => r.enough)
  res.json({ code: 200, data: { rows, costTotal, canAssemble, maxSets: canAssemble ? Math.min(...rows.map((r) => Math.floor(r.stock / r.perSet))) : 0 } })
})

// ---------- 售后工单流转 ----------
app.post('/api/after-sales/process/:id', authRequired, adminRequired, async (req, res) => {
  const rec = await store.find('afterSales', req.params.id)
  if (!rec) return res.status(404).json({ code: 404, message: '售后单不存在' })
  if (['已完成', '已取消'].includes(rec.status)) return res.status(400).json({ code: 400, message: '该售后单已结束' })
  const { status, solution } = req.body || {}
  if (!['处理中', '已完成', '已取消'].includes(status)) return res.status(400).json({ code: 400, message: '状态无效' })
  await store.update('afterSales', rec.id, { status, solution: solution || rec.solution || '', processedAt: new Date().toISOString().slice(0, 10) })
  res.json({ code: 200, message: `售后单已更新为「${status}」` })
})

// ---------- 会计总账 ----------
// 初始化科目表（中国会计准则常用科目）
app.post('/api/gl/init-accounts', authRequired, adminRequired, async (req, res) => {
  const existing = await store.all('glAccounts')
  const defaults = [
    { code: '1001', name: '库存现金', type: '资产', direction: '借' },
    { code: '1002', name: '银行存款', type: '资产', direction: '借' },
    { code: '1122', name: '应收账款', type: '资产', direction: '借' },
    { code: '1405', name: '库存商品', type: '资产', direction: '借' },
    { code: '2202', name: '应付账款', type: '负债', direction: '贷' },
    { code: '2211', name: '应付职工薪酬', type: '负债', direction: '贷' },
    { code: '2221', name: '应交税费', type: '负债', direction: '贷' },
    { code: '4001', name: '实收资本', type: '所有者权益', direction: '贷' },
    { code: '5001', name: '主营业务收入', type: '损益', direction: '贷' },
    { code: '5401', name: '主营业务成本', type: '损益', direction: '借' },
    { code: '5601', name: '销售费用', type: '损益', direction: '借' },
    { code: '5602', name: '管理费用', type: '损益', direction: '借' },
  ]
  let added = 0
  for (const a of defaults) {
    if (existing.some((x) => x.code === a.code)) continue
    await store.create('glAccounts', { ...a, status: '启用' })
    added++
  }
  res.json({ code: 200, message: `已初始化 ${added} 个会计科目`, data: { added } })
})

// 记账凭证：借贷必须平衡
app.post('/api/gl/voucher', authRequired, adminRequired, async (req, res) => {
  const { voucherNo, date, summary, lines } = req.body || {}
  if (!Array.isArray(lines) || lines.length < 2) return res.status(400).json({ code: 400, message: '凭证至少要有两条分录' })
  const debit = lines.reduce((s, l) => s + Number(l.debit || 0), 0)
  const credit = lines.reduce((s, l) => s + Number(l.credit || 0), 0)
  if (Math.abs(debit - credit) > 0.01) {
    return res.status(400).json({ code: 400, message: `借贷不平衡：借方 ${debit.toFixed(2)} ≠ 贷方 ${credit.toFixed(2)}` })
  }
  if (lines.some((l) => !l.accountCode || (Number(l.debit || 0) === 0 && Number(l.credit || 0) === 0))) {
    return res.status(400).json({ code: 400, message: '分录必须有科目且借贷金额不能同时为 0' })
  }
  const rec = await store.create('vouchers', {
    voucherNo: voucherNo || 'PZ-' + Date.now().toString().slice(-8),
    date: date || new Date().toISOString().slice(0, 10),
    summary: summary || '',
    lines: lines.map((l) => ({
      accountCode: l.accountCode, accountName: l.accountName || '',
      summary: l.summary || '', debit: Number(l.debit || 0), credit: Number(l.credit || 0),
    })),
    total: Math.round(debit * 100) / 100,
    status: '已记账', source: '手工录入',
    createdBy: req.user?.name || req.user?.username || '系统',
  })
  res.json({ code: 200, message: '凭证已记账（借贷平衡）', data: rec })
})

// 科目余额表：按科目汇总借贷发生额与余额
app.get('/api/gl/balance', authRequired, adminRequired, async (req, res) => {
  const [accounts, vouchers] = await Promise.all([store.all('glAccounts'), store.all('vouchers')])
  const rows = accounts.map((acc) => {
    let debit = 0, credit = 0
    vouchers.filter((v) => v.status === '已记账').forEach((v) => {
      (v.lines || []).filter((l) => l.accountCode === acc.code).forEach((l) => {
        debit += Number(l.debit || 0)
        credit += Number(l.credit || 0)
      })
    })
    const balance = acc.direction === '借' ? debit - credit : credit - debit
    return { code: acc.code, name: acc.name, type: acc.type, direction: acc.direction, debit, credit, balance }
  })
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  res.json({
    code: 200,
    data: {
      rows,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    },
  })
})

// ---------- 平台结算对账 ----------
// 导入平台结算单并按订单号与系统销售订单核对
app.post('/api/settle/reconcile', authRequired, adminRequired, async (req, res) => {
  const { rows } = req.body || {}
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ code: 400, message: '请提供结算单数据' })
  const sales = await store.all('salesOrders')
  const existing = await store.all('settlements')
  const seen = new Set(existing.map((s) => s.settlementNo).filter(Boolean))
  let added = 0, skipped = 0
  for (const row of rows) {
    const no = String(row.settlementNo || row.orderNo || '').trim()
    if (!no || seen.has(no)) { skipped++; continue }
    seen.add(no)
    const orderNo = String(row.orderNo || '').trim()
    const order = sales.find((o) => o.orderNo === orderNo)
    const salesAmount = Number(row.salesAmount || 0)
    const commission = Number(row.commission || 0)
    const adFee = Number(row.adFee || 0)
    const refund = Number(row.refund || 0)
    const actual = Number(row.actualAmount ?? (salesAmount - commission - adFee - refund))
    const systemAmount = order ? Number(order.total || 0) : 0
    // 对账差异 = 系统订单金额 − 平台销售额（佣金/广告/退款是平台正常扣费，不算差异）
    const diff = order ? Math.round((systemAmount - salesAmount) * 100) / 100 : null
    await store.create('settlements', {
      settlementNo: no, orderNo,
      platform: row.platform || order?.shopName || '',
      shopName: row.shopName || order?.shopName || '',
      salesAmount, commission, adFee, refund, actualAmount: actual,
      systemAmount, diff,
      status: !order ? '未匹配' : Math.abs(diff) < 0.01 ? '已对平' : '有差异',
      settleDate: row.settleDate || new Date().toISOString().slice(0, 10),
      remark: row.remark || '',
    })
    added++
  }
  res.json({ code: 200, message: `对账完成：新增 ${added}，跳过 ${skipped}`, data: { added, skipped } })
})

// ---------- KPI 目标 ----------
// 达成率：目标 vs 实际（按月份，可按店铺过滤）
app.get('/api/kpi/attainment', authRequired, adminRequired, async (req, res) => {
  const [targets, sales] = await Promise.all([store.all('kpiTargets'), store.all('salesOrders')])
  const month = String(req.query.month || new Date().toISOString().slice(0, 7))
  const rows = targets.filter((t) => (t.month || '') === month).map((t) => {
    const actual = sales.filter((o) => {
      if (!(o.orderDate || '').startsWith(month) || o.status === '已取消') return false
      if (t.shopId && o.shopId !== t.shopId) return false
      return true
    }).reduce((s, o) => s + Number(o.total || 0), 0)
    const target = Number(t.target || 0)
    const rate = target > 0 ? Math.round((actual / target) * 10000) / 100 : 0
    return {
      targetId: t.id, month, scope: t.shopName || '整体',
      target, actual: Math.round(actual * 100) / 100, rate,
      gap: Math.round((actual - target) * 100) / 100,
      status: rate >= 100 ? '达成' : rate >= 80 ? '接近' : '未达成',
    }
  })
  res.json({ code: 200, data: { rows, month } })
})

// ---------- 统一预警中心 ----------
// 聚合：低库存 / 逾期应收 / 待审批 / 跟进逾期 / 未对平结算
app.get('/api/alerts/all', authRequired, adminRequired, async (req, res) => {
  const [products, payments, approvals, followUps, settlements] = await Promise.all([
    store.all('products'), store.all('payments'), store.all('approvals'), store.all('followUps'), store.all('settlements'),
  ])
  const alerts = []
  // 低库存
  products.filter((p) => Number(p.stock || 0) <= Number(p.safeStock || 0)).forEach((p) => {
    alerts.push({ level: '高', type: '库存预警', title: `${p.sku} ${p.name} 库存不足`, detail: `当前 ${p.stock}，安全库存 ${p.safeStock}`, link: '/inventory' })
  })
  // 逾期应收：销售订单超过30天未结清
  const [sales] = await Promise.all([store.all('salesOrders')])
  sales.filter((o) => o.status !== '已取消').forEach((o) => {
    const received = payments.filter((p) => p.direction === '收款' && p.relatedNo === o.orderNo).reduce((s, p) => s + Number(p.amount || 0), 0)
    const balance = Number(o.total || 0) - received
    const days = o.orderDate ? Math.floor((Date.now() - new Date(o.orderDate)) / 86400000) : 0
    if (balance > 0 && days > 30) alerts.push({ level: '高', type: '逾期应收', title: `${o.orderNo} 逾期未收`, detail: `未收 ¥${balance.toFixed(2)}，已过 ${days} 天`, link: '/payments' })
  })
  // 待审批
  const pending = approvals.filter((a) => a.status === '待审批').length
  if (pending) alerts.push({ level: '中', type: '审批待办', title: `${pending} 条审批待处理`, detail: '请到审批中心处理', link: '/workflow' })
  // 跟进逾期
  const today = new Date().toISOString().slice(0, 10)
  const overdue = followUps.filter((f) => f.nextDate && f.nextDate < today && !['已成交', '已流失'].includes(f.stage)).length
  if (overdue) alerts.push({ level: '中', type: '客户跟进', title: `${overdue} 条跟进已逾期`, detail: '尽快联系客户避免流失', link: '/crm' })
  // 结算差异
  const diff = settlements.filter((s) => s.status === '有差异' || s.status === '未匹配').length
  if (diff) alerts.push({ level: '中', type: '对账差异', title: `${diff} 条结算有差异`, detail: '请核对平台结算单', link: '/reconcile' })
  const order = { 高: 0, 中: 1, 低: 2 }
  alerts.sort((a, b) => order[a.level] - order[b.level])
  res.json({ code: 200, data: { rows: alerts, total: alerts.length, byLevel: { 高: alerts.filter((a) => a.level === '高').length, 中: alerts.filter((a) => a.level === '中').length } } })
})

// ---------- 库龄分析 ----------
// 按商品入库批次时间分档：0-30/31-60/61-90/90+ 天，标记呆滞
app.get('/api/inventory/aging', authRequired, adminRequired, async (req, res) => {
  const [products, stockLogs, purchases] = await Promise.all([store.all('products'), store.all('stockLogs'), store.all('purchaseOrders')])
  const now = Date.now()
  const rows = products.map((p) => {
    const stock = Number(p.stock || 0)
    // 找最近一次入库时间：优先采购单到货，其次入库流水
    let lastIn = p.createdAt || ''
    stockLogs.filter((l) => l.type === '入库' && l.productId === p.id && l.createdAt).forEach((l) => {
      if (l.createdAt > lastIn) lastIn = l.createdAt
    })
    purchases.filter((o) => ['已完成', '待入库'].includes(o.status)).forEach((o) => {
      (o.items || []).filter((it) => it.productId === p.id && o.orderDate && o.orderDate > lastIn).forEach(() => { lastIn = o.orderDate })
    })
    const age = lastIn ? Math.floor((now - new Date(lastIn)) / 86400000) : 0
    const bucket = age <= 30 ? '0-30天' : age <= 60 ? '31-60天' : age <= 90 ? '61-90天' : '90天以上'
    const amount = Math.round(stock * Number(p.costPrice || 0) * 100) / 100
    return {
      productId: p.id, sku: p.sku, name: p.name, stock,
      costPrice: Number(p.costPrice || 0), amount,
      lastIn: lastIn ? lastIn.slice(0, 10) : '-', age, bucket,
      stagnant: age > 90 && stock > 0,
    }
  }).filter((r) => r.stock > 0)
  const summary = {}
  rows.forEach((r) => { summary[r.bucket] = (summary[r.bucket] || 0) + r.amount })
  res.json({
    code: 200,
    data: {
      rows: rows.sort((a, b) => b.age - a.age),
      summary,
      stagnantCount: rows.filter((r) => r.stagnant).length,
      stagnantAmount: Math.round(rows.filter((r) => r.stagnant).reduce((s, r) => s + r.amount, 0) * 100) / 100,
    },
  })
})

// ---------- 智能补货建议 ----------
// 算法：日均销量（近90天销售订单） × (采购提前期 + 安全天数) - 当前库存 - 在途
// 采购提前期从供应商 leadTime 字段取，默认 7 天；安全天数默认 7 天
app.get('/api/replenish/suggest', authRequired, adminRequired, async (req, res) => {
  const leadDays = Math.max(1, Number(req.query.leadDays || 7))
  const safetyDays = Math.max(0, Number(req.query.safetyDays || 7))
  const [products, sales, purchases, stockTransfers] = await Promise.all([
    store.all('products'), store.all('salesOrders'), store.all('purchaseOrders'), store.all('stockTransfers'),
  ])
  const now = new Date()
  const cutoff = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10)
  // 近90天各商品销量
  const sold = {}
  sales.filter((o) => (o.orderDate || '') >= cutoff && o.status !== '已取消')
    .forEach((o) => (o.items || []).forEach((it) => {
      const pid = it.productId || (products.find((p) => p.sku === it.sku)?.id)
      if (pid) sold[pid] = (sold[pid] || 0) + Number(it.qty || 0)
    }))
  // 在途：未完成采购单
  const inbound = {}
  purchases.filter((o) => !['已完成', '已取消'].includes(o.status))
    .forEach((o) => (o.items || []).forEach((it) => {
      const pid = it.productId || (products.find((p) => p.sku === it.sku)?.id)
      if (pid) inbound[pid] = (inbound[pid] || 0) + Number(it.qty || 0)
    }))
  const rows = products.map((p) => {
    const dailySales = (sold[p.id] || 0) / 90
    const stock = Number(p.stock || 0)
    const onWay = inbound[p.id] || 0
    const safe = Number(p.safeStock || 0)
    const need = Math.ceil(dailySales * (leadDays + safetyDays) + safe - stock - onWay)
    const coveredDays = dailySales > 0 ? Math.floor((stock + onWay) / dailySales) : 999
    return {
      productId: p.id, sku: p.sku, name: p.name,
      stock, safeStock: safe, onWay, dailySales: Math.round(dailySales * 100) / 100,
      coveredDays, suggestQty: Math.max(0, need),
      costPrice: Number(p.costPrice || 0),
      suggestAmount: Math.round(Math.max(0, need) * Number(p.costPrice || 0) * 100) / 100,
      urgency: coveredDays < leadDays ? '紧急' : coveredDays < leadDays + safetyDays ? '偏低' : '正常',
    }
  }).filter((r) => r.suggestQty > 0)
    .sort((a, b) => a.coveredDays - b.coveredDays)
  res.json({
    code: 200,
    data: {
      rows,
      sum: {
        items: rows.length,
        amount: Math.round(rows.reduce((s, r) => s + r.suggestAmount, 0) * 100) / 100,
        urgent: rows.filter((r) => r.urgency === '紧急').length,
      },
      params: { leadDays, safetyDays },
    },
  })
})

// 一键把补货建议转成采购草稿
app.post('/api/replenish/to-purchase', authRequired, adminRequired, async (req, res) => {
  const { items } = req.body || {}
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ code: 400, message: '请选择要补货的商品' })
  const products = await store.all('products')
  const orderItems = items.map((it) => {
    const p = products.find((x) => x.id === (it.productId || x.id))
    return {
      productId: it.productId, sku: it.sku || p?.sku || '', name: it.name || p?.name || '',
      qty: Number(it.qty || 0), price: Number(it.price || p?.costPrice || 0),
    }
  }).filter((it) => it.qty > 0)
  if (!orderItems.length) return res.status(400).json({ code: 400, message: '没有有效数量的补货项' })
  const rec = await store.create('purchaseOrders', {
    orderNo: 'PO-SUG-' + Date.now().toString().slice(-6),
    supplierName: req.body?.supplierName || '',
    items: orderItems,
    total: Math.round(orderItems.reduce((s, it) => s + it.qty * it.price, 0) * 100) / 100,
    status: '待审批',
    source: '智能补货建议',
  })
  res.json({ code: 200, message: `已生成采购草稿（${orderItems.length} 项）`, data: rec })
})

// ---------- RFM 客户价值分析 ----------
// R 最近下单距今天数，F 订单数，M 累计消费；各打 1-5 分，分 8 类
app.get('/api/rfm/analyze', authRequired, adminRequired, async (req, res) => {
  const [customers, sales] = await Promise.all([store.all('customers'), store.all('salesOrders')])
  const now = new Date()
  const stats = {}
  sales.filter((o) => o.status !== '已取消' && o.customerId).forEach((o) => {
    const s = stats[o.customerId] || (stats[o.customerId] = { last: '', count: 0, money: 0 })
    if ((o.orderDate || '') > s.last) s.last = o.orderDate || ''
    s.count++
    s.money += Number(o.total || 0)
  })
  const rows = customers.map((c) => {
    const s = stats[c.id] || { last: '', count: 0, money: 0 }
    const recencyDays = s.last ? Math.floor((now - new Date(s.last)) / 86400000) : 999
    const score = (v, breaks, asc) => {
      // asc=true: 值越小分越高（R）；asc=false: 值越大分越高（F/M）
      if (!v && v !== 0) return 1
      for (let i = 0; i < breaks.length; i++) {
        if (asc ? v <= breaks[i] : v >= breaks[i]) return 5 - i
      }
      return 1
    }
    const R = score(recencyDays, [30, 60, 90, 180], true)
    const F = score(s.count, [5, 3, 2, 1], false)
    const M = score(s.money, [10000, 5000, 1000, 100], false)
    const avg = (R + F + M) / 3
    let segment = ''
    if (R >= 4 && F >= 4) segment = '重要价值客户'
    else if (R < 4 && F >= 4) segment = '重要保持客户'
    else if (R >= 4 && F < 4) segment = '重要发展客户'
    else if (R < 4 && F < 4 && M >= 4) segment = '重要挽留客户'
    else if (avg >= 3.5) segment = '一般价值客户'
    else if (avg >= 2.5) segment = '一般保持客户'
    else if (avg >= 1.8) segment = '一般发展客户'
    else segment = '一般挽留客户'
    return {
      customerId: c.id, customerName: c.name,
      recencyDays: recencyDays === 999 ? '-' : recencyDays,
      frequency: s.count, monetary: Math.round(s.money * 100) / 100,
      R, F, M, segment,
    }
  })
  const groups = {}
  rows.forEach((r) => { groups[r.segment] = (groups[r.segment] || 0) + 1 })
  res.json({ code: 200, data: { rows, groups, total: rows.length } })
})

// ---------- 审批中心 ----------
// 提交审批（采购单/报销单/付款）
app.post('/api/approval/submit', authRequired, adminRequired, async (req, res) => {
  const { type, relatedId, relatedNo, amount, title } = req.body || {}
  if (!['采购单', '费用报销', '付款'].includes(type)) return res.status(400).json({ code: 400, message: '审批类型不支持' })
  const exists = (await store.all('approvals')).find((a) => a.relatedId === relatedId && a.status === '待审批')
  if (exists) return res.status(400).json({ code: 400, message: '该单据已有待审批申请' })
  const rec = await store.create('approvals', {
    type, relatedId: relatedId || '', relatedNo: relatedNo || '',
    title: title || `${type} ${relatedNo || ''}`,
    amount: Number(amount || 0),
    status: '待审批',
    applicant: req.user?.name || req.user?.username || '系统',
    approver: '', approvedAt: '', comment: '',
  })
  res.json({ code: 200, message: '审批已提交', data: rec })
})

// 审批：通过或驳回（通过触发业务动作）
app.post('/api/approval/decide/:id', authRequired, adminRequired, async (req, res) => {
  const { decision, comment } = req.body || {}
  if (!['通过', '驳回'].includes(decision)) return res.status(400).json({ code: 400, message: '决策必须是通过或驳回' })
  const rec = await store.find('approvals', req.params.id)
  if (!rec) return res.status(404).json({ code: 404, message: '审批单不存在' })
  if (rec.status !== '待审批') return res.status(400).json({ code: 400, message: '该审批已处理' })
  const patch = {
    status: decision, approver: req.user?.name || req.user?.username || '系统',
    approvedAt: new Date().toISOString().slice(0, 10), comment: comment || '',
  }
  // 通过时联动业务单据状态
  if (decision === '通过') {
    if (rec.type === '采购单' && rec.relatedId) await store.update('purchaseOrders', rec.relatedId, { status: '待入库' })
    if (rec.type === '费用报销' && rec.relatedId) await store.update('expenses', rec.relatedId, { status: '待付款' })
  }
  await store.update('approvals', rec.id, patch)
  res.json({ code: 200, message: `审批已${decision}` })
})

// ---------- 费用报销 ----------
app.post('/api/expense/submit-approval/:id', authRequired, adminRequired, async (req, res) => {
  const exp = await store.find('expenses', req.params.id)
  if (!exp) return res.status(404).json({ code: 404, message: '报销单不存在' })
  if (exp.status !== '草稿') return res.status(400).json({ code: 400, message: '只有草稿可提交审批' })
  const exists = (await store.all('approvals')).find((a) => a.relatedId === exp.id && a.status === '待审批')
  if (exists) return res.status(400).json({ code: 400, message: '已有待审批申请' })
  await store.create('approvals', {
    type: '费用报销', relatedId: exp.id, relatedNo: exp.expenseNo || '',
    title: `费用报销 ${exp.expenseNo || ''} ${exp.category || ''}`,
    amount: Number(exp.amount || 0), status: '待审批',
    applicant: req.user?.name || req.user?.username || '系统',
    approver: '', approvedAt: '', comment: '',
  })
  await store.update('expenses', exp.id, { status: '审批中' })
  res.json({ code: 200, message: '报销已提交审批' })
})

// 报销付款确认
app.post('/api/expense/pay/:id', authRequired, adminRequired, async (req, res) => {
  const exp = await store.find('expenses', req.params.id)
  if (!exp) return res.status(404).json({ code: 404, message: '报销单不存在' })
  if (exp.status !== '待付款') return res.status(400).json({ code: 400, message: '该报销单状态不是待付款' })
  await store.update('expenses', exp.id, { status: '已付款', paidAt: new Date().toISOString().slice(0, 10) })
  await store.create('payments', {
    direction: '付款', relatedNo: exp.expenseNo || '', party: exp.applicant || '员工报销',
    amount: Number(exp.amount || 0), method: '现金', date: new Date().toISOString().slice(0, 10),
    note: `费用报销 ${exp.category || ''}`, orderId: '',
  })
  res.json({ code: 200, message: '报销已付款，资金流水已记录' })
})

// ---------- 发票管理 ----------
app.post('/api/invoice/issue', authRequired, adminRequired, async (req, res) => {
  const inv = await store.find('invoices', req.body?.id)
  if (!inv) return res.status(404).json({ code: 404, message: '发票不存在' })
  if (inv.status === '已开票') return res.status(400).json({ code: 400, message: '该发票已开具' })
  await store.update('invoices', inv.id, { status: '已开票', issuedAt: new Date().toISOString().slice(0, 10) })
  res.json({ code: 200, message: '发票已标记开具' })
})

// ---------- 库位管理 ----------
// 从仓库生成库位（按区域/货架/层批量生成编码）
app.post('/api/location/generate', authRequired, adminRequired, async (req, res) => {
  const { warehouseId, warehouseName, zones, racksPerZone, levelsPerRack } = req.body || {}
  const zonesCount = Math.max(1, Number(zones || 1))
  const racks = Math.max(1, Number(racksPerZone || 2))
  const levels = Math.max(1, Number(levelsPerRack || 3))
  const existing = await store.all('locations')
  let added = 0
  for (let z = 1; z <= zonesCount; z++) {
    for (let r = 1; r <= racks; r++) {
      for (let l = 1; l <= levels; l++) {
        const code = `${String(z).padStart(2, '0')}-${String(r).padStart(2, '0')}-${String(l).padStart(2, '0')}`
        if (existing.some((x) => x.warehouseId === warehouseId && x.code === code)) continue
        await store.create('locations', {
          code, warehouseId: warehouseId || '', warehouseName: warehouseName || '',
          zone: `A${z}`, rack: r, level: l, status: '空闲',
        })
        added++
      }
    }
  }
  res.json({ code: 200, message: `已生成 ${added} 个库位`, data: { added } })
})

// ---------- 销售预测 ----------
// 基于近12个月月度趋势：线性回归 + 移动平均结合，预测未来3个月
app.get('/api/forecast/sales', authRequired, adminRequired, async (req, res) => {
  const [sales, products] = await Promise.all([store.all('salesOrders'), store.all('products')])
  const now = new Date()
  const months = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const actual = months.map((m) => ({
    month: m,
    revenue: Math.round(sales.filter((o) => (o.orderDate || '').startsWith(m) && o.status !== '已取消').reduce((s, o) => s + Number(o.total || 0), 0) * 100) / 100,
    orders: sales.filter((o) => (o.orderDate || '').startsWith(m) && o.status !== '已取消').length,
  }))
  const values = actual.map((a) => a.revenue)
  // 线性回归 y = a + b*x
  const n = values.length
  const xs = values.map((_, i) => i + 1)
  const mx = xs.reduce((s, x) => s + x, 0) / n
  const my = values.reduce((s, y) => s + y, 0) / n
  const b = xs.reduce((s, x, i) => s + (x - mx) * (values[i] - my), 0) / (xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1)
  const a = my - b * mx
  const ma3 = values.slice(-3).reduce((s, v) => s + v, 0) / 3
  const forecasts = [1, 2, 3].map((k) => {
    const d = new Date(now.getFullYear(), now.getMonth() + k, 1)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const linear = Math.max(0, a + b * (n + k))
    const predicted = Math.round((linear * 0.6 + ma3 * 0.4) * 100) / 100
    return { month, predicted, method: '线性回归60%+移动平均40%' }
  })
  const totalPredicted = Math.round(forecasts.reduce((s, f) => s + f.predicted, 0) * 100) / 100
  res.json({ code: 200, data: { actual, forecasts, totalPredicted, trend: b >= 0 ? '上升' : '下降' } })
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
