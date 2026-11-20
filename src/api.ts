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
  health: () => request('/health'),
}

export const money = (n: number) =>
  '¥' + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
