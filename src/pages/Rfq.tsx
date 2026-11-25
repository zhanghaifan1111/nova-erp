import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, message, Modal, Form, Input, InputNumber, Select, Popconfirm, Alert, Row, Col, Card, Statistic, Descriptions } from 'antd'
import { TrophyOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { api, money } from '../api'
import CrudPage, { Field } from './CrudPage'

const rfqStatusColor: Record<string, string> = { 询价中: 'blue', 已完成: 'success', 已取消: 'default' }

function RfqCenter() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any>(null)
  const [compare, setCompare] = useState<any>(null)
  const [quoteForm] = Form.useForm()
  const [quoteOpen, setQuoteOpen] = useState(false)

  const load = () => {
    setLoading(true)
    api.list('rfqs').then((r) => setRows(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const openDetail = async (r: any) => {
    setDetail(r)
    try { const c: any = await api.rfqCompare(r.id); setCompare(c.data) } catch { setCompare(null) }
  }
  const addQuote = async () => {
    const v = await quoteForm.validateFields()
    const quotes = [...(detail.quotes || []), { id: 'q_' + Date.now().toString().slice(-6), ...v, unitPrice: Number(v.unitPrice), leadDays: Number(v.leadDays || 0) }]
    try {
      await api.update('rfqs', detail.id, { quotes })
      message.success('报价已录入'); setQuoteOpen(false); quoteForm.resetFields()
      const c: any = await api.rfqCompare(detail.id); setCompare(c.data)
      const fresh = (await api.list('rfqs')).data.find((x: any) => x.id === detail.id); setDetail(fresh); load()
    } catch (e: any) { message.error(e.message) }
  }
  const award = (quoteId: string) => {
    Modal.confirm({
      title: '确认授标', content: '授予该供应商并生成采购单（状态待审批）。', okText: '确认', cancelText: '取消',
      onOk: async () => {
        try { const r: any = await api.rfqAward(detail.id, quoteId); message.success(r.message); setDetail(null); load() }
        catch (e: any) { message.error(e.message) }
      },
    })
  }

  const cols = [
    { title: '询价单号', dataIndex: 'rfqNo', key: 'rfqNo', width: 150 },
    { title: '商品', dataIndex: 'productName', key: 'productName', ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: '数量', dataIndex: 'qty', key: 'qty', width: 80, align: 'right' as const },
    { title: '报价数', dataIndex: 'quotes', key: 'quotes', width: 90, render: (v: any[]) => (v || []).length + ' 家' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={rfqStatusColor[v] || 'default'}>{v}</Tag> },
    { title: '中标供应商', dataIndex: 'awardedSupplier', key: 'awardedSupplier', width: 130 },
    { title: '操作', key: 'action', width: 100, render: (_: any, r: any) => <Button type="link" size="small" onClick={() => openDetail(r)}>比价</Button> },
  ]

  return (
    <div>
      <Alert type="info" showIcon message="询价比价流程" description="建询价单 → 录入多家报价 → 系统按总价排序 → 选中标自动生成采购单（待审批）" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="询价单" value={rows.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="询价中" value={rows.filter((r) => r.status === '询价中').length} valueStyle={{ color: '#f79009' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="已完成" value={rows.filter((r) => r.status === '已完成').length} valueStyle={{ color: '#16b364' }} /></Card></Col>
      </Row>
      <div className="table-toolbar">
        <div className="table-toolbar-left"><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button></div>
      </div>
      <CrudPage collection="rfqs" title="询价单" desc="发起询价，录入报价，比价授标" fields={[
        { name: 'rfqNo', label: '询价单号', required: true, placeholder: '如 RFQ-001' },
        { name: 'productName', label: '商品名称', required: true },
        { name: 'sku', label: 'SKU' },
        { name: 'qty', label: '询价数量', type: 'number', required: true },
        { name: 'deadline', label: '报价截止日' },
        { name: 'status', label: '状态', type: 'select', options: [{ label: '询价中', value: '询价中' }, { label: '已完成', value: '已完成' }, { label: '已取消', value: '已取消' }] },
      ]} columns={cols} extraActions={(r: any, reload: () => void) => <Button type="link" size="small" onClick={() => openDetail(r)}>比价</Button>} />

      <Modal open={!!detail} title={`比价 · ${detail?.rfqNo || ''}`} onCancel={() => setDetail(null)} footer={null} width={800}>
        {detail && <>
          <Descriptions size="small" bordered column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="商品">{detail.productName}</Descriptions.Item>
            <Descriptions.Item label="数量">{detail.qty}</Descriptions.Item>
          </Descriptions>
          <div className="table-toolbar">
            <div className="table-toolbar-left"><span style={{ color: '#888' }}>共 {(detail.quotes || []).length} 家报价，按总价从低到高</span></div>
            <Button type="primary" icon={<PlusOutlined />} disabled={detail.status === '已完成'} onClick={() => setQuoteOpen(true)}>录入报价</Button>
          </div>
          <Table size="small" pagination={false} rowKey="id" dataSource={compare?.rows || detail.quotes || []}
            columns={[
              { title: '排名', key: 'rank', width: 60, render: (_: any, r: any, i: number) => i === 0 ? <Tag color="gold"><TrophyOutlined /> 最低</Tag> : `#${i + 1}` },
              { title: '供应商', dataIndex: 'supplierName', key: 'supplierName' },
              { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', align: 'right' as const, render: (v: number) => money(v) },
              { title: '总价', dataIndex: 'totalAmount', key: 'totalAmount', align: 'right' as const, render: (v: number, r: any) => <b style={{ color: '#16b364' }}>{money(v ?? Number(r.unitPrice || 0) * Number(detail.qty || 1))}</b> },
              { title: '交期(天)', dataIndex: 'leadDays', key: 'leadDays', width: 90, align: 'right' as const },
              { title: '备注', dataIndex: 'note', key: 'note', ellipsis: true },
              { title: '操作', key: 'action', width: 90, render: (_: any, r: any) => detail.status !== '已完成' ? <Button type="link" size="small" onClick={() => award(r.id)}>授标</Button> : (detail.awardedQuoteId === r.id ? <Tag color="success">中标</Tag> : null) },
            ]} />
        </>}
      </Modal>

      <Modal open={quoteOpen} title="录入报价" onOk={addQuote} onCancel={() => setQuoteOpen(false)} okText="保存" cancelText="取消">
        <Form form={quoteForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="supplierName" label="供应商" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="unitPrice" label="单价" rules={[{ required: true }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="leadDays" label="交期（天）"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="note" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function Rfq() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">供应商询价比价</h1>
        <p className="page-desc">一次询价多家报价，系统比价排序，选中标自动转采购单</p>
      </div>
      <RfqCenter />
    </div>
  )
}
