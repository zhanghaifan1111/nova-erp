import React, { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Button, Space, InputNumber, DatePicker, Input, Select, Modal, Form, message, Tabs, Alert } from 'antd'
import { DollarOutlined, WalletOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api, money } from '../api'

const statusColor: Record<string, string> = { 待拣货: 'orange', 已拣货: 'success' }

// ============ 应收应付台账 ============
function Ledger() {
  const [data, setData] = useState<any>({ rows: [], sum: {} })
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [payOpen, setPayOpen] = useState<any>(null)
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    api.paymentsLedger()
      .then((r) => setData(r.data))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const submit = async () => {
    const v = await form.validateFields()
    try {
      const r: any = await api.paymentRecord({
        direction: payOpen.type === '应收' ? '收款' : '付款',
        relatedNo: payOpen.relatedNo,
        amount: Number(v.amount),
        method: v.method,
        date: v.date ? dayjs(v.date).format('YYYY-MM-DD') : undefined,
        note: v.note,
      })
      message.success(r.message); setPayOpen(null); form.resetFields(); load()
    } catch (e: any) { message.error(e.message) }
  }

  const filtered = keyword.trim()
    ? data.rows.filter((r: any) => [r.relatedNo, r.party].some((v) => String(v || '').toLowerCase().includes(keyword.toLowerCase())))
    : data.rows

  const cols = [
    { title: '类型', dataIndex: 'type', key: 'type', width: 80, render: (v: string) => <Tag color={v === '应收' ? 'blue' : 'orange'}>{v}</Tag> },
    { title: '关联单号', dataIndex: 'relatedNo', key: 'relatedNo', width: 150 },
    { title: '客户/供应商', dataIndex: 'party', key: 'party', width: 150 },
    { title: '单据金额', dataIndex: 'total', key: 'total', align: 'right' as const, width: 120, render: (v: number) => money(v) },
    { title: '已结清', dataIndex: 'settled', key: 'settled', align: 'right' as const, width: 120, render: (v: number) => money(v) },
    { title: '未结清', dataIndex: 'balance', key: 'balance', align: 'right' as const, width: 120, render: (v: number) => <b style={{ color: '#f04438' }}>{money(v)}</b> },
    { title: '日期', dataIndex: 'date', key: 'date', width: 110 },
    {
      title: '操作', key: 'action', width: 110,
      render: (_: any, r: any) => (
        <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => {
          setPayOpen(r); form.resetFields()
          form.setFieldsValue({ amount: r.balance, date: dayjs(), method: '银行转账' })
        }}>{r.type === '应收' ? '登记收款' : '登记付款'}</Button>
      ),
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="应收未收" value={data.sum?.receivable || 0} precision={2} prefix="¥" valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={12}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="应付未付" value={data.sum?.payable || 0} precision={2} prefix="¥" valueStyle={{ color: '#f04438' }} /></Card></Col>
      </Row>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input prefix={<SearchOutlined />} placeholder="搜索单号/客户/供应商" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
      </div>
      <Table columns={cols} dataSource={filtered} rowKey={(r: any) => r.type + r.relatedNo} loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />
      <Modal open={!!payOpen} title={`${payOpen?.type === '应收' ? '登记收款' : '登记付款'} · ${payOpen?.relatedNo || ''}`} onOk={submit} onCancel={() => setPayOpen(null)} okText="确认登记" cancelText="取消">
        {payOpen && (
          <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
            <Alert type="info" showIcon message={`未结清：${money(payOpen.balance)}（单据 ${money(payOpen.total)}，已结 ${money(payOpen.settled)}）`} style={{ marginBottom: 16 }} />
            <Form.Item name="amount" label="本次金额" rules={[{ required: true, message: '请输入金额' }]}>
              <InputNumber min={0.01} precision={2} style={{ width: '100%' }} prefix="¥" />
            </Form.Item>
            <Form.Item name="method" label="方式">
              <Select options={['银行转账', '现金', '支付宝', '微信', 'PayPal', '其他'].map((v) => ({ label: v, value: v }))} />
            </Form.Item>
            <Form.Item name="date" label="日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="note" label="备注"><Input.TextArea rows={2} placeholder="选填" /></Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}

// ============ 资金流水 ============
function PaymentLogs() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.list('payments').then((r) => setRows(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }, [])
  const cols = [
    { title: '日期', dataIndex: 'date', key: 'date', width: 120 },
    { title: '方向', dataIndex: 'direction', key: 'direction', width: 90, render: (v: string) => <Tag color={v === '收款' ? 'success' : 'orange'}>{v}</Tag> },
    { title: '关联单号', dataIndex: 'relatedNo', key: 'relatedNo', width: 150 },
    { title: '客户/供应商', dataIndex: 'party', key: 'party', width: 140 },
    { title: '金额', dataIndex: 'amount', key: 'amount', width: 120, align: 'right' as const, render: (v: number, r: any) => <b style={{ color: r.direction === '收款' ? '#16b364' : '#f04438' }}>{r.direction === '收款' ? '+' : '-'}{money(v)}</b> },
    { title: '方式', dataIndex: 'method', key: 'method', width: 110 },
    { title: '备注', dataIndex: 'note', key: 'note', ellipsis: true },
  ]
  return <Table columns={cols} dataSource={rows} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />
}

export default function Payments() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">收付款管理</h1>
        <p className="page-desc">应收应付台账、收付款登记核销、资金流水，支持部分收付</p>
      </div>
      <Tabs items={[
        { key: 'ledger', label: '应收应付', children: <Ledger /> },
        { key: 'logs', label: '资金流水', children: <PaymentLogs /> },
      ]} />
    </div>
  )
}
