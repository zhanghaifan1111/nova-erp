import React, { useState } from 'react'
import { useAuth } from '../auth'
import { Button, Input, Checkbox, message, Spin } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!username || !password) { setError('请输入账号和密码'); return }
    setLoading(true); setError('')
    try {
      await login(username, password)
      message.success('登录成功')
    } catch (e: any) {
      setError(e.message || '登录失败')
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
            <div className="login-title">周桂祥的ERP</div>
            <div className="login-subtitle">智能企业管理平台</div>
          </div>
        </div>
        <div className="login-divider" />
        <div className="login-welcome">欢迎回来</div>
        <div className="login-hint">登录您的账号以继续访问管理系统</div>

        <div className="login-field">
          <label>账号</label>
          <Input
            size="large"
            prefix={<UserOutlined style={{ color: '#9aa3b8' }} />}
            placeholder="请输入账号"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onPressEnter={submit}
          />
        </div>
        <div className="login-field">
          <label>密码</label>
          <Input.Password
            size="large"
            prefix={<LockOutlined style={{ color: '#9aa3b8' }} />}
            placeholder="请输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={submit}
          />
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="login-row">
          <Checkbox defaultChecked>记住我</Checkbox>
          <a className="login-link">忘记密码？</a>
        </div>
        <Button type="primary" size="large" block loading={loading} onClick={submit} className="login-btn">
          登 录
        </Button>
      </div>
    </div>
  )
}
