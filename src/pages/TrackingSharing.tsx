import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, message, Modal, Form, Input, Alert, Row, Col, Card, Statistic, Timeline, Popconfirm, InputNumber } from 'antd'
import { WarningOutlined, PlusOutlined, LockOutlined, UnlockOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api } from '../api'
import CrudPage, { Field } from './CrudPage'

const statusColor = (v: string) => v?.includes('签收') ? 'success' : v?.includes('异常') || v?.includes('滞留') ? 'error' : v?.includes('派送') ? 'blue' : 'processing'

// ============ 物流轨迹 ============
function Tracking() {
  const [rows, setRows] = useState<any[]>([])
  const [exceptions, setExceptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any>(null)
  const [eventForm] = Form.useForm()

  const load = () => {
    setLoading(true)
    Promise.all([api.list('shipments_tracking'), api.trackingExceptions(7)])
      .then(([a, b]: any[]) => { setRows(a.data); setExceptions(b.data.rows) })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const addEvent = async () => {
    const v = await eventForm.validateFields()
    try {
      const r: any = await api.trackingAddEvent(detail.id, { ...v, at: v.at ? dayjs(v.at).toISOString() : undefined })
      message.success(r.message); eventForm.resetFields()
      const fresh = (await api.list('shipments_tracking')).data.find((x: any) => x.id === detail.id); setDetail(fresh); load()
    } catch (e: any) { message.error(e.message) }
  }

  const cols = [
    { title: '运单号', dataIndex: 'trackingNo', key: 'trackingNo', width: 160 },
    { title: '物流商', dataIndex: 'carrier', key: 'carrier', width: 120 },
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 130 },
    { title: '最新状态', dataIndex: 'lastStatus', key: 'lastStatus', render: (v: string) => <Tag color={statusColor(v)}>{v || '-'}</Tag> },
    { title: '轨迹数', dataIndex: 'events', key: 'events', width: 80, render: (v: any[]) => (v || []).length },
    { title: '更新时间', dataIndex: 'lastUpdate', key: 'lastUpdate', width: 160, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '操作', key: 'action', width: 90, render: (_: any, r: any) => <Button type="link" size="small" onClick={() => { setDetail(r); eventForm.resetFields() }}>查看轨迹</Button> },
  ]

  return (
    <div>
      <Alert type="warning" showIcon message={`异常件 ${exceptions.length} 条`} description="超过 7 天未更新且未签收的运单，可能是丢件或滞留，建议尽快联系物流商。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="在途运单" value={rows.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="已签收" value={rows.filter((r) => r.delivered).length} valueStyle={{ color: '#16b364' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="异常件" value={exceptions.length} valueStyle={{ color: '#f04438' }} prefix={<WarningOutlined />} /></Card></Col>
      </Row>
      <CrudPage collection="shipments_tracking" title="运单" desc="录入运单与物流轨迹" fields={[
        { name: 'trackingNo', label: '运单号', required: true },
        { name: 'carrier', label: '物流商' },
        { name: 'orderNo', label: '关联订单号' },
        { name: 'lastStatus', label: '最新状态', placeholder: '如：已揽收/运输中/派送中/已签收' },
      ]} columns={cols} />

      <Modal open={!!detail} title={`轨迹详情 · ${detail?.trackingNo || ''}`} onCancel={() => setDetail(null)} footer={null} width={700}>
        {detail && <>
          <Timeline style={{ margin: '16px 0' }} items={(detail.events || []).slice().reverse().map((e: any, i: number) => ({
            color: i === 0 ? '#4f6ef7' : 'gray',
            children: <div><b>{e.status}</b> {e.location && <span style={{ color: '#888' }}>· {e.location}</span>}<div style={{ fontSize: 12, color: '#999' }}>{e.at ? new Date(e.at).toLocaleString('zh-CN') : ''} {e.note}</div></div>,
          }))} />
          {!(detail.events || []).length && <Alert type="info" message="暂无轨迹，可在下方添加" style={{ marginBottom: 16 }} />}
          <div style={{ borderTop: '1px solid rgba(127,127,127,.15)', paddingTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>添加轨迹节点</div>
            <Form form={eventForm} layout="vertical" onFinish={addEvent}>
              <Space style={{ width: '100%' }} align="start">
                <Form.Item name="status" label="状态" rules={[{ required: true }]}><Input placeholder="如：到达海外仓" style={{ width: 180 }} /></Form.Item>
                <Form.Item name="location" label="地点"><Input placeholder="选填" style={{ width: 160 }} /></Form.Item>
                <Form.Item name="note" label="备注"><Input placeholder="选填" style={{ width: 160 }} /></Form.Item>
                <Form.Item name="at" label="时间"><Input placeholder="ISO时间，选填" style={{ width: 180 }} /></Form.Item>
                <Button type="primary" htmlType="submit" style={{ marginTop: 30 }}>添加</Button>
              </Space>
            </Form>
          </div>
        </>}
      </Modal>
    </div>
  )
}

// ============ 库存共享防超卖 ============
function StockSharing() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lockForm] = Form.useForm()
  const load = () => {
    setLoading(true)
    api.stockAvailability().then((r: any) => setRows(r.data.rows)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  const doLock = async () => {
    const v = await lockForm.validateFields()
    try { const r: any = await api.stockLock(v.sku, Number(v.qty), v.orderNo); message.success(r.message); lockForm.resetFields(); load() }
    catch (e: any) { message.error(e.message) }
  }

  const cols = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: '商品', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '真实库存', dataIndex: 'stock', key: 'stock', width: 110, align: 'right' as const },
    { title: '已锁定', dataIndex: 'locked', key: 'locked', width: 100, align: 'right' as const, render: (v: number) => <b style={{ color: '#f79009' }}>{v}</b> },
    { title: '可用库存', dataIndex: 'available', key: 'available', width: 110, align: 'right' as const, render: (v: number) => <b style={{ color: v <= 0 ? '#f04438' : '#16b364' }}>{v}</b> },
  ]

  return (
    <div>
      <Alert type="info" showIcon message="防超卖机制" description="多店铺共用一个库存池。下单时先锁库存，可用库存=真实库存−已锁定。锁定不足会拒绝，避免超卖。发货后释放锁定。" style={{ marginBottom: 16 }} />
      <Card className="chart-card" styles={{ body: { padding: 16 } }} style={{ marginBottom: 16 }}>
        <Form form={lockForm} layout="inline" onFinish={doLock}>
          <Form.Item name="sku" label="SKU" rules={[{ required: true }]}><Input placeholder="要锁定的SKU" style={{ width: 150 }} /></Form.Item>
          <Form.Item name="qty" label="锁定数量" rules={[{ required: true }]}><InputNumber min={1} style={{ width: 120 }} /></Form.Item>
          <Form.Item name="orderNo" label="订单号"><Input placeholder="选填" style={{ width: 160 }} /></Form.Item>
          <Button type="primary" htmlType="submit" icon={<LockOutlined />}>锁定库存</Button>
        </Form>
      </Card>
      <div className="table-toolbar"><div className="table-toolbar-left"><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button></div></div>
      <Table columns={cols} dataSource={rows} rowKey="sku" loading={loading} size="middle" pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 个SKU被锁定` }} />
    </div>
  )
}

export default function TrackingSharing() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">物流轨迹 · 库存共享</h1>
        <p className="page-desc">全程追踪运单、异常件自动提醒；多店共享库存锁库防超卖</p>
      </div>
      <Tabs items={[
        { key: 'tracking', label: '物流轨迹', children: <Tracking /> },
        { key: 'sharing', label: '库存共享', children: <StockSharing /> },
      ]} />
    </div>
  )
}
