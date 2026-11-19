import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Avatar, Tag, Tooltip, theme as antdTheme, Dropdown } from 'antd'
import {
  DashboardOutlined, AppstoreOutlined, DatabaseOutlined, ShoppingCartOutlined,
  ShoppingOutlined, TeamOutlined, TruckOutlined, BarChartOutlined,
  MoonOutlined, SunOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  BellOutlined, SettingOutlined, SafetyCertificateOutlined, UserOutlined,
  LogoutOutlined, KeyOutlined, DownOutlined,
} from '@ant-design/icons'
import { useAppTheme } from '../theme'
import { useAuth } from '../auth'
import { api } from '../api'

const { Header, Sider, Content } = Layout

const adminMenu = [
  { key: '/', icon: <DashboardOutlined />, label: '经营总览' },
  { key: '/products', icon: <AppstoreOutlined />, label: '商品管理' },
  { key: '/inventory', icon: <DatabaseOutlined />, label: '库存管理' },
  { key: '/sales', icon: <ShoppingCartOutlined />, label: '销售订单' },
  { key: '/purchase', icon: <ShoppingOutlined />, label: '采购订单' },
  { type: 'divider' as const },
  { key: '/customers', icon: <TeamOutlined />, label: '客户管理' },
  { key: '/suppliers', icon: <TruckOutlined />, label: '供应商管理' },
  { key: '/finance', icon: <BarChartOutlined />, label: '财务报表' },
  { type: 'divider' as const },
  { key: '/accounts', icon: <SafetyCertificateOutlined />, label: '账号管理' },
  { key: '/customer-accounts', icon: <UserOutlined />, label: '客户账号管理' },
]

const customerMenu = [
  { key: '/', icon: <DashboardOutlined />, label: '经营概览' },
  { key: '/sales', icon: <ShoppingCartOutlined />, label: '我的订单' },
  { key: '/customers', icon: <TeamOutlined />, label: '我的资料' },
]

const titleMap: Record<string, string> = {
  '/': '经营总览', '/products': '商品管理', '/inventory': '库存管理',
  '/sales': '销售订单', '/purchase': '采购订单', '/customers': '客户管理',
  '/suppliers': '供应商管理', '/finance': '财务报表', '/accounts': '账号管理',
  '/customer-accounts': '客户账号管理', '/profile': '账号设置',
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { dark, toggle } = useAppTheme()
  const { token } = antdTheme.useToken()
  const { user, logout, isAdmin } = useAuth()

  const menuItems = isAdmin ? adminMenu : customerMenu
  const title = titleMap[location.pathname] || (location.pathname === '/profile' ? '账号设置' : 'Nova ERP')

  const onLogout = () => { logout(); navigate('/login') }

  const userMenu = {
    items: [
      { key: 'profile', icon: <KeyOutlined />, label: '修改密码' },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
    ],
    onClick: ({ key }: any) => key === 'profile' ? navigate('/profile') : onLogout(),
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} width={236} style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 20 }}>
        <div className="brand">
          <div className="brand-logo">N</div>
          {!collapsed && (
            <div className="brand-text">
              <div className="brand-name">Nova ERP</div>
              <div className="brand-sub">智能企业管理平台</div>
            </div>
          )}
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems}
          onClick={({ key }) => navigate(key)} style={{ marginTop: 8, background: 'transparent', borderInlineEnd: 'none' }} />
        {!collapsed && (
          <div className="sider-footer">
            <div className="sider-tip-card">
              <div className="sider-tip-title">{isAdmin ? '管理员' : '客户账号'}</div>
              <div className="sider-tip-desc">{isAdmin ? '数据本地持久化 · 全流程管理' : '仅可查看您自己的订单与资料'}</div>
            </div>
          </div>
        )}
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 236, transition: 'margin-left .2s' }}>
        <Header className="app-header" style={{ background: token.colorBgContainer }}>
          <div className="header-left">
            <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)} style={{ fontSize: 18 }} />
            <span className="header-title">{title}</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>v2.0</Tag>
          </div>
          <div className="header-right">
            <Tooltip title={dark ? '切换浅色' : '切换深色'}>
              <Button type="text" icon={dark ? <SunOutlined /> : <MoonOutlined />} onClick={toggle} />
            </Tooltip>
            <Tooltip title="通知"><Button type="text" icon={<BellOutlined />} /></Tooltip>
            <Dropdown menu={userMenu} placement="bottomRight">
              <div className="avatar-wrap" style={{ cursor: 'pointer' }}>
                <Avatar style={{ background: 'linear-gradient(135deg,#4f6ef7,#7c5cff)' }}>{user?.name?.[0] || 'U'}</Avatar>
                <span className="avatar-name">{user?.name || user?.username}</span>
                <Tag color={isAdmin ? 'purple' : 'blue'} style={{ marginLeft: 4 }}>{isAdmin ? '管理员' : '客户'}</Tag>
                <DownOutlined style={{ fontSize: 10, color: '#999' }} />
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className="app-content"><Outlet /></Content>
      </Layout>
    </Layout>
  )
}
