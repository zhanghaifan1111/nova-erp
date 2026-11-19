import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Avatar, Tag, Tooltip, theme as antdTheme } from 'antd'
import {
  DashboardOutlined, AppstoreOutlined, DatabaseOutlined, ShoppingCartOutlined,
  ShoppingOutlined, TeamOutlined, TruckOutlined, BarChartOutlined,
  MoonOutlined, SunOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  BellOutlined, SettingOutlined,
} from '@ant-design/icons'
import { useAppTheme } from '../theme'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '经营总览' },
  { key: '/products', icon: <AppstoreOutlined />, label: '商品管理' },
  { key: '/inventory', icon: <DatabaseOutlined />, label: '库存管理' },
  { key: '/sales', icon: <ShoppingCartOutlined />, label: '销售订单' },
  { key: '/purchase', icon: <ShoppingOutlined />, label: '采购订单' },
  { type: 'divider' as const },
  { key: '/customers', icon: <TeamOutlined />, label: '客户管理' },
  { key: '/suppliers', icon: <TruckOutlined />, label: '供应商管理' },
  { key: '/finance', icon: <BarChartOutlined />, label: '财务报表' },
]

const titleMap: Record<string, string> = {
  '/': '经营总览', '/products': '商品管理', '/inventory': '库存管理',
  '/sales': '销售订单', '/purchase': '采购订单', '/customers': '客户管理',
  '/suppliers': '供应商管理', '/finance': '财务报表',
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { dark, toggle } = useAppTheme()
  const { token } = antdTheme.useToken()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={236}
        style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 20 }}
      >
        <div className="brand">
          <div className="brand-logo">N</div>
          {!collapsed && (
            <div className="brand-text">
              <div className="brand-name">Nova ERP</div>
              <div className="brand-sub">智能企业管理平台</div>
            </div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ marginTop: 8, background: 'transparent', borderInlineEnd: 'none' }}
        />
        {!collapsed && (
          <div className="sider-footer">
            <div className="sider-tip-card">
              <div className="sider-tip-title">团队版</div>
              <div className="sider-tip-desc">数据本地持久化 · 全流程管理</div>
            </div>
          </div>
        )}
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 236, transition: 'margin-left .2s' }}>
        <Header className="app-header" style={{ background: token.colorBgContainer }}>
          <div className="header-left">
            <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)} style={{ fontSize: 18 }} />
            <span className="header-title">{titleMap[location.pathname] || 'Nova ERP'}</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>v1.0</Tag>
          </div>
          <div className="header-right">
            <Tooltip title={dark ? '切换浅色' : '切换深色'}>
              <Button type="text" icon={dark ? <SunOutlined /> : <MoonOutlined />} onClick={toggle} />
            </Tooltip>
            <Tooltip title="通知">
              <Button type="text" icon={<BellOutlined />} />
            </Tooltip>
            <Tooltip title="设置">
              <Button type="text" icon={<SettingOutlined />} />
            </Tooltip>
            <div className="avatar-wrap">
              <Avatar style={{ background: 'linear-gradient(135deg,#4f6ef7,#7c5cff)' }}>管</Avatar>
              <span className="avatar-name">管理员</span>
            </div>
          </div>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
