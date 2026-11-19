import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 10)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const rint = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pad = (n) => String(n).padStart(2, '0')

function dateMonthsAgo(m) {
  const d = new Date()
  d.setMonth(d.getMonth() - m)
  d.setDate(rint(1, 28))
  return d.toISOString().slice(0, 10)
}

function buildSeed() {
  const categories = ['数码配件', '家居用品', '办公设备', '户外运动']
  const productNames = [
    ['无线蓝牙耳机 Pro', '数码配件', '台', 89, 199],
    ['65W 氮化镓充电器', '数码配件', '个', 45, 129],
    ['磁吸移动电源 10000mAh', '数码配件', '个', 62, 159],
    ['人体工学鼠标垫', '办公设备', '张', 18, 59],
    ['多功能桌面收纳架', '家居用品', '个', 32, 99],
    ['折叠旅行保温杯', '户外运动', '个', 28, 89],
    ['降噪耳塞套装', '数码配件', '套', 22, 79],
    ['LED 护眼台灯', '家居用品', '台', 76, 219],
    ['便携蓝牙音箱', '数码配件', '台', 95, 259],
    ['A4 复印纸 70g', '办公设备', '包', 16, 42],
    ['登山速干毛巾', '户外运动', '条', 12, 39],
    ['无线机械键盘', '办公设备', '把', 168, 399],
  ]
  const products = productNames.map((p, i) => ({
    id: uid('p'),
    sku: 'SKU-' + String(1001 + i),
    name: p[0],
    category: p[1],
    spec: pick(['标准版', '升级版', '旗舰版', '基础款']),
    unit: p[2],
    costPrice: p[3],
    salePrice: p[4],
    stock: i % 4 === 2 ? rint(2, 8) : rint(30, 260),
    safeStock: 20,
    status: '在售',
    createdAt: dateMonthsAgo(rint(1, 10)),
  }))

  const customerNames = ['星海科技', '云途贸易', '优选生活馆', '创想数码', '北辰商贸', '橙心优选', '远景电商', '南风小店']
  const contacts = ['张伟', '李娜', '王强', '陈静', '刘洋', '赵敏']
  const customers = customerNames.map((n, i) => ({
    id: uid('c'),
    code: 'CUS-' + String(2001 + i),
    name: n,
    contact: pick(contacts),
    phone: '13' + rint(100000000, 999999999),
    email: 'sales' + (i + 1) + '@example.com',
    address: pick(['深圳市南山区', '杭州市余杭区', '上海市浦东新区', '广州市天河区', '成都市高新区']),
    level: pick(['VIP', '普通', '重点']),
    status: '正常',
    createdAt: dateMonthsAgo(rint(1, 12)),
  }))

  const supplierNames = ['华芯电子', '铭远实业', '锦程家居', '跃动户外', '文源办公']
  const suppliers = supplierNames.map((n, i) => ({
    id: uid('s'),
    code: 'SUP-' + String(3001 + i),
    name: n,
    contact: pick(contacts),
    phone: '15' + rint(100000000, 999999999),
    email: 'supply' + (i + 1) + '@example.com',
    address: pick(['东莞市长安镇', '义乌市福田区', '苏州市工业园区', '宁波市鄞州区']),
    status: '合作中',
    createdAt: dateMonthsAgo(rint(2, 12)),
  }))

  const statuses = ['已完成', '已发货', '待发货', '待付款', '已取消']
  const statusWeight = ['已完成', '已完成', '已完成', '已发货', '已发货', '待发货', '待付款', '已取消']
  const salesOrders = []
  let salesSeq = 1
  for (let i = 0; i < 46; i++) {
    const monthAgo = rint(0, 11)
    const cust = pick(customers)
    const itemCount = rint(1, 4)
    const items = []
    let total = 0
    for (let j = 0; j < itemCount; j++) {
      const prod = pick(products)
      const qty = rint(1, 12)
      const price = prod.salePrice
      total += qty * price
      items.push({ productId: prod.id, sku: prod.sku, name: prod.name, qty, price })
    }
    salesOrders.push({
      id: uid('so'),
      orderNo: 'SO' + new Date().getFullYear() + String(salesSeq++).padStart(5, '0'),
      customerId: cust.id,
      customerName: cust.name,
      items,
      total: Math.round(total * 100) / 100,
      status: pick(statusWeight),
      orderDate: dateMonthsAgo(monthAgo),
      createdAt: dateMonthsAgo(monthAgo),
    })
  }

  const purchaseOrders = []
  let poSeq = 1
  for (let i = 0; i < 24; i++) {
    const sup = pick(suppliers)
    const itemCount = rint(1, 3)
    const items = []
    let total = 0
    for (let j = 0; j < itemCount; j++) {
      const prod = pick(products)
      const qty = rint(10, 80)
      const price = prod.costPrice
      total += qty * price
      items.push({ productId: prod.id, sku: prod.sku, name: prod.name, qty, price })
    }
    purchaseOrders.push({
      id: uid('po'),
      orderNo: 'PO' + new Date().getFullYear() + String(poSeq++).padStart(5, '0'),
      supplierId: sup.id,
      supplierName: sup.name,
      items,
      total: Math.round(total * 100) / 100,
      status: pick(['已完成', '已完成', '待收货', '待付款']),
      orderDate: dateMonthsAgo(rint(0, 11)),
      createdAt: dateMonthsAgo(rint(0, 11)),
    })
  }

  const stockLogs = []
  for (let i = 0; i < 30; i++) {
    const prod = pick(products)
    const isIn = Math.random() > 0.45
    const qty = rint(5, 50)
    stockLogs.push({
      id: uid('sl'),
      type: isIn ? '入库' : '出库',
      productId: prod.id,
      sku: prod.sku,
      name: prod.name,
      qty,
      relatedNo: isIn ? pick(purchaseOrders).orderNo : pick(salesOrders).orderNo,
      note: isIn ? '采购入库' : '销售出库',
      createdAt: dateMonthsAgo(rint(0, 3)),
    })
  }

  // 让采购支出约为有效销售的 62%，保证毛利率健康真实
  const salesTotal = salesOrders.filter((o) => o.status !== '已取消').reduce((s, o) => s + o.total, 0)
  const poTotal = purchaseOrders.filter((o) => o.status !== '已取消').reduce((s, o) => s + o.total, 0)
  if (poTotal > 0) {
    const ratio = (salesTotal * 0.62) / poTotal
    purchaseOrders.forEach((o) => {
      o.items.forEach((it) => { it.price = Math.round(it.price * ratio * 100) / 100 })
      o.total = Math.round(o.items.reduce((s, it) => s + it.qty * it.price, 0) * 100) / 100
    })
  }

  return { products, customers, suppliers, salesOrders, purchaseOrders, stockLogs }
}

function load() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DB_FILE)) {
    const db = buildSeed()
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8')
    return db
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  } catch {
    const db = buildSeed()
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8')
    return db
  }
}

let db = load()

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8')
}

export function all(key) {
  return db[key] || []
}

export function find(key, id) {
  return (db[key] || []).find((r) => r.id === id)
}

export function create(key, record) {
  const rec = { id: uid(key[0]), ...record, createdAt: new Date().toISOString().slice(0, 10) }
  db[key] = db[key] || []
  db[key].unshift(rec)
  persist()
  return rec
}

export function update(key, id, patch) {
  const rec = find(key, id)
  if (!rec) return null
  Object.assign(rec, patch)
  persist()
  return rec
}

export function remove(key, id) {
  if (!find(key, id)) return false
  db[key] = db[key].filter((r) => r.id !== id)
  persist()
  return true
}

export { uid, pad }
