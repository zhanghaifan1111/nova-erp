import React, { useEffect, useState } from 'react'
import { Tabs, Row, Col, Card, Statistic, Button, message, Alert, Tag, Table, Form, Input, Space, Progress, Typography, Modal } from 'antd'
import { CrownOutlined, ApiOutlined, LinkOutlined, NotificationOutlined, CopyOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { api } from '../api'
import CrudPage, { Field } from './CrudPage'

const { Text, Paragraph } = Typography

export default function SaasCenter() {
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = () => api.saasMe().then((r: any) => setMe(r.data)).catch((e: any) => message.error(e.message))
  useEffect(() => { load() }, [])

  const subscribe = async (plan: string) => {
    Modal.confirm({
      title: '确认升级套餐', content: `升级到该套餐后，当前订阅立即生效（演示环境不实际扣费）。`,
      okText: '确认升级', cancelText: '取消',
      onOk: async () => {
        try { const r: any = await api.saasSubscribe(plan); message.success(r.message); load() }
        catch (e: any) { message.error(e.message) }
      },
    })
  }

  const planCards = [
    { key: 'free', name: '免费版', price: 0, desc: '刚起步的卖家', color: 'default', features: ['50 商品 / 100 订单', '1 个账号', '100 次 API 调用'] },
    { key: 'pro', name: '专业版', price: 199, desc: '成长型团队', color: 'blue', features: ['2000 商品 / 1万订单', '5 个账号', '1万次 API 调用', '全部 AI 工具'] },
    { key: 'flagship', name: '旗舰版', price: 599, desc: '多店铺大卖家', color: 'gold', features: ['不限商品 / 100万订单', '50 个账号', '100万次 API 调用', '专属支持'] },
  ]

  const usageRows = me && !me.isPlatformAdmin ? [
    { metric: '商品数', used: me.usage.products, limit: me.limits.products },
    { metric: '订单数', used: me.usage.orders, limit: me.limits.orders },
    { metric: '账号数', used: me.usage.users, limit: me.limits.users },
  ] : []

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">SaaS 运营中心</h1>
        <p className="page-desc">订阅套餐、平台授权、开放 API、Webhook——把 ERP 当生意来运营</p>
      </div>

      {me?.isPlatformAdmin && <Alert type="info" showIcon message="平台超级管理员" description="你当前是平台管理员账号，拥有全部权限、不受套餐限制。普通卖家通过登录页「免费开通」注册独立租户。" style={{ marginBottom: 16 }} />}

      <Tabs items={[
        {
          key: 'subscription', label: '订阅套餐', children: (
            <div>
              <Alert type="info" showIcon message={`当前套餐：${me?.planName || '加载中'}`} description={me?.subscription ? `有效期至 ${me.subscription.expiryDate}` : '选择适合你的套餐，随时可升级。'} style={{ marginBottom: 16 }} />
              {usageRows.length > 0 && <Card className="chart-card" title="用量" styles={{ body: { padding: 16 } }} style={{ marginBottom: 16 }}>
                {usageRows.map((r) => <div key={r.metric} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><Text>{r.metric}</Text><Text>{r.used} / {r.limit}</Text></div>
                  <Progress percent={Math.min(100, Math.round(r.used / Math.max(1, r.limit) * 100))} strokeColor={r.used / Math.max(1, r.limit) > 0.8 ? '#f04438' : '#4f6ef7'} />
                </div>)}
              </Card>}
              <Row gutter={[16, 16]}>
                {planCards.map((p) => <Col xs={24} md={8} key={p.key}>
                  <Card className="chart-card" title={<span><CrownOutlined /> {p.name}</span>} styles={{ body: { padding: 20 } }} extra={me?.plan === p.key && <Tag color="success">当前</Tag>}>
                    <div style={{ fontSize: 32, fontWeight: 500, color: '#4f6ef7', marginBottom: 4 }}>¥{p.price}<span style={{ fontSize: 14, color: '#888' }}>/月</span></div>
                    <Paragraph type="secondary">{p.desc}</Paragraph>
                    {p.features.map((f) => <div key={f} style={{ marginBottom: 6 }}><CheckCircleOutlined style={{ color: '#16b364', marginRight: 6 }} />{f}</div>)}
                    <Button block type={me?.plan === p.key ? 'default' : 'primary'} disabled={me?.plan === p.key || me?.isPlatformAdmin} onClick={() => subscribe(p.key)} style={{ marginTop: 16 }}>
                      {me?.plan === p.key ? '当前套餐' : '选择套餐'}
                    </Button>
                  </Card>
                </Col>)}
              </Row>
            </div>
          ),
        },
        {
          key: 'auth', label: '平台授权', children: (
            <div>
              <Alert type="warning" showIcon message="对接说明" description="这里建立授权记录框架。真正拉取平台数据需在平台开放平台申请 App Key/Secret 并填入，走 OAuth 授权后才能启用。目前为演示占位，不会实际连接平台。" style={{ marginBottom: 16 }} />
              <Card className="chart-card" styles={{ body: { padding: 16 } }}>
                <CrudPage collection="platformAuths" title="店铺授权" desc="登记各平台店铺授权信息" fields={[
                  { name: 'platform', label: '平台', required: true, type: 'select', options: ['亚马逊', 'Shopee', 'TikTok', 'Temu', '速卖通', '独立站'].map((v) => ({ label: v, value: v })) },
                  { name: 'shopName', label: '店铺名称', required: true },
                  { name: 'appKey', label: 'App Key' },
                  { name: 'appSecret', label: 'App Secret' },
                  { name: 'accessToken', label: 'Access Token', span: 2 },
                  { name: 'status', label: '状态', type: 'select', options: [{ label: '待授权', value: '待授权' }, { label: '已授权', value: '已授权' }] },
                ]} columns={[
                  { title: '平台', dataIndex: 'platform', key: 'platform', render: (v: string) => <Tag color="blue">{v}</Tag> },
                  { title: '店铺', dataIndex: 'shopName', key: 'shopName' },
                  { title: 'App Key', dataIndex: 'appKey', key: 'appKey', render: (v: string) => v ? v.slice(0, 8) + '...' : '-' },
                  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === '已授权' ? 'success' : 'orange'}>{v}</Tag> },
                  { title: '测试于', dataIndex: 'lastTest', key: 'lastTest' },
                ]} />
              </Card>
            </div>
          ),
        },
        {
          key: 'api', label: '开放 API', children: <OpenApi />,
        },
        {
          key: 'webhook', label: 'Webhook', children: <Webhooks />,
        },
      ]} />
    </div>
  )
}

