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

export const COLLECTIONS = ['products', 'customers', 'suppliers', 'salesOrders', 'purchaseOrders', 'stockLogs', 'users']
const BUSINESS_COLLECTIONS = ['products', 'customers', 'suppliers', 'salesOrders', 'purchaseOrders', 'stockLogs']

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

export async function all(key) {
  if (useMongo) return mongoDb.collection(key).find({}, { projection: { _id: 0 } }).toArray()
  return memoryDb[key] || []
}

export async function find(key, id) {
  if (useMongo) return mongoDb.collection(key).findOne({ id }, { projection: { _id: 0 } })
  return (memoryDb[key] || []).find((r) => r.id === id)
}

export async function findBy(key, field, value) {
  if (useMongo) return mongoDb.collection(key).findOne({ [field]: value }, { projection: { _id: 0 } })
  return (memoryDb[key] || []).find((r) => r[field] === value)
}

export async function create(key, record) {
  const rec = { id: uid(key[0]), ...record, createdAt: record.createdAt || today() }
  if (useMongo) { await mongoDb.collection(key).insertOne(rec); return rec }
  memoryDb[key] = memoryDb[key] || []
  memoryDb[key].unshift(rec)
  persistFile()
  return rec
}

export async function update(key, id, patch) {
  if (useMongo) {
    await mongoDb.collection(key).updateOne({ id }, { $set: patch })
    return mongoDb.collection(key).findOne({ id }, { projection: { _id: 0 } })
  }
  const rec = (memoryDb[key] || []).find((r) => r.id === id)
  if (!rec) return null
  Object.assign(rec, patch)
  persistFile()
  return rec
}

export async function remove(key, id) {
  if (useMongo) { const r = await mongoDb.collection(key).deleteOne({ id }); return r.deletedCount > 0 }
  if (!(memoryDb[key] || []).some((r) => r.id === id)) return false
  memoryDb[key] = memoryDb[key].filter((r) => r.id !== id)
  persistFile()
  return true
}

export { uid, today }
