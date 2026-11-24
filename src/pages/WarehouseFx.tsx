import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, Input, Modal, Form, InputNumber, message, Select, Card, Row, Col, Statistic, Alert, Popconfirm } from 'antd'
import { SearchOutlined, ReloadOutlined, CheckCircleOutlined, DeleteOutlined, CalculatorOutlined, PlusOutlined } from '@ant-design/icons'
import { api, money } from '../api'
import CrudPage, { Field } from './CrudPage'

const pickStatusColor: Record<string, string> = { 待拣货: 'orange', 已拣货: 'success' }

// ============ 拣货单 ============
function PickLists() {
  const [rows, setRows] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [detail, setDetail] = useState<any>(null)

  const load = () => {
    setLoading(true)
    Promise.all([api.list('pickLists'), api.list('salesOrders')])
      .then(([a, b]) => { setRows(a.data); setOrders(b.data) })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const gen = async (id: string) => {
    try { const r: any = await api.pickFromOrder(id); message.success(r.message); load() }
    catch (e: any) { message.error(e.message) }
  }
  const confirm = (id: string) => {
    Modal.confirm({
      title: '确认拣货', content: '确认后拣货单标记为已拣货。',
      okText: '确认', cancelText: '取消',
      onOk: async () => {
        try { const r: any = await api.pickConfirm(id); message.success(r.message); load() }
        catch (e: any) { message.error(e.message) }
      },
    })
  }
  const filtered = keyword.trim()
    ? rows.filter((r) => [r.pickNo, r.orderNo, r.customerName].some((v) => String(v || '').toLowerCase().includes(keyword.toLowerCase())))
    : rows

  const cols = [
    { title: '拣货单号', dataIndex: 'pickNo', key: 'pickNo', width: 170 },
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 140 },
    { title: '客户', dataIndex: 'customerName', key: 'customerName', width: 130 },
    { title: 'SKU 数', key: 'cnt', width: 80, render: (_: any, r: any) => (r.items || []).length },
    { title: '总件数', key: 'totalQty', width: 80, align: 'right' as const, render: (_: any, r: any) => (r.items || []).reduce((s: number, i: any) => s + Number(i.qty || 0), 0) },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={pickStatusColor[v] || 'default'}>{v}</Tag> },
    { title: '拣货日期', dataIndex: 'pickedAt', key: 'pickedAt', width: 110 },
    {
      title: '操作', key: 'action', width: 180,
      render: (_: any, r: any) => (
        <Space size={2}>
          <Button type="link" size="small" onClick={() => setDetail(r)}>明细</Button>
          {r.status === '待拣货' && <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => confirm(r.id)}>确认</Button>}
          <Popconfirm title="删除？" onConfirm={async () => { await api.remove('pickLists', r.id); message.success('已删除'); load() }} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input prefix={<SearchOutlined />} placeholder="搜索拣货单/订单/客户" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 260 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
        <Select style={{ width: 240 }} placeholder="选择订单生成拣货单" optionFilterProp="label" allowClear
          onChange={(v) => v && gen(v)}
          options={orders.map((o) => ({ label: `${o.orderNo} — ${o.customerName || ''}`, value: o.id }))} />
      </div>
      <Table columns={cols} dataSource={filtered} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />
      <Modal open={!!detail} title={`拣货明细 · ${detail?.pickNo || ''}`} onCancel={() => setDetail(null)} footer={null} width={640}>
        <Table size="small" pagination={false} rowKey="sku" dataSource={detail?.items || []}
          columns={[
            { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
            { title: '商品', dataIndex: 'name', key: 'name' },
            { title: '库位', dataIndex: 'location', key: 'location', width: 100, render: (v: string) => v || '-' },
            { title: '拣货数', dataIndex: 'qty', key: 'qty', width: 90, align: 'right' as const, render: (v: number) => <b>{v}</b> },
          ]} />
      </Modal>
    </div>
  )
}

// ============ 汇率管理 ============
const rateFields: Field[] = [
  { name: 'currency', label: '币种代码', required: true, placeholder: '如 USD' },
  { name: 'name', label: '币种名称', placeholder: '如 美元' },
  { name: 'rate', label: '兑人民币汇率', type: 'number', required: true },
  { name: 'updatedAt', label: '更新日期' },
]
const rateCols = [
  { title: '币种', dataIndex: 'currency', key: 'currency', width: 100, render: (v: string) => <Tag color="blue">{v}</Tag> },
  { title: '名称', dataIndex: 'name', key: 'name', width: 120 },
  { title: '兑人民币', dataIndex: 'rate', key: 'rate', width: 130, align: 'right' as const, render: (v: number) => v ?? '-' },
  { title: '更新日期', dataIndex: 'updatedAt', key: 'updatedAt' },
]

function ExchangeRates() {
  const [rates, setRates] = useState<any[]>([])
  const [amount, setAmount] = useState<number>(100)
  const [currency, setCurrency] = useState<string>('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { api.list('exchangeRates').then((r) => { setRates(r.data); setCurrency(r.data[0]?.currency || '') }).catch(() => {}) }, [])

  const convert = async () => {
    if (!currency) { message.warning('请先添加汇率'); return }
    setLoading(true)
    try {
      const r: any = await api.fxConvert(currency, amount)
      setResult(r.data)
    } catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <Alert type="info" showIcon message="汇率说明" description="录入各币种兑人民币的汇率（1 外币 = X 人民币），用于报价和利润核算。汇率需按实际银行/平台牌价手动更新。" style={{ marginBottom: 16 }} />
      <Card className="chart-card" title="快速换算" styles={{ body: { padding: 20 } }}>
        <Space size={12} wrap>
          <InputNumber value={amount} onChange={(v) => setAmount(Number(v || 0))} min={0} precision={2} style={{ width: 160 }} prefix="¥外币" />
          <Select value={currency} onChange={setCurrency} style={{ width: 140 }}
            options={rates.map((r) => ({ label: r.currency, value: r.currency }))} />
          <Button type="primary" icon={<CalculatorOutlined />} loading={loading} onClick={convert}>换算人民币</Button>
          {result && <span style={{ fontSize: 16 }}>≈ <b style={{ color: '#16b364' }}>{money(result.cny)}</b> <span style={{ color: '#888', fontSize: 12 }}>(汇率 {result.rate})</span></span>}
        </Space>
      </Card>
      <div style={{ height: 16 }} />
      <CrudPage collection="exchangeRates" title="汇率管理" desc="维护各币种兑人民币汇率" fields={rateFields} columns={rateCols} />
    </div>
  )
}

export default function WarehouseFx() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">拣货单 · 汇率管理</h1>
        <p className="page-desc">从订单生成拣货单加速仓库作业，多币种汇率换算辅助报价</p>
      </div>
      <Tabs items={[
        { key: 'pick', label: '拣货单', children: <PickLists /> },
        { key: 'fx', label: '汇率管理', children: <ExchangeRates /> },
      ]} />
    </div>
  )
}
