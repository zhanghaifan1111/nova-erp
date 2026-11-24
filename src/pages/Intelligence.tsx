import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, InputNumber, Card, Row, Col, Statistic, message, Modal, Form, Select, Alert } from 'antd'
import { ReloadOutlined, ShoppingCartOutlined, ThunderboltOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { api, money } from '../api'
import { useAppTheme } from '../theme'
import CrudPage, { Field } from './CrudPage'

const segmentColor: Record<string, string> = {
  重要价值客户: 'red', 重要保持客户: 'orange', 重要发展客户: 'blue', 重要挽留客户: 'purple',
  一般价值客户: 'cyan', 一般保持客户: 'green', 一般发展客户: 'default', 一般挽留客户: 'default',
}

// ============ 智能补货 ============
function Replenish() {
  const [data, setData] = useState<any>({ rows: [], sum: {}, params: {} })
  const [loading, setLoading] = useState(true)
  const [leadDays, setLeadDays] = useState(7)
  const [safetyDays, setSafetyDays] = useState(7)
  const [selected, setSelected] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    api.replenishSuggest(leadDays, safetyDays)
      .then((r: any) => setData(r.data))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load(); api.list('suppliers').then((r) => setSuppliers(r.data)).catch(() => {}) }, [])

  const toPurchase = async () => {
    const v = await form.validateFields()
    try {
      const r: any = await api.replenishToPurchase(selected.map((s) => ({ productId: s.productId, sku: s.sku, name: s.name, qty: s.suggestQty, price: s.costPrice })), v.supplierName)
      message.success(r.message); setSelected([]); setPurchaseOpen(false); load()
    } catch (e: any) { message.error(e.message) }
  }

  const cols = [
    { title: '紧急度', dataIndex: 'urgency', key: 'urgency', width: 90, render: (v: string) => <Tag color={v === '紧急' ? 'error' : v === '偏低' ? 'warning' : 'success'}>{v}</Tag> },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: '商品', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '当前库存', dataIndex: 'stock', key: 'stock', width: 100, align: 'right' as const },
    { title: '在途', dataIndex: 'onWay', key: 'onWay', width: 80, align: 'right' as const },
    { title: '日均销量', dataIndex: 'dailySales', key: 'dailySales', width: 100, align: 'right' as const },
    { title: '可支撑天数', dataIndex: 'coveredDays', key: 'coveredDays', width: 110, align: 'right' as const, render: (v: number) => v === 999 ? '无销量' : `${v} 天` },
    { title: '建议补货', dataIndex: 'suggestQty', key: 'suggestQty', width: 100, align: 'right' as const, render: (v: number) => <b style={{ color: '#f79009' }}>{v}</b> },
    { title: '预计金额', dataIndex: 'suggestAmount', key: 'suggestAmount', width: 110, align: 'right' as const, render: (v: number) => money(v) },
  ]
  const rowSelection = {
    selectedRowKeys: selected.map((s) => s.productId),
    onChange: (_: any, rows: any[]) => setSelected(rows),
  }

  return (
    <div>
      <Alert type="info" showIcon message="补货算法" description={`日均销量（近90天）×（采购提前期 ${leadDays} 天 + 安全天数 ${safetyDays} 天）+ 安全库存 − 当前库存 − 在途采购。越紧急排越前。`} style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="需补货商品" value={data.sum?.items || 0} suffix="种" valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="紧急补货" value={data.sum?.urgent || 0} suffix="种" valueStyle={{ color: '#f04438' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="建议补货金额" value={data.sum?.amount || 0} precision={2} prefix="¥" valueStyle={{ color: '#f79009' }} /></Card></Col>
      </Row>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <span>采购提前期</span><InputNumber min={1} max={90} value={leadDays} onChange={(v) => setLeadDays(Number(v || 7))} style={{ width: 90 }} />
          <span>安全天数</span><InputNumber min={0} max={90} value={safetyDays} onChange={(v) => setSafetyDays(Number(v || 7))} style={{ width: 90 }} />
          <Button icon={<ReloadOutlined />} onClick={load}>重新计算</Button>
        </div>
        <Button type="primary" icon={<ShoppingCartOutlined />} disabled={!selected.length} onClick={() => { form.resetFields(); form.setFieldsValue({ supplierName: suppliers[0]?.name }); setPurchaseOpen(true) }}>生成采购单 ({selected.length})</Button>
      </div>
      <Table columns={cols} dataSource={data.rows} rowKey="productId" loading={loading} size="middle" rowSelection={rowSelection} pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 种` }} />
      <Modal open={purchaseOpen} title={`生成采购单（${selected.length} 项）`} onOk={toPurchase} onCancel={() => setPurchaseOpen(false)} okText="生成" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="supplierName" label="供应商"><Select allowClear placeholder="选填" options={suppliers.map((s: any) => ({ label: s.name, value: s.name }))} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ============ RFM 客户价值 ============
function Rfm() {
  const [data, setData] = useState<any>({ rows: [], groups: {}, total: 0 })
  const [loading, setLoading] = useState(true)
  const { dark } = useAppTheme()

  useEffect(() => {
    api.rfmAnalyze().then((r: any) => setData(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }, [])

  const pieOpt: any = {
    tooltip: { trigger: 'item' },
    legend: { type: 'scroll', orient: 'vertical', right: 0, top: 'center', textStyle: { color: dark ? '#8b93a7' : '#666' } },
    series: [{
      type: 'pie', radius: ['40%', '68%'], center: ['35%', '50%'],
      label: { formatter: '{b}\n{d}%', color: dark ? '#8b93a7' : '#666', fontSize: 10 },
      itemStyle: { borderColor: dark ? '#1f2740' : '#fff', borderWidth: 2 },
      data: Object.entries(data.groups || {}).map(([name, value]) => ({ name, value })),
    }],
  }

  const cols = [
    { title: '客户', dataIndex: 'customerName', key: 'customerName', width: 150 },
    { title: '价值分层', dataIndex: 'segment', key: 'segment', width: 140, render: (v: string) => <Tag color={segmentColor[v] || 'default'}>{v}</Tag> },
    { title: '最近下单(天)', dataIndex: 'recencyDays', key: 'recencyDays', width: 120, align: 'right' as const },
    { title: '订单数', dataIndex: 'frequency', key: 'frequency', width: 90, align: 'right' as const },
    { title: '累计消费', dataIndex: 'monetary', key: 'monetary', width: 120, align: 'right' as const, render: (v: number) => money(v) },
    { title: 'R', dataIndex: 'R', key: 'R', width: 60, align: 'right' as const, render: (v: number) => <Tag color={v >= 4 ? 'success' : v >= 3 ? 'blue' : 'default'}>{v}</Tag> },
    { title: 'F', dataIndex: 'F', key: 'F', width: 60, align: 'right' as const, render: (v: number) => <Tag color={v >= 4 ? 'success' : v >= 3 ? 'blue' : 'default'}>{v}</Tag> },
    { title: 'M', dataIndex: 'M', key: 'M', width: 60, align: 'right' as const, render: (v: number) => <Tag color={v >= 4 ? 'success' : v >= 3 ? 'blue' : 'default'}>{v}</Tag> },
  ]

  return (
    <div>
      <Alert type="info" showIcon message="RFM 客户价值分析" description="R=最近下单距今天数（越近越好）、F=下单频次、M=累计消费金额，各维度打 1-5 分，自动分成 8 类客户。" style={{ marginBottom: 16 }} />
      <Card className="chart-card" styles={{ body: { padding: 16 } }} style={{ marginBottom: 16 }}>
        <ReactECharts option={pieOpt} style={{ height: 280 }} />
      </Card>
      <Table columns={cols} dataSource={data.rows} rowKey="customerId" loading={loading} size="middle" pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 位客户` }} />
    </div>
  )
}

export default function Intelligence() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">智能决策中心</h1>
        <p className="page-desc">智能补货建议 + RFM 客户价值分析，让数据告诉该做什么</p>
      </div>
      <Tabs items={[
        { key: 'replenish', label: '智能补货', children: <Replenish /> },
        { key: 'rfm', label: 'RFM 客户价值', children: <Rfm /> },
      ]} />
    </div>
  )
}