function OpenApi() {
  const [key, setKey] = useState('')
  const [me, setMe] = useState<any>(null)
  useEffect(() => { api.saasMe().then((r: any) => setMe(r.data)); api.list('apiKeys').then((r: any) => { if (r.data[0]) setKey(r.data[0].key) }).catch(() => {}) }, [])
  const gen = async () => {
    try { const r: any = await api.createApiKey('演示密钥'); setKey(r.data.key); message.success('API Key 已生成') }
    catch (e: any) { message.error(e.message) }
  }
  const endpoint = window.location.origin + '/api/open/products'
  return (
    <div>
      <Alert type="info" showIcon message="开放 API" description="用 API Key 通过 HTTP Header `x-api-key` 调用，客户可把自己的系统对接进来。当前开放商品与订单只读接口。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card className="chart-card" title={<span><ApiOutlined /> 我的 API Key</span>} styles={{ body: { padding: 20 } }}>
            {key ? <>
              <Paragraph copyable={{ text: key }} code style={{ wordBreak: 'break-all' }}>{key}</Paragraph>
              <Tag color="success">启用中</Tag>
            </> : <Paragraph type="secondary">还没有 API Key，点下方生成</Paragraph>}
            {!me?.isPlatformAdmin && <Button type="primary" icon={<CopyOutlined />} onClick={gen} style={{ marginTop: 12 }}>生成 API Key</Button>}
            <div style={{ marginTop: 24 }}>
              <Text strong>调用示例</Text>
              <pre style={{ background: 'var(--color-background-secondary)', padding: 12, borderRadius: 8, overflow: 'auto', fontSize: 12 }}>
{`curl -H "x-api-key: ${key || 'YOUR_KEY'}" \\
  ${endpoint}`}
              </pre>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="chart-card" title="可用接口" styles={{ body: { padding: 20 } }}>
            <Table size="small" pagination={false} rowKey="path" dataSource={[
              { method: 'GET', path: '/api/open/products', desc: '获取租户商品列表' },
              { method: 'GET', path: '/api/open/orders', desc: '获取租户订单列表' },
            ]} columns={[
              { title: '方法', dataIndex: 'method', key: 'method', width: 80, render: (v: string) => <Tag color="green">{v}</Tag> },
              { title: '路径', dataIndex: 'path', key: 'path' },
              { title: '说明', dataIndex: 'desc', key: 'desc' },
            ]} />
            <Alert type="warning" showIcon message="演示边界" description="当前为只读接口 + 本地数据。真实对外服务需补：HTTPS、限流、审计日志、沙箱环境。" style={{ marginTop: 16 }} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

function Webhooks() {
  const [testing, setTesting] = useState<string | null>(null)
  const test = async (id: string) => {
    setTesting(id)
    try { const r: any = await api.webhookTest(id); message.success(r.message) }
    catch (e: any) { message.error(e.message) }
    finally { setTesting(null) }
  }
  return (
    <div>
      <Alert type="info" showIcon message="Webhook 推送" description="订阅事件后，可配置把订单/库存变化推送到你的系统。当前演示为「模拟推送」记录日志，生产环境替换为真实 HTTP 请求。" style={{ marginBottom: 16 }} />
      <Card className="chart-card" styles={{ body: { padding: 16 } }}>
        <CrudPage collection="webhooks" title="推送订阅" desc="配置接收地址与事件" fields={[
          { name: 'url', label: '接收地址', required: true, span: 2, placeholder: 'https://your-system.com/webhook' },
          { name: 'events', label: '订阅事件（逗号分隔）', placeholder: '订单创建,库存变更' },
          { name: 'status', label: '状态', type: 'select', options: [{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }] },
        ]} columns={[
          { title: '接收地址', dataIndex: 'url', key: 'url', ellipsis: true },
          { title: '事件', dataIndex: 'events', key: 'events' },
          { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag> },
          { title: '操作', key: 'act', width: 100, render: (_: any, r: any) => <Button type="link" size="small" icon={<NotificationOutlined />} loading={testing === r.id} onClick={() => test(r.id)}>测试推送</Button> },
        ]} />
      </Card>
      <Card className="chart-card" title="推送日志" styles={{ body: { padding: 16 } }} style={{ marginTop: 16 }}>
        <CrudPage collection="webhookLogs" title="日志" desc="推送记录" fields={[]} columns={[
          { title: '事件', dataIndex: ['payload', 'event'], key: 'event' },
          { title: '地址', dataIndex: 'url', key: 'url', ellipsis: true },
          { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color="blue">{v}</Tag> },
          { title: '时间', dataIndex: 'at', key: 'at', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
        ]} />
      </Card>
    </div>
  )
}
