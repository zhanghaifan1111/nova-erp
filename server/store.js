import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')
const MONGO_URI = process.env.MONGODB_URI || ''
const MONGO_DB = process.env.MONGODB_DB || 'nova_erp'

let client = null
let mongoDb = null
let useMongo = false
let memoryDb = null

const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 10)
const today = () => new Date().toISOString().slice(0, 10)

export const COLLECTIONS = [
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
  'users',
]
const BUSINESS_COLLECTIONS = [
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

function emptyDb() {
  return Object.fromEntries(COLLECTIONS.map((k) => [k, []]))
}

function loadFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DB_FILE)) {
    const db = emptyDb()
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8')
    return db
  }
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
    // 兼容旧格式：补齐缺失集合
    COLLECTIONS.forEach((k) => { if (!db[k]) db[k] = [] })
    return db
  } catch {
    const db = emptyDb()
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8')
    return db
  }
}

function persistFile() {
  fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), 'utf8')
}

export async function initStore() {
  if (MONGO_URI) {
    try {
      client = new MongoClient(MONGO_URI)
      await client.connect()
      mongoDb = client.db(MONGO_DB)
      useMongo = true
      console.log('✅ MongoDB 已连接:', MONGO_DB)
      return
    } catch (e) {
      console.error('⚠️ MongoDB 连接失败，回退到本地文件模式:', e.message)
      useMongo = false
    }
  }
  useMongo = false
  memoryDb = loadFile()
  console.log('ℹ️ 使用本地文件模式（未配置 MONGODB_URI）')
}

export function isMongo() { return useMongo }

// 清空业务数据（保留账号），供管理员手动调用
export async function clearBusinessData() {
  const counts = {}
  if (useMongo) {
    for (const key of BUSINESS_COLLECTIONS) {
      const r = await mongoDb.collection(key).deleteMany({})
      counts[key] = r.deletedCount
    }
  } else {
    for (const key of BUSINESS_COLLECTIONS) {
      counts[key] = (memoryDb[key] || []).length
      memoryDb[key] = []
    }
    persistFile()
  }
  return counts
}

import { getTenantFilter, belongsToTenant, TENANT_META_KEYS } from './tenantContext.js'

// 按当前请求租户自动过滤。非请求上下文（初始化/定时任务）tenantId=null → 看全部。
function scoped(key, rows) {
  if (TENANT_META_KEYS.has(key)) return rows
  const tid = getTenantFilter()
  if (!tid) return rows
  return rows.filter((r) => belongsToTenant(r, tid))
}

export async function all(key) {
  let rows
  if (useMongo) rows = await mongoDb.collection(key).find({}, { projection: { _id: 0 } }).toArray()
  else rows = memoryDb[key] || []
  return scoped(key, rows)
}

export async function find(key, id) {
  let row
  if (useMongo) row = await mongoDb.collection(key).findOne({ id }, { projection: { _id: 0 } })
  else row = (memoryDb[key] || []).find((r) => r.id === id)
  if (!row || TENANT_META_KEYS.has(key)) return row || null
  return belongsToTenant(row, getTenantFilter()) ? row : null
}

export async function findBy(key, field, value) {
  if (useMongo) return mongoDb.collection(key).findOne({ [field]: value }, { projection: { _id: 0 } })
  return (memoryDb[key] || []).find((r) => r[field] === value)
}

export async function create(key, record) {
  const tid = TENANT_META_KEYS.has(key) ? null : getTenantFilter()
  // 租户上下文里创建业务数据时自动打租户标记，确保数据归属正确
  const rec = { id: uid(key[0]), ...record, ...(tid && !record.tenantId ? { tenantId: tid } : {}), createdAt: record.createdAt || today() }
  if (useMongo) { await mongoDb.collection(key).insertOne(rec); return rec }
  memoryDb[key] = memoryDb[key] || []
  memoryDb[key].unshift(rec)
  persistFile()
  return rec
}

export async function update(key, id, patch) {
  const tid = TENANT_META_KEYS.has(key) ? null : getTenantFilter()
  if (tid) {
    const owner = (memoryDb[key] || []).find((r) => r.id === id)
    if (owner && !belongsToTenant(owner, tid)) return null // 跨租户写拒绝
  }
  if (useMongo) {
    const filter = tid ? { id, tenantId: tid } : { id }
    await mongoDb.collection(key).updateOne(filter, { $set: patch })
    return mongoDb.collection(key).findOne({ id }, { projection: { _id: 0 } })
  }
  const rec = (memoryDb[key] || []).find((r) => r.id === id)
  if (!rec || (tid && !belongsToTenant(rec, tid))) return null
  Object.assign(rec, patch)
  persistFile()
  return rec
}

export async function remove(key, id) {
  const tid = TENANT_META_KEYS.has(key) ? null : getTenantFilter()
  if (useMongo) {
    const filter = tid ? { id, tenantId: tid } : { id }
    const r = await mongoDb.collection(key).deleteOne(filter)
    return r.deletedCount > 0
  }
  const rec = (memoryDb[key] || []).find((r) => r.id === id)
  if (!rec || (tid && !belongsToTenant(rec, tid))) return false
  memoryDb[key] = memoryDb[key].filter((r) => r.id !== id)
  persistFile()
  return true
}

export { uid, today }
