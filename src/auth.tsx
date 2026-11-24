import React, { createContext, useContext, useState, useEffect } from 'react'
import { api, setToken } from './api'

type User = { id: string; username: string; name: string; role: 'admin' | 'customer'; roleKey?: string; customerId?: string }
type AuthCtx = {
  user: User | null
  loading: boolean
  login: (u: string, p: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
}
const Ctx = createContext<AuthCtx>({ user: null, loading: true, login: async () => {}, logout: () => {}, isAdmin: false })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const check = async () => {
      if (!localStorage.getItem('nova-token')) { setLoading(false); return }
      try { const r = await api.me(); setUser(r.data) } catch { setToken('') }
      finally { setLoading(false) }
    }
    check()
    const onUnauth = () => setUser(null)
    window.addEventListener('nova-unauthorized', onUnauth)
    return () => window.removeEventListener('nova-unauthorized', onUnauth)
  }, [])

  const login = async (username: string, password: string) => {
    const r = await api.login(username, password)
    setToken(r.data.token)
    setUser(r.data.user)
  }
  const logout = () => { setToken(''); setUser(null) }

  return (
    <Ctx.Provider value={{ user, loading, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </Ctx.Provider>
  )
}
