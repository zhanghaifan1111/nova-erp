// 统一 API 客户端
const BASE = '/api'

async function request<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (json.code !== 200) throw new Error(json.message || '请求失败')
  return json as T
}

export const api = {
  list: (key: string, params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : ''
    return request<{ code: number; data: any[]; total: number }>(`/${key}${qs}`)
  },
  get: (key: string, id: string) => request(`/${key}/${id}`),
  create: (key: string, body: any) => request(`/${key}`, { method: 'POST', body: JSON.stringify(body) }),
  update: (key: string, id: string, body: any) => request(`/${key}/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (key: string, id: string) => request(`/${key}/${id}`, { method: 'DELETE' }),
  dashboard: () => request('/dashboard'),
  health: () => request('/health'),
}

export const money = (n: number) =>
  '¥' + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
