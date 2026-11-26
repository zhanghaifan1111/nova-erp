// 统一 API 客户端（自动携带登录令牌）
const BASE = '/api'

function getToken() { return localStorage.getItem('nova-token') || '' }
export function setToken(token: string) { token ? localStorage.setItem('nova-token', token) : localStorage.removeItem('nova-token') }

export class ApiError extends Error {
  code: number
  constructor(code: number, message: string) { super(message); this.code = code }
}

async function request<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: getToken() ? `Bearer ${getToken()}` : '',
      ...(options?.headers || {}),
    },
  })
  let json: any
  try { json = await res.json() } catch { throw new ApiError(res.status, '服务器返回异常') }
  if (json.code !== 200) {
    if (json.code === 401) { setToken(''); window.dispatchEvent(new Event('nova-unauthorized')) }
    throw new ApiError(json.code, json.message || '请求失败')
  }
  return json as T
}

export const api = {
  login: (username: string, password: string) =>
    request<{ code: number; data: { token: string; user: any } }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request<{ code: number; data: any }>('/auth/me'),
  changePassword: (oldPassword: string, newPassword: string) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }),
  listUsers: () => request<{ code: number; data: any[] }>('/users'),
  createUser: (body: any) => request('/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  removeUser: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
  listCustomerAccounts: () => request<{ code: number; data: any[] }>('/customer-accounts'),

  list: (key: string, params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : ''
    return request<{ code: number; data: any[]; total: number }>(`/${key}${qs}`)
  },
  get: (key: string, id: string) => request(`/${key}/${id}`),
  create: (key: string, body: any) => request(`/${key}`, { method: 'POST', body: JSON.stringify(body) }),
  update: (key: string, id: string, body: any) => request(`/${key}/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (key: string, id: string) => request(`/${key}/${id}`, { method: 'DELETE' }),
  dashboard: () => request('/dashboard'),
  profit: () => request<{ code: number; data: { rows: any[]; sum: any } }>('/profit'),
  pricing: (body: any) => request('/pricing', { method: 'POST', body: JSON.stringify(body) }),
  collect: (body: any) => request('/sourcing/collect', { method: 'POST', body: JSON.stringify(body) }),
  publish: (body: any) => request('/listings/publish', { method: 'POST', body: JSON.stringify(body) }),
  syncImport: (body: any) => request('/sync/import', { method: 'POST', body: JSON.stringify(body) }),
  syncToSales: (id: string) => request(`/sync/to-sales/${id}`, { method: 'POST' }),
  replyMessage: (id: string, content: string) => request(`/messages/${id}/reply`, { method: 'POST', body: JSON.stringify({ content }) }),
  pushOrder: (id: string, endpointId?: string) => request('/push/order/' + id, { method: 'POST', body: JSON.stringify({ endpointId }) }),
  pushOrders: (orderIds: string[], endpointId?: string) => request('/push/orders', { method: 'POST', body: JSON.stringify({ orderIds, endpointId }) }),
  pushRetry: (logId: string) => request('/push/retry/' + logId, { method: 'POST' }),
  pushTest: (endpointId?: string) => request('/push/test', { method: 'POST', body: JSON.stringify({ endpointId }) }),
  pushPreview: (id: string) => request('/push/preview/' + id),
  genCartons: (orderId: string) => request('/label/cartons/from-order/' + orderId, { method: 'POST' }),
  genWaybill: (orderId: string) => request('/label/waybills/from-order/' + orderId, { method: 'POST' }),
  receiptFromPurchase: (id: string) => request('/stock/receipt-from-purchase/' + id, { method: 'POST' }),
  receiptConfirm: (id: string) => request('/stock/receipt-confirm/' + id, { method: 'POST' }),
  checkCreate: (body: any) => request('/stock/check-create', { method: 'POST', body: JSON.stringify(body) }),
  checkUpdate: (id: string, actual: Record<string, number>) => request('/stock/check-update/' + id, { method: 'POST', body: JSON.stringify({ actual }) }),
  checkConfirm: (id: string) => request('/stock/check-confirm/' + id, { method: 'POST' }),
  returnFromOrder: (id: string, body?: any) => request('/stock/return-from-order/' + id, { method: 'POST', body: JSON.stringify(body || {}) }),
  returnConfirm: (id: string) => request('/stock/return-confirm/' + id, { method: 'POST' }),
  importRows: (key: string, rows: any[]) => request('/import', { method: 'POST', body: JSON.stringify({ key, rows }) }),
  exportRows: (key: string) => request<{ code: number; data: any[] }>('/export/' + key),
  paymentsLedger: () => request<{ code: number; data: { rows: any[]; sum: any } }>('/payment-ledger'),
  paymentRecord: (body: any) => request('/payment-record', { method: 'POST', body: JSON.stringify(body) }),
  followUp: (body: any) => request('/crm/follow-up', { method: 'POST', body: JSON.stringify(body) }),
  pickFromOrder: (orderId: string) => request('/wms/pick-from-order/' + orderId, { method: 'POST' }),
  pickConfirm: (id: string) => request('/wms/pick-confirm/' + id, { method: 'POST' }),
  fxConvert: (currency: string, amount: number) => request('/fx/convert', { method: 'POST', body: JSON.stringify({ currency, amount }) }),
  replenishSuggest: (leadDays?: number, safetyDays?: number) => request(`/replenish/suggest?leadDays=${leadDays || 7}&safetyDays=${safetyDays ?? 7}`),
  replenishToPurchase: (items: any[], supplierName?: string) => request('/replenish/to-purchase', { method: 'POST', body: JSON.stringify({ items, supplierName }) }),
  rfmAnalyze: () => request('/rfm/analyze'),
  approvalSubmit: (body: any) => request('/approval/submit', { method: 'POST', body: JSON.stringify(body) }),
  approvalDecide: (id: string, decision: string, comment?: string) => request('/approval/decide/' + id, { method: 'POST', body: JSON.stringify({ decision, comment }) }),
  expenseSubmitApproval: (id: string) => request('/expense/submit-approval/' + id, { method: 'POST' }),
  expensePay: (id: string) => request('/expense/pay/' + id, { method: 'POST' }),
  invoiceIssue: (id: string) => request('/invoice/issue', { method: 'POST', body: JSON.stringify({ id }) }),
  locationGenerate: (body: any) => request('/location/generate', { method: 'POST', body: JSON.stringify(body) }),
  forecastSales: () => request('/forecast/sales'),
  glInitAccounts: () => request('/gl/init-accounts', { method: 'POST' }),
  glVoucher: (body: any) => request('/gl/voucher', { method: 'POST', body: JSON.stringify(body) }),
  glBalance: () => request('/gl/balance'),
  settleReconcile: (rows: any[]) => request('/settle/reconcile', { method: 'POST', body: JSON.stringify({ rows }) }),
  kpiAttainment: (month?: string) => request('/kpi/attainment?month=' + (month || new Date().toISOString().slice(0, 7))),
  alertsAll: () => request('/alerts/all'),
  inventoryAging: () => request('/inventory/aging'),
  ruleRun: (id: string) => request('/rule/run/' + id, { method: 'POST' }),
  ruleRunAll: () => request('/rule/run-all', { method: 'POST' }),
  notificationRead: (id: string) => request('/notification/read/' + id, { method: 'POST' }),
  notificationReadAll: () => request('/notification/read-all', { method: 'POST' }),
  rbacInitRoles: () => request('/rbac/init-roles', { method: 'POST' }),
  portalSummary: () => request('/portal/summary'),
  bomCalc: (bundleId: string, qty: number) => request('/bom/calc', { method: 'POST', body: JSON.stringify({ bundleId, qty }) }),
  afterSalesProcess: (id: string, status: string, solution?: string) => request('/after-sales/process/' + id, { method: 'POST', body: JSON.stringify({ status, solution }) }),
  rfqAward: (id: string, quoteId: string) => request('/rfq/award/' + id, { method: 'POST', body: JSON.stringify({ quoteId }) }),
  rfqCompare: (id: string) => request('/rfq/compare/' + id),
  qcJudge: (id: string, result: string, passQty?: number, note?: string) => request('/qc/judge/' + id, { method: 'POST', body: JSON.stringify({ result, passQty, note }) }),
  batchTrace: (batchNo: string) => request('/batch/trace/' + batchNo),
  reportRun: (body: any) => request('/report/run', { method: 'POST', body: JSON.stringify(body) }),
  adsRoi: () => request('/ads/roi'),
  transferSuggest: () => request('/transfer/suggest'),
  performanceTeam: () => request('/performance/team'),
  funnelStages: () => request('/funnel/stages'),
  titleCheck: (title: string) => request('/copy/title-check', { method: 'POST', body: JSON.stringify({ title }) }),
  trackingAddEvent: (id: string, body: any) => request('/tracking/add-event/' + id, { method: 'POST', body: JSON.stringify(body) }),
  trackingExceptions: (days?: number) => request('/tracking/exceptions?days=' + (days || 7)),
  stockLock: (sku: string, qty: number, orderNo?: string) => request('/stock/lock', { method: 'POST', body: JSON.stringify({ sku, qty, orderNo }) }),
  stockUnlock: (id: string) => request('/stock/unlock/' + id, { method: 'POST' }),
  stockAvailability: () => request('/stock/availability'),
  pricingSuggest: (body: any) => request('/pricing/suggest', { method: 'POST', body: JSON.stringify(body) }),
  backupExport: () => request('/backup/export'),
  backupRestore: (data: any, mode?: string) => request('/backup/restore', { method: 'POST', body: JSON.stringify({ data, mode: mode || 'skip' }) }),
  systemHealth: () => request('/system/health'),
  couponValidate: (code: string, amount: number) => request('/coupon/validate', { method: 'POST', body: JSON.stringify({ code, amount }) }),
  aiDescription: (body: any) => request('/ai/description', { method: 'POST', body: JSON.stringify(body) }),
  aiTranslate: (text: string, from: string, to: string) => request('/ai/translate', { method: 'POST', body: JSON.stringify({ text, from, to }) }),
  aiCompliance: (text: string, platform: string) => request('/ai/compliance', { method: 'POST', body: JSON.stringify({ text, platform }) }),
  csAutoReply: (message: string) => request('/cs/auto-reply', { method: 'POST', body: JSON.stringify({ message }) }),
  researchScore: (rows: any[]) => request('/research/score', { method: 'POST', body: JSON.stringify({ rows }) }),
  migrateProducts: (body: any) => request('/migrate/products', { method: 'POST', body: JSON.stringify(body) }),
  waveCreate: (body: any) => request('/wave/create', { method: 'POST', body: JSON.stringify(body) }),
  waveShip: (id: string) => request('/wave/ship/' + id, { method: 'POST' }),
  orderRuleEvaluate: (orderNo: string) => request('/order-rule/evaluate', { method: 'POST', body: JSON.stringify({ orderNo }) }),
  orderRuleBatch: () => request('/order-rule/batch', { method: 'POST' }),
  inventorySyncApply: (ruleId: string) => request('/inventory-sync/apply', { method: 'POST', body: JSON.stringify({ ruleId }) }),
  scheduleProcess: () => request('/schedule/process'),
  saasMe: () => request('/saas/me'),
  saasRegister: (body: any) => request('/saas/register', { method: 'POST', body: JSON.stringify(body) }),
  saasSubscribe: (plan: string) => request('/saas/subscribe', { method: 'POST', body: JSON.stringify({ plan }) }),
  createApiKey: (name: string) => request('/saas/apikey', { method: 'POST', body: JSON.stringify({ name }) }),
  platformAuthTest: (body: any) => request('/platform-auth/test', { method: 'POST', body: JSON.stringify(body) }),
  createWebhook: (body: any) => request('/saas/webhook', { method: 'POST', body: JSON.stringify(body) }),
  webhookTest: (id: string) => request('/saas/webhook/test/' + id, { method: 'POST' }),
  health: () => request('/health'),
}

// 全局显示币种设置：存 localStorage，设置页切换后所有金额显示自动换算
export type CurrencySetting = { code: string; symbol: string; rate: number } // rate = 1 外币兑多少人民币
export const getDisplayCurrency = (): CurrencySetting => {
  try {
    const raw = localStorage.getItem('nova-display-currency')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { code: 'CNY', symbol: '¥', rate: 1 }
}
export const setDisplayCurrency = (c: CurrencySetting) => localStorage.setItem('nova-display-currency', JSON.stringify(c))

export const money = (n: number) => {
  const cur = getDisplayCurrency()
  const value = cur.code === 'CNY' ? Number(n || 0) : Number(n || 0) / (cur.rate || 1)
  return cur.symbol + value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
