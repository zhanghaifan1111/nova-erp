import { AsyncLocalStorage } from 'node:async_hooks'

// 请求级租户上下文：让 store.all/find 自动按当前登录租户过滤数据。
// authRequired 在每个请求里 run({ tenantId, role }, next)，
// 非请求上下文（初始化/定时任务/注册）不进入 run，tenantId 为 undefined = 不过滤（看全部）。
export const tenantCtx = new AsyncLocalStorage()

// 这些集合是平台元数据/跨租户可见，不按租户隔离
export const TENANT_META_KEYS = new Set([
  'tenants', 'plans', 'subscriptions', 'users', 'apiKeys',
  'webhooks', 'webhookLogs', 'quotaLogs', 'auditLogs',
])

export function getTenantFilter() {
  const store = tenantCtx.getStore()
  // 平台管理员（无 tenantId）看全部
  if (!store || !store.tenantId) return null
  return store.tenantId
}

export function belongsToTenant(row, tenantId) {
  if (!tenantId) return true
  // 没打租户标记的老数据视为平台公共数据，租户不可见
  return row && row.tenantId === tenantId
}
