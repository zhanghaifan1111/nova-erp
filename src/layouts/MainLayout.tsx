import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Avatar, Tag, Tooltip, theme as antdTheme, Dropdown } from 'antd'
import {
  DashboardOutlined, AppstoreOutlined, DatabaseOutlined, ShoppingCartOutlined,
  ShoppingOutlined, TeamOutlined, TruckOutlined, BarChartOutlined,
  MoonOutlined, SunOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  BellOutlined, SettingOutlined, SafetyCertificateOutlined, UserOutlined,
  LogoutOutlined, KeyOutlined, DownOutlined, GlobalOutlined,
} from '@ant-design/icons'
import { useAppTheme } from '../theme'
import { useAuth } from '../auth'
import { api } from '../api'

const { Header, Sider, Content } = Layout

const adminMenu = [
  { key: '/', icon: <DashboardOutlined />, label: '经营总览' },
  {
    key: 'grp-product', icon: <AppstoreOutlined />, label: '商品与库存',
    children: [
      { key: '/products', label: '商品管理' },
      { key: '/sourcing', label: '商品采集箱' },
      { key: '/listings', label: '刊登管理' },
      { key: '/inventory', label: '库存管理' },
      { key: '/warehouses', label: '仓库管理' },
      { key: '/stock-transfers', label: '库存调拨' },
    ],
  },
  {
    key: 'grp-order', icon: <ShoppingCartOutlined />, label: '订单与发货',
    children: [
      { key: '/sales', label: '销售订单' },
      { key: '/purchase', label: '采购订单' },
      { key: '/shipments', label: '打单发货' },
      { key: '/order-sync', label: '多平台订单同步' },
    ],
  },
  {
    key: 'grp-cross', icon: <GlobalOutlined />, label: '跨境电商',
    children: [
      { key: '/shops', label: '店铺管理' },
      { key: '/shipping-methods', label: '物流渠道' },
      { key: '/shipping-templates', label: '运费模板' },
      { key: '/messages', label: '客户消息聚合' },
    ],
  },
  {
    key: 'grp-finance', icon: <BarChartOutlined />, label: '财务与定价',
    children: [
      { key: '/finance', label: '财务报表' },
      { key: '/profit', label: '利润核算' },
      { key: '/pricing', label: '定价计算器' },
    ],
  },
  { type: 'divider' as const },
  { key: '/customers', icon: <TeamOutlined />, label: '客户管理' },
  { key: '/suppliers', icon: <TruckOutlined />, label: '供应商管理' },
  { type: 'divider' as const },
  {
    key: 'grp-account', icon: <SafetyCertificateOutlined />, label: '系统设置',
    children: [
      { key: '/accounts', label: '账号管理' },
      { key: '/customer-accounts', label: '客户账号管理' },
      { key: '/profile', label: '账号设置' },
    ],
  },
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
  '/shops': '店铺管理', '/warehouses': '仓库管理', '/shipping-methods': '物流渠道',
  '/shipping-templates': '运费模板', '/stock-transfers': '库存调拨',
  '/shipments': '打单发货', '/profit': '利润核算', '/pricing': '定价计算器',
  '/sourcing': '商品采集箱', '/listings': '刊登管理',
  '/order-sync': '多平台订单同步', '/messages': '客户消息聚合',
}

const groupKeys: Record<string, string> = {
  '/products': 'grp-product', '/sourcing': 'grp-product', '/listings': 'grp-product',
  '/inventory': 'grp-product', '/warehouses': 'grp-product', '/stock-transfers': 'grp-product',
  '/sales': 'grp-order', '/purchase': 'grp-order', '/shipments': 'grp-order', '/order-sync': 'grp-order',
  '/shops': 'grp-cross', '/shipping-methods': 'grp-cross', '/shipping-templates': 'grp-cross', '/messages': 'grp-cross',
  '/finance': 'grp-finance', '/profit': 'grp-finance', '/pricing': 'grp-finance',
  '/accounts': 'grp-account', '/customer-accounts': 'grp-account', '/profile': 'grp-account',
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [openKeys, setOpenKeys] = useState<string[]>([])
  const navigate = useNavigate()
  const location = useLocation()
  const { dark, toggle } = useAppTheme()
  const { token } = antdTheme.useToken()
  const { user, logout, isAdmin } = useAuth()

  const menuItems = isAdmin ? adminMenu : customerMenu
  const title = titleMap[location.pathname] || (location.pathname === '/profile' ? '账号设置' : 'Nova ERP')

  useEffect(() => {
    const g = groupKeys[location.pathname]
    if (g) setOpenKeys((prev) => prev.includes(g) ? prev : [...prev, g])
  }, [location.pathname])

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
        <div className="sider-menu-scroll">
          <Menu
            theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems}
            openKeys={openKeys}
            onOpenChange={(keys) => setOpenKeys(keys as string[])}
            onClick={({ key }: { key: string }) => { if (groupKeys[key]) return; navigate(key) }}
            style={{ marginTop: 8, background: 'transparent', borderInlineEnd: 'none' }}
          />
        </div>
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
