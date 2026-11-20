import React, { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Input, Modal, Form, Select, message, Popconfirm, Tabs, Card, Alert, Row, Col, Statistic } from 'antd'
import { SearchOutlined, ReloadOutlined, ImportOutlined, SyncOutlined, DeleteOutlined } from '@ant-design/icons'
import { api, money } from '../api'
import CrudPage, { Field } from './CrudPage'

const configFields: Field[] = [
  { name: 'shopId', label: '店铺ID' },
  { name: 'platform', label: '平台', type: 'select', options: ['Shopee', 'Lazada', 'Amazon', 'TikTok Shop', 'Temu', 'AliExpress'].map((v) => ({ label: v, value: v })) },
  { name: 'enabled', label: '启用', type: 'select', options: [{ label: '是', value: '是' }, { label: '否', value: '否' }] },
  { name: 'lastSyncAt', label: '最近同步' },
  { name: 'remark', label: '备注', span: 2 },
]
const configColumns = [
  { title: '店铺ID', dataIndex: 'shopId', key: 'shopId' },
  { title: '平台', dataIndex: 'platform', key: 'platform', render: (v: string) => <Tag color="blue">{v}</Tag> },
  { title: '启用', dataIndex: 'enabled', key: 'enabled', render: (v: string) => <Tag color={v === '是' ? 'success' : 'default'}>{v}</Tag> },
  { title: '最近同步', dataIndex: 'lastSyncAt', key: 'lastSyncAt' },
  { title: '备注', dataIndex: 'remark', key: 'remark' },
]

const statusColor: Record<string, string> = { 待同步: 'orange', 已同步: 'success', 已忽略: 'default' }

function PlatformOrders() {
  const [rows, setRows] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [form] = Form.useForm()
  const [shops, setShops] = useState<any[]>([])

  const load = () => {
    setLoading(true)
    Promise.all([api.list('platformOrders'), api.list('syncLogs')])
      .then(([a, b]) => { setRows(a.data); setLogs(b.data) })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
    api.list('shops').then((r) => setShops(r.data)).catch(() => {})
  }, [])

  const doImport = async () => {
    const v = await form.validateFields()
    let parsed: any[] = []
    try { parsed = JSON.parse(v.data) } catch { message.error('JSON 格式错误，请检查'); return }
    if (!Array.isArray(parsed) || !parsed.length) { message.warning('数组为空'); return }
    try {
      const r: any = await api.syncImport({ shopId: v.shopId, rows: parsed })
      message.success(r.message || '导入完成'); setImportOpen(false); form.resetFields(); load()
    } catch (e: any) { message.error(e.message) }
  }

  const toSales = (id: string) => {
    Modal.confirm({
      title: '转为销售订单', content: '将该平台订单转成系统销售订单？会按客户名自动复用或新建客户。',
      okText: '确认转换', cancelText: '取消',
      onOk: async () => {
        try { const r: any = await api.syncToSales(id); message.success(r.message || '转换成功'); load() }
        catch (e: any) { message.error(e.message) }
      },
    })
  }

  const remove = async (id: string) => {
    try { await api.remove('platformOrders', id); message.success('已删除'); load() }
    catch (e: any) { message.error(e.message) }
  }

  const filtered = keyword.trim()
    ? rows.filter((r) => [r.platformOrderNo, r.customerName, r.shopName].some((v) => String(v || '').toLowerCase().includes(keyword.toLowerCase())))
    : rows
  const pending = rows.filter((r) => r.status === '待同步')
  const pendingAmount = pending.reduce((s, r) => s + Number(r.amount || 0), 0)

  const columns = [
    { title: '平台订单号', dataIndex: 'platformOrderNo', key: 'platformOrderNo', width: 150 },
    { title: '平台', dataIndex: 'platform', key: 'platform', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '店铺', dataIndex: 'shopName', key: 'shopName' },
    { title: '客户', dataIndex: 'customerName', key: 'customerName' },
    { title: '金额', dataIndex: 'amount', key: 'amount', align: 'right' as const, render: (v: number, r: any) => `${r.currency || 'CNY'} ${Number(v || 0).toFixed(2)}` },
    { title: '商品摘要', dataIndex: 'itemSummary', key: 'itemSummary', ellipsis: true },
    { title: '下单时间', dataIndex: 'orderTime', key: 'orderTime' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: any, r: any) => (
        <Space size={2}>
          {r.status === '待同步' && <Button type="link" size="small" icon={<SyncOutlined />} onClick={() => toSales(r.id)}>转销售单</Button>}
          <Popconfirm title="确认删除？" onConfirm={() => remove(r.id)} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const logColumns = [
    { title: '时间', dataIndex: 'syncedAt', key: 'syncedAt', width: 120 },
    { title: '店铺', dataIndex: 'shopName', key: 'shopName' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{v}</Tag> },
    { title: '总数', dataIndex: 'total', key: 'total' },
    { title: '新增', dataIndex: 'added', key: 'added' },
    { title: '跳过', dataIndex: 'skipped', key: 'skipped' },
    { title: '结果', dataIndex: 'result', key: 'result' },
  ]

  return (
    <div>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="关于自动同步"
        description="Shopee/Amazon 等平台的官方自动同步需要你在平台开放平台申请 API 授权（App Key / Token），这是平台方的强制要求。当前版本提供真实可用的「粘贴平台订单 JSON 导入 + 一键转销售订单」，数据全部是你自己的真实订单，不会生成任何虚构数据。" />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="平台订单总数" value={rows.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="待同步订单" value={pending.length} valueStyle={{ color: '#f79009' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="待同步金额" value={pendingAmount} precision={2} prefix="¥" valueStyle={{ color: '#16b364' }} /></Card></Col>
      </Row>

      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input prefix={<SearchOutlined />} placeholder="搜索订单号/客户" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
        <Button type="primary" icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>导入平台订单</Button>
      </div>

      <Tabs items={[
        { key: 'orders', label: '平台订单', children: <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} /> },
        { key: 'logs', label: '同步日志', children: <Table columns={logColumns} dataSource={logs} rowKey="id" size="middle" pagination={{ pageSize: 10 }} /> },
      ]} />

      <Modal open={importOpen} title="导入平台订单" onOk={doImport} onCancel={() => setImportOpen(false)} okText="导入" cancelText="取消" width={640}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="shopId" label="归属店铺">
            <Select allowClear placeholder="可选" options={shops.map((s) => ({ label: `${s.name}（${s.platform}）`, value: s.id }))} />
          </Form.Item>
          <Form.Item name="data" label="平台订单数据（JSON 数组）" rules={[{ required: true, message: '请粘贴订单数据' }]}
            extra={'格式：[{"platformOrderNo":"平台单号","customerName":"客户","amount":100,"orderTime":"2026-11-20","itemSummary":"商品摘要"}]'}>
            <Input.TextArea rows={10} placeholder='[{"platformOrderNo":"SO-2026-001","customerName":"张三","amount":199,"orderTime":"2026-11-20","itemSummary":"蓝牙耳机 x2"}]' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function OrderSync() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">多平台订单同步</h1>
        <p className="page-desc">同步配置 → 导入平台订单 → 一键转销售订单，全链路状态可追踪</p>
      </div>
      <Tabs items={[
        { key: 'orders', label: '订单与同步', children: <PlatformOrders /> },
        { key: 'config', label: '同步配置', children: <CrudPage collection="syncConfigs" title="同步配置" desc="配置各店铺的同步参数（自动同步需平台 API 授权）" fields={configFields} columns={configColumns} /> },
      ]} />
    </div>
  )
}
