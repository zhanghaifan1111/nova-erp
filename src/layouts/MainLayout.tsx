import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Avatar, Tag, Tooltip, theme as antdTheme, Dropdown } from 'antd'
import {
  DashboardOutlined, AppstoreOutlined, DatabaseOutlined, ShoppingCartOutlined,
  ShoppingOutlined, TeamOutlined, TruckOutlined, BarChartOutlined,
  MoonOutlined, SunOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  BellOutlined, SettingOutlined, SafetyCertificateOutlined, UserOutlined,
  LogoutOutlined, KeyOutlined, DownOutlined, GlobalOutlined,
  FundProjectionScreenOutlined, AuditOutlined, CheckSquareOutlined,
  RobotOutlined, CustomerServiceOutlined,
} from '@ant-design/icons'
import { useAppTheme } from '../theme'
import { useAuth } from '../auth'
import { api } from '../api'

const { Header, Sider, Content } = Layout

const adminMenu = [
  { key: '/', icon: <DashboardOutlined />, label: '经营总览' },
  { key: '/command-center', icon: <FundProjectionScreenOutlined />, label: '经营驾驶舱' },
  {
    key: 'grp-product', icon: <AppstoreOutlined />, label: '商品与库存',
    children: [
      { key: '/products', label: '商品管理' },
      { key: '/sourcing', label: '商品采集箱' },
      { key: '/listings', label: '刊登管理' },
      { key: '/inventory', label: '库存管理' },
      { key: '/stock-flow', label: '入库盘点退货' },
      { key: '/warehouses', label: '仓库管理' },
      { key: '/stock-transfers', label: '库存调拨' },
      { key: '/warehouse-fx', label: '拣货单 · 汇率' },
      { key: '/warehouse-intel', label: '库位 · 销售预测' },
      { key: '/quality', label: '质检 · 批次追溯' },
    ],
  },
  {
    key: 'grp-order', icon: <ShoppingCartOutlined />, label: '订单与发货',
    children: [
      { key: '/sales', label: '销售订单' },
      { key: '/purchase', label: '采购订单' },
      { key: '/shipments', label: '打单发货' },
      { key: '/labels', label: '箱唛 · 面单打印' },
      { key: '/rfq', label: '供应商询价比价' },
      { key: '/after-sales', label: '售后服务 · BOM' },
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
      { key: '/payments', label: '收付款管理' },
      { key: '/profit', label: '利润核算' },
      { key: '/pricing', label: '定价计算器' },
      { key: '/compliance', label: '发票 · 操作审计' },
      { key: '/gl', label: '会计总账' },
      { key: '/reconciliation', label: '平台结算对账' },
    ],
  },
  {
    key: 'grp-workflow', icon: <SafetyCertificateOutlined />, label: '智能与管控',
    children: [
      { key: '/intelligence', label: '智能决策中心' },
      { key: '/workflow', label: '审批中心 · 报销' },
      { key: '/performance', label: 'KPI · 预警中心' },
      { key: '/automation', label: '自动化规则引擎' },
      { key: '/reports', label: '自定义报表' },
    ],
  },
  { type: 'divider' as const },
  { key: '/notifications', icon: <BellOutlined />, label: '通知中心' },
  { key: '/customers', icon: <TeamOutlined />, label: '客户管理' },
  { key: '/crm', icon: <TeamOutlined />, label: '客户跟进 CRM' },
  { key: '/suppliers', icon: <TruckOutlined />, label: '供应商管理' },
  { type: 'divider' as const },
  {
    key: 'grp-account', icon: <SafetyCertificateOutlined />, label: '系统设置',
    children: [
      { key: '/accounts', label: '账号管理' },
      { key: '/rbac', label: 'RBAC 角色权限' },
      { key: '/customer-accounts', label: '客户账号管理' },
      { key: '/api-integration', label: 'API 对接 · 订单推送' },
      { key: '/data-io', label: '数据导入导出' },
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
  '/shipments': '打单发货', '/labels': '箱唛 · 面单打印', '/profit': '利润核算', '/pricing': '定价计算器',
  '/sourcing': '商品采集箱', '/listings': '刊登管理',
  '/order-sync': '多平台订单同步', '/messages': '客户消息聚合',
  '/api-integration': 'API 对接 · 订单推送',
  '/stock-flow': '入库盘点退货', '/data-io': '数据导入导出',
  '/payments': '收付款管理', '/crm': '客户跟进 CRM', '/warehouse-fx': '拣货单 · 汇率管理',
  '/intelligence': '智能决策中心', '/workflow': '审批中心 · 费用报销',
  '/compliance': '发票 · 操作审计', '/warehouse-intel': '库位 · 销售预测',
  '/command-center': '经营驾驶舱', '/gl': '会计总账', '/reconciliation': '平台结算对账',
  '/performance': 'KPI 目标 · 预警中心',
  '/automation': '自动化规则引擎', '/notifications': '通知中心', '/rbac': 'RBAC 角色权限',
  '/after-sales': '售后服务 · 组合商品 BOM',
  '/rfq': '供应商询价比价', '/quality': '质检管理 · 批次追溯', '/reports': '自定义报表设计器',
}

const groupKeys: Record<string, string> = {
  '/products': 'grp-product', '/sourcing': 'grp-product', '/listings': 'grp-product',
  '/inventory': 'grp-product', '/stock-flow': 'grp-product', '/warehouses': 'grp-product', '/stock-transfers': 'grp-product', '/warehouse-fx': 'grp-product', '/warehouse-intel': 'grp-product', '/quality': 'grp-product',
  '/sales': 'grp-order', '/purchase': 'grp-order', '/shipments': 'grp-order', '/labels': 'grp-order', '/order-sync': 'grp-order', '/after-sales': 'grp-order', '/rfq': 'grp-order',
  '/shops': 'grp-cross', '/shipping-methods': 'grp-cross', '/shipping-templates': 'grp-cross', '/messages': 'grp-cross',
  '/finance': 'grp-finance', '/payments': 'grp-finance', '/profit': 'grp-finance', '/pricing': 'grp-finance', '/compliance': 'grp-finance',
  '/gl': 'grp-finance', '/reconciliation': 'grp-finance',
  '/intelligence': 'grp-workflow', '/workflow': 'grp-workflow', '/performance': 'grp-workflow', '/automation': 'grp-workflow', '/reports': 'grp-workflow',
  '/accounts': 'grp-account', '/customer-accounts': 'grp-account', '/profile': 'grp-account', '/rbac': 'grp-account',
  '/api-integration': 'grp-account', '/data-io': 'grp-account',
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [openKeys, setOpenKeys] = useState<string[]>([])
  const navigate = useNavigate()
  const location = useLocation()
  const { dark, toggle } = useAppTheme()
  const { token } = antdTheme.useToken()
  const { user, logout, isAdmin } = useAuth()
  const [allowedMenus, setAllowedMenus] = useState<string[] | null>(null)

  // RBAC：按角色白名单过滤菜单（admin 或 roleKey=admin 看全部）
  useEffect(() => {
    if (!isAdmin) { setAllowedMenus(null); return }
    const roleKey = user?.roleKey
    if (!roleKey || roleKey === 'admin') { setAllowedMenus(null); return }
    api.list('roles').then((r: any) => {
      const role = r.data.find((x: any) => x.key === roleKey && x.status === '启用')
      setAllowedMenus(role?.menus || [])
    }).catch(() => setAllowedMenus(null))
  }, [isAdmin, user?.roleKey])

  const filterByAllow = (items: any[]): any[] => {
    if (!allowedMenus) return items
    return items.map((item: any) => {
      if (item.children) {
        const kids = item.children.filter((c: any) => allowedMenus.includes(c.key))
        return kids.length ? { ...item, children: kids } : null
      }
      return allowedMenus.includes(item.key) ? item : null
    }).filter(Boolean)
  }

  const menuItems = isAdmin ? filterByAllow(adminMenu) : customerMenu
  const title = titleMap[location.pathname] || (location.pathname === '/profile' ? '账号设置' : '周桂祥的ERP')

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
          <div className="brand-logo">周</div>
          {!collapsed && (
            <div className="brand-text">
              <div className="brand-name">周桂祥的ERP</div>
              <div className="brand-sub">智能企业管理平台</div>
            </div>
          )}
        </div>
        <div className="sider-menu-scroll">
          <Menu
            theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems}
            openKeys={openKeys}
            onOpenChange={(keys) => setOpenKeys(keys as string[])}
            onClick={({ key }: { key: string }) => { if (key.startsWith('grp-')) return; navigate(key) }}
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
            <Tooltip title="通知中心"><Button type="text" icon={<BellOutlined />} onClick={() => navigate('/notifications')} /></Tooltip>
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
