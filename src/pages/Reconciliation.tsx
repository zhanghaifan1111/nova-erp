import React, { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Input, Modal, Form, message, Alert, Row, Col, Card, Statistic, Tabs } from 'antd'
import { SearchOutlined, ReloadOutlined, ImportOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { api, money } from '../api'
import CrudPage, { Field } from './CrudPage'

const statusColor: Record<string, string> = { 已对平: 'success', 有差异: 'error', 未匹配: 'orange' }

function ReconcilePanel() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    api.list('settlements').then((r) => setRows(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const doImport = async () => {
    const v = await form.validateFields()
    let parsed: any[]
    try { parsed = JSON.parse(v.data) } catch { message.error('JSON 格式错误'); return }
    if (!Array.isArray(parsed) || !parsed.length) { message.warning('数组为空'); return }
    try {
      const r: any = await api.settleReconcile(parsed)
      message.success(r.message); setImportOpen(false); form.resetFields(); load()
    } catch (e: any) { message.error(e.message) }
  }

  const filtered = keyword.trim()
    ? rows.filter((r) => [r.orderNo, r.settlementNo, r.shopName].some((v) => String(v || '').includes(keyword)))
    : rows
  const matched = rows.filter((r) => r.status === '已对平')
  const diffRows = rows.filter((r) => r.status !== '已对平')

  const cols = [
    { title: '结算单号', dataIndex: 'settlementNo', key: 'settlementNo', width: 150 },
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 130 },
    { title: '平台/店铺', key: 'shop', width: 130, render: (_: any, r: any) => r.shopName || r.platform || '-' },
    { title: '销售额', dataIndex: 'salesAmount', key: 'salesAmount', width: 110, align: 'right' as const, render: (v: number) => money(v) },
    { title: '佣金', dataIndex: 'commission', key: 'commission', width: 100, align: 'right' as const, render: (v: number) => <span style={{ color: '#f04438' }}>-{money(v)}</span> },
    { title: '广告费', dataIndex: 'adFee', key: 'adFee', width: 100, align: 'right' as const, render: (v: number) => <span style={{ color: '#f04438' }}>-{money(v)}</span> },
    { title: '退款', dataIndex: 'refund', key: 'refund', width: 100, align: 'right' as const, render: (v: number) => <span style={{ color: '#f04438' }}>-{money(v)}</span> },
    { title: '平台实收', dataIndex: 'actualAmount', key: 'actualAmount', width: 110, align: 'right' as const, render: (v: number) => <b style={{ color: '#16b364' }}>{money(v)}</b> },
    { title: '系统金额', dataIndex: 'systemAmount', key: 'systemAmount', width: 110, align: 'right' as const, render: (v: number) => money(v) },
    { title: '差异', dataIndex: 'diff', key: 'diff', width: 100, align: 'right' as const, render: (v: number | null) => v === null ? '-' : <b style={{ color: Math.abs(v) < 0.01 ? '#16b364' : '#f04438' }}>{v > 0 ? '+' : ''}{v.toFixed(2)}</b> },
    { title: '对账状态', dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag> },
    { title: '结算日', dataIndex: 'settleDate', key: 'settleDate', width: 110 },
  ]

  return (
    <div>
      <Alert type="info" showIcon message="对账逻辑" description="导入平台结算单后按订单号关联系统销售订单。差异 = 系统订单金额 − 平台销售额（佣金/广告/退款是平台正常扣费，不算差异）。平台实收 = 销售额 − 佣金 − 广告费 − 退款，单独展示。差异超 0.01 标记「有差异」，关联不到订单标记「未匹配」。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="结算单总数" value={rows.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="已对平" value={matched.length} valueStyle={{ color: '#16b364' }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="有差异/未匹配" value={diffRows.length} valueStyle={{ color: '#f04438' }} prefix={<WarningOutlined />} /></Card></Col>
      </Row>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input prefix={<SearchOutlined />} placeholder="搜索订单号/结算单/店铺" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 260 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
        <Button type="primary" icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>导入结算单</Button>
      </div>
      <Table columns={cols} dataSource={filtered} rowKey="id" loading={loading} size="middle" scroll={{ x: 1400 }} pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} />

      <Modal open={importOpen} title="导入平台结算单" onOk={doImport} onCancel={() => setImportOpen(false)} okText="对账" cancelText="取消" width={700}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="data" label="结算单数据（JSON 数组）" rules={[{ required: true, message: '请粘贴结算单数据' }]}
            extra={'格式：[{"settlementNo":"结算单号","orderNo":"系统订单号","shopName":"店铺","salesAmount":100,"commission":15,"adFee":5,"refund":0}]'}>
            <Input.TextArea rows={10} placeholder='[{"settlementNo":"ST-001","orderNo":"SO202600001","shopName":"Shopee店","salesAmount":100,"commission":15,"adFee":5,"refund":0}]' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function Reconciliation() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">平台结算对账</h1>
        <p className="page-desc">把平台打款和系统订单对上，佣金/广告/退款一目了然，差异自动标记</p>
      </div>
      <Tabs items={[
        { key: 'recon', label: '对账明细', children: <ReconcilePanel /> },
        { key: 'history', label: '结算记录', children: <CrudPage collection="settlements" title="结算记录" desc="所有平台结算单记录" fields={[
          { name: 'settlementNo', label: '结算单号', required: true },
          { name: 'orderNo', label: '订单号' },
          { name: 'platform', label: '平台' },
          { name: 'actualAmount', label: '实收金额', type: 'number' },
          { name: 'status', label: '状态', type: 'select', options: ['已对平', '有差异', '未匹配'].map((v) => ({ label: v, value: v })) },
        ]} columns={[
          { title: '结算单号', dataIndex: 'settlementNo', key: 'settlementNo' },
          { title: '订单号', dataIndex: 'orderNo', key: 'orderNo' },
          { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag> },
        ]} /> },
      ]} />
    </div>
  )
}
