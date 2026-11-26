import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Button, Input, message, Spin, Alert } from 'antd'
import { UserOutlined, LockOutlined, ShopOutlined } from '@ant-design/icons'
import { api } from '../api'

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [company, setCompany] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!company || !username || !password) { setError('请填写全部信息'); return }
    if (password.length < 6) { setError('密码至少 6 位'); return }
    setLoading(true); setError('')
    try {
      const r: any = await api.saasRegister({ company, username, password, plan: 'free' })
      message.success(r.message)
      await login(username, password)
      navigate('/')
    } catch (e: any) {
      setError(e.message || '注册失败')
    } finally { setLoading(false) }
  }

  return (
    <div className="login-page">
      <div className="login-bg-shape shape1" />
      <div className="login-bg-shape shape2" />
      <div className="login-box">
        <div className="login-brand">
          <div className="login-logo">周</div>
          <div>
            <div className="login-title">开通你的 ERP</div>
            <div className="login-subtitle">免费版试用 30 天 · 无需信用卡</div>
          </div>
        </div>
        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
        <div className="login-field">
          <label>公司 / 店铺名称</label>
          <Input prefix={<ShopOutlined />} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="如：小王跨境贸易" size="large" />
        </div>
        <div className="login-field">
          <label>管理员账号</label>
          <Input prefix={<UserOutlined />} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用于登录的用户名" size="large" />
        </div>
        <div className="login-field">
          <label>密码</label>
          <Input.Password prefix={<LockOutlined />} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" size="large" onPressEnter={submit} />
        </div>
        <Button type="primary" block size="large" loading={loading} onClick={submit} style={{ marginTop: 8 }}>免费开通</Button>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="link" onClick={() => navigate('/login')}>已有账号？返回登录</Button>
        </div>
      </div>
    </div>
  )
}
