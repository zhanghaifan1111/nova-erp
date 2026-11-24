import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, message, Badge, Empty, Statistic, Row, Col, Card, Descriptions, Alert } from 'antd'
import { BellOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons'
import { api, money } from '../api'
import { useAuth } from '../auth'

// ============ 通知中心 ============
function Notifications() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    api.list('notifications').then((r) => setRows(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const markRead = async (id: string) => {
    try { await api.notificationRead(id); message.success('已读'); load() } catch (e: any) { message.error(e.message) }
  }
  const markAll = async () => {
    try { const r: any = await api.notificationReadAll(); message.success(r.message); load() } catch (e: any) { message.error(e.message) }
  }
  const unread = rows.filter((n) => !n.read)

  const cols = [
    { title: '状态', dataIndex: 'read', key: 'read', width: 80, render: (v: boolean) => v ? <Tag>已读</Tag> : <Tag color="red">未读</Tag> },
    { title: '分类', dataIndex: 'category', key: 'category', width: 100, render: (v: string) => <Tag color="blue">{v || '系统'}</Tag> },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 175, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '操作', key: 'action', width: 90, render: (_: any, r: any) => !r.read ? <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => markRead(r.id)}>标已读</Button> : null },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="通知总数" value={rows.length} valueStyle={{ color: '#4f6ef7' }} prefix={<BellOutlined />} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="未读" value={unread.length} valueStyle={{ color: '#f04438' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="已读" value={rows.length - unread.length} valueStyle={{ color: '#16b364' }} /></Card></Col>
      </Row>
      <div className="table-toolbar">
        <div className="table-toolbar-left"><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button></div>
        <Button disabled={!unread.length} onClick={markAll}>全部标为已读</Button>
      </div>
      <Table columns={cols} dataSource={rows} rowKey="id" loading={loading} size="middle" rowClassName={(r: any) => !r.read ? 'row-unread' : ''} pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} />
    </div>
  )
}

// ============ 客户门户 ============
function Portal() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  useEffect(() => {
    api.portalSummary().then((r: any) => setData(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }, [])
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>加载中…</div>
  if (!data) return <Alert type="warning" message="仅客户账号可访问客户门户" />
  const cols = [
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 150 },
    { title: '日期', dataIndex: 'orderDate', key: 'orderDate', width: 110 },
    { title: '金额', dataIndex: 'total', key: 'total', width: 120, align: 'right' as const, render: (v: number) => money(v) },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === '已完成' ? 'success' : 'blue'}>{v}</Tag> },
  ]
  return (
    <div>
      <Alert type="info" showIcon message={`欢迎，${data.customer?.name || user?.name || '客户'}`} description="这是你的专属门户，可查看自己的订单与账务情况。数据已做隔离，仅你可见。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="我的订单" value={data.stats.orderCount} /></Card></Col>
        <Col xs={24} sm={6}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="累计金额" value={data.stats.totalAmount} precision={2} prefix="¥" valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={6}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="已付款" value={data.stats.received} precision={2} prefix="¥" valueStyle={{ color: '#16b364' }} /></Card></Col>
        <Col xs={24} sm={6}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="待付款" value={data.stats.unpaid} precision={2} prefix="¥" valueStyle={{ color: '#f04438' }} /></Card></Col>
      </Row>
      <Card className="chart-card" title="我的订单" styles={{ body: { padding: 16 } }}>
        <Table columns={cols} dataSource={data.orders} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  )
}

export default function NotificationsPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">通知中心 · 客户门户</h1>
        <p className="page-desc">站内消息已读管理 + 客户自助查询入口</p>
      </div>
      <Tabs items={[
        { key: 'notify', label: '通知中心', children: <Notifications /> },
        { key: 'portal', label: '客户门户', children: <Portal /> },
      ]} />
    </div>
  )
}
