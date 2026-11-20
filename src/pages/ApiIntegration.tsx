import React, { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Input, Modal, Form, Select, message, Popconfirm, Tabs, Card, Alert, Row, Col, Statistic, Typography } from 'antd'
import { PlusOutlined, SearchOutlined, ReloadOutlined, DeleteOutlined, ApiOutlined, SendOutlined, RocketOutlined, RedoOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { api } from '../api'
import CrudPage, { Field } from './CrudPage'

const { Text, Paragraph } = Typography

const endpointFields: Field[] = [
  { name: 'name', label: '目标名称', required: true, placeholder: '如：客户A的订单系统' },
  { name: 'url', label: '接收地址 URL', required: true, span: 2, placeholder: 'https://customer.example.com/api/orders' },
  { name: 'method', label: '请求方法', type: 'select', options: [{ label: 'POST', value: 'POST' }, { label: 'PUT', value: 'PUT' }] },
  {
    name: 'authType', label: '鉴权方式', type: 'select',
    options: [
      { label: '无鉴权', value: 'none' },
      { label: 'Bearer Token', value: 'bearer' },
      { label: 'API Key（请求头）', value: 'apikey' },
      { label: 'HMAC-SHA256 签名', value: 'hmac' },
    ],
  },
  { name: 'token', label: 'Bearer Token' },
  { name: 'apiKey', label: 'API Key' },
  { name: 'headerName', label: 'API Key 请求头名', placeholder: 'X-API-Key' },
  { name: 'secret', label: 'HMAC 密钥', span: 2 },
  { name: 'enabled', label: '状态', type: 'select', options: [{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }] },
  { name: 'remark', label: '备注', span: 2 },
]

const endpointColumns = [
  { title: '目标名称', dataIndex: 'name', key: 'name', width: 160 },
  { title: '接收地址', dataIndex: 'url', key: 'url', ellipsis: true, width: 260 },
  {
    title: '鉴权', dataIndex: 'authType', key: 'authType', width: 120,
    render: (v: string) => <Tag color={v === 'none' ? 'default' : 'blue'}>{{ none: '无', bearer: 'Bearer', apikey: 'API Key', hmac: 'HMAC' }[v] || v}</Tag>,
  },
  { title: '状态', dataIndex: 'enabled', key: 'enabled', width: 90, render: (v: string) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag> },
  { title: '备注', dataIndex: 'remark', key: 'remark' },
]

const logStatusColor: Record<string, string> = { 成功: 'success', 失败: 'error' }

function PushLogs() {
  const [rows, setRows] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [endpoints, setEndpoints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [detail, setDetail] = useState<any>(null)
  const [pushOpen, setPushOpen] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | undefined>()
  const [pushing, setPushing] = useState(false)

  const load = () => {
    setLoading(true)
    api.list('pushLogs').then((r) => setRows(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
    api.list('salesOrders').then((r) => setOrders(r.data)).catch(() => {})
    api.list('apiEndpoints').then((r) => { setEndpoints(r.data); setSelectedEndpoint(r.data.find((e: any) => e.enabled === '启用')?.id) }).catch(() => {})
  }, [])

  const doPush = async () => {
    if (!selectedOrders.length) { message.warning('请选择要推送的订单'); return }
    if (!selectedEndpoint) { message.warning('请选择推送目标'); return }
    setPushing(true)
    try {
      const r: any = await api.pushOrders(selectedOrders, selectedEndpoint)
      message.success(r.message || '推送完成')
      setPushOpen(false); setSelectedOrders([]); load()
    } catch (e: any) { message.error(e.message) }
    finally { setPushing(false) }
  }

  const retry = (id: string) => {
    Modal.confirm({
      title: '重试推送', content: '用当前配置重新推送这条订单的报文？',
      okText: '重试', cancelText: '取消',
      onOk: async () => {
        try { const r: any = await api.pushRetry(id); message.success(r.message); load() }
        catch (e: any) { message.error(e.message); load() }
      },
    })
  }

  const filtered = keyword.trim()
    ? rows.filter((r) => [r.orderNo, r.endpointName, r.error].some((v) => String(v || '').toLowerCase().includes(keyword.toLowerCase())))
    : rows
  const okCount = rows.filter((r) => r.status === '成功').length

  const columns = [
    { title: '时间', dataIndex: 'pushedAt', key: 'pushedAt', width: 170, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '目标', dataIndex: 'endpointName', key: 'endpointName', width: 140 },
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 130 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: string) => <Tag color={logStatusColor[v] || 'default'}>{v}</Tag> },
    { title: 'HTTP', dataIndex: 'httpCode', key: 'httpCode', width: 70, align: 'right' as const },
    { title: '错误/响应', key: 'info', ellipsis: true, render: (_: any, r: any) => r.error || r.response || '-' },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: any, r: any) => (
        <Space size={2}>
          <Button type="link" size="small" onClick={() => setDetail(r)}>详情</Button>
          {r.status === '失败' && <Button type="link" size="small" icon={<RedoOutlined />} onClick={() => retry(r.id)}>重试</Button>}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="推送总数" value={rows.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="成功" value={okCount} valueStyle={{ color: '#16b364' }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="失败" value={rows.length - okCount} valueStyle={{ color: '#f04438' }} prefix={<CloseCircleOutlined />} /></Card></Col>
      </Row>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input prefix={<SearchOutlined />} placeholder="搜索订单号/目标" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
        <Button type="primary" icon={<SendOutlined />} onClick={() => setPushOpen(true)} disabled={!endpoints.length}>推送订单</Button>
      </div>
      <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />

      <Modal open={pushOpen} title="推送订单到外部系统" onOk={doPush} onCancel={() => setPushOpen(false)} okText={`确认推送 (${selectedOrders.length})`} cancelText="取消" confirmLoading={pushing} width={640}>
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}><Text strong>推送目标</Text></div>
          <Select style={{ width: '100%', marginBottom: 20 }} value={selectedEndpoint} onChange={setSelectedEndpoint} placeholder="选择推送目标"
            options={endpoints.filter((e) => e.enabled === '启用').map((e) => ({ label: `${e.name} — ${e.url}`, value: e.id }))} />
          <div style={{ marginBottom: 8 }}><Text strong>选择订单</Text>（共 {orders.length} 条，已选 {selectedOrders.length} 条）</div>
          <Select mode="multiple" style={{ width: '100%' }} value={selectedOrders} onChange={setSelectedOrders} placeholder="选择要推送的销售订单"
            optionFilterProp="label" maxTagCount={5}
            options={orders.map((o) => ({ label: `${o.orderNo} — ${o.customerName || ''} ¥${o.total || 0}`, value: o.id }))} />
          {!endpoints.length && <Alert type="warning" message="请先到「推送配置」添加一个启用的目标" showIcon style={{ marginTop: 16 }} />}
        </div>
      </Modal>

      <Modal open={!!detail} title="推送详情" onCancel={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>关闭</Button>} width={720}>
        {detail && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Tag color={logStatusColor[detail.status]}>{detail.status}</Tag>
              <Text type="secondary"> 目标：{detail.endpointName} · HTTP {detail.httpCode} · {detail.pushedAt ? new Date(detail.pushedAt).toLocaleString('zh-CN') : ''}</Text>
            </div>
            {detail.error && <Alert type="error" message={detail.error} showIcon style={{ marginBottom: 12 }} />}
            <Text strong>发送报文</Text>
            <pre style={{ background: 'rgba(127,127,127,.1)', padding: 12, borderRadius: 8, maxHeight: 240, overflow: 'auto', fontSize: 12 }}>{detail.payload}</pre>
            <Text strong>对方响应</Text>
            <pre style={{ background: 'rgba(127,127,127,.1)', padding: 12, borderRadius: 8, maxHeight: 200, overflow: 'auto', fontSize: 12 }}>{detail.response || '（无）'}</pre>
          </div>
        )}
      </Modal>
    </div>
  )
}

function ApiDocs() {
  const sample = `{
  "event": "order.created",
  "eventId": "so_abc123",
  "timestamp": "2026-11-20T09:00:00.000Z",
  "data": {
    "orderNo": "SO202600001",
    "platformOrderNo": "PLAT-001",
    "orderDate": "2026-11-20",
    "status": "待发货",
    "customer": { "id": "c_1", "name": "张三" },
    "shop": { "id": "s_1", "name": "Shopee 小店", "platform": "Shopee" },
    "items": [
      { "sku": "SKU-1001", "name": "蓝牙耳机", "qty": 2, "price": 99, "subtotal": 198 }
    ],
    "total": 198,
    "shippingFee": 0,
    "otherFee": 0,
    "currency": "CNY"
  }
}`
  return (
    <div>
      <Alert type="info" showIcon message="对接说明" description="在「推送配置」里填对方系统提供的接收地址和鉴权信息；到「推送记录」页点「推送订单」选择订单即可把订单 JSON 发过去。对方系统按下面格式接收即可。" style={{ marginBottom: 16 }} />
      <Card className="chart-card" title="推送的订单报文格式（JSON）" styles={{ body: { padding: 20 } }}>
        <pre style={{ background: 'rgba(127,127,127,.1)', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12, lineHeight: 1.6 }}>{sample}</pre>
        <Paragraph style={{ marginTop: 16 }}>
          <Text strong>鉴权方式：</Text>支持 无鉴权 / Bearer Token / API Key（自定义请求头）/ HMAC-SHA256 签名。
          HMAC 模式会用密钥对请求体计算签名，放在 <Text code>X-Signature</Text> 请求头，算法标识在 <Text code>X-Signature-Alg</Text>。
        </Paragraph>
        <Paragraph>
          <Text strong>成功判定：</Text>对方返回 2xx 视为成功，其他状态码或超时记为失败，可在推送记录里查看详情并重试。
        </Paragraph>
        <Paragraph type="secondary">提示：先填好配置后用「测试连接」发一条测试报文，确认对方能收到再推真实订单。</Paragraph>
      </Card>
    </div>
  )
}

function EndpointsConfig() {
  const [endpoints, setEndpoints] = useState<any[]>([])
  const [testing, setTesting] = useState<string | null>(null)
  const load = () => api.list('apiEndpoints').then((r) => setEndpoints(r.data)).catch(() => {})
  useEffect(() => { load() }, [])

  const test = async (id: string) => {
    setTesting(id)
    try { const r: any = await api.pushTest(id); message.success(r.message) }
    catch (e: any) { message.error(e.message) }
    finally { setTesting(null) }
  }

  const extra = (record: any, reload: () => void) => (
    <Button type="link" size="small" icon={<ApiOutlined />} loading={testing === record.id} onClick={() => test(record.id)}>测试</Button>
  )

  return <CrudPage collection="apiEndpoints" title="推送配置" desc="配置对方系统的接收地址与鉴权方式" fields={endpointFields} columns={endpointColumns} extraActions={extra} />
}

export default function ApiIntegration() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">API 对接 · 订单推送</h1>
        <p className="page-desc">把系统里的订单通过 Webhook 推送到客户/合作方的系统，全链路记录可追踪</p>
      </div>
      <Tabs items={[
        { key: 'config', label: '推送配置', children: <EndpointsConfig /> },
        { key: 'logs', label: '推送记录', children: <PushLogs /> },
        { key: 'docs', label: '对接文档', children: <ApiDocs /> },
      ]} />
    </div>
  )
}
