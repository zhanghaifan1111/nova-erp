import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, Input, Modal, Form, Select, InputNumber, DatePicker, message, Popconfirm, Alert, Row, Col, Card, Statistic } from 'antd'
import { CheckCircleOutlined, ReloadOutlined, CalculatorOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api, money } from '../api'
import CrudPage, { Field } from './CrudPage'

const asStatusColor: Record<string, string> = { 待处理: 'orange', 处理中: 'blue', 已完成: 'success', 已取消: 'default' }
const asTypeColor: Record<string, string> = { 退货: 'error', 换货: 'orange', 维修: 'blue', 其他: 'default' }

// ============ 售后服务 ============
function AfterSales() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    api.list('afterSales').then((r) => setRows(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  const process = (id: string, status: string) => {
    Modal.confirm({
      title: `确认标记为「${status}」？`,
      okText: '确认', cancelText: '取消',
      onOk: async () => {
        try { const r: any = await api.afterSalesProcess(id, status); message.success(r.message); load() }
        catch (e: any) { message.error(e.message) }
      },
    })
  }
  const cols = [
    { title: '工单号', dataIndex: 'asNo', key: 'asNo', width: 150 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 90, render: (v: string) => <Tag color={asTypeColor[v]}>{v}</Tag> },
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 130 },
    { title: '客户', dataIndex: 'customerName', key: 'customerName', width: 120 },
    { title: '商品', dataIndex: 'productName', key: 'productName', ellipsis: true },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: '方案', dataIndex: 'solution', key: 'solution', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={asStatusColor[v] || 'default'}>{v}</Tag> },
    { title: '申请日期', dataIndex: 'applyDate', key: 'applyDate', width: 110 },
    {
      title: '操作', key: 'action', width: 140,
      render: (_: any, r: any) => {
        if (['已完成', '已取消'].includes(r.status)) return <Tag color="success">已结束</Tag>
        return <Space size={2}>
          {r.status === '待处理' && <Button type="link" size="small" onClick={() => process(r.id, '处理中')}>受理</Button>}
          <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => process(r.id, '已完成')}>完成</Button>
        </Space>
      },
    },
  ]
  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="售后工单" value={rows.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="待处理" value={rows.filter((r) => r.status === '待处理').length} valueStyle={{ color: '#f79009' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="处理中" value={rows.filter((r) => r.status === '处理中').length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
      </Row>
      <Alert type="info" showIcon message="售后流程" description="登记工单 → 受理（处理中）→ 完成。支持退货/换货/维修，全程记录原因和处理方案。" style={{ marginBottom: 16 }} />
      <CrudPage collection="afterSales" title="售后工单" desc="退换货与维修工单管理" fields={[
        { name: 'asNo', label: '工单号', required: true, placeholder: '如 AS-001' },
        { name: 'type', label: '类型', type: 'select', options: ['退货', '换货', '维修', '其他'].map((v) => ({ label: v, value: v })) },
        { name: 'orderNo', label: '关联订单号' },
        { name: 'customerName', label: '客户' },
        { name: 'productName', label: '商品', span: 2 },
        { name: 'reason', label: '申请原因', span: 2 },
        { name: 'quantity', label: '数量', type: 'number' },
        { name: 'applyDate', label: '申请日期' },
        { name: 'status', label: '状态', type: 'select', options: ['待处理', '处理中', '已完成', '已取消'].map((v) => ({ label: v, value: v })) },
      ]} columns={cols} extraActions={(r: any, reload: () => void) =>
        !['已完成', '已取消'].includes(r.status)
          ? <Button type="link" size="small" onClick={() => process(r.id, '处理中')}>受理</Button>
          : <Tag color="success">已结束</Tag>
      } />
    </div>
  )
}

// ============ 组合商品 BOM ============
function Bom() {
  const [bundles, setBundles] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [calcOpen, setCalcOpen] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [qty, setQty] = useState(1)
  const [form] = Form.useForm()

  const load = () => {
    Promise.all([api.list('bundles'), api.list('products')]).then(([a, b]) => { setBundles(a.data); setProducts(b.data) }).catch((e) => message.error(e.message))
  }
  useEffect(() => { load() }, [])

  const calc = async () => {
    try { const r: any = await api.bomCalc(calcOpen.id, qty); setResult(r.data) }
    catch (e: any) { message.error(e.message) }
  }

  const cols = [
    { title: '套装名称', dataIndex: 'name', key: 'name', width: 180 },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 130 },
    { title: '售价', dataIndex: 'price', key: 'price', width: 110, align: 'right' as const, render: (v: number) => money(v) },
    { title: '子商品数', dataIndex: 'items', key: 'items', width: 100, render: (v: any[]) => (v || []).length + ' 项' },
    { title: '操作', key: 'action', width: 100, render: (_: any, r: any) => <Button type="link" size="small" icon={<CalculatorOutlined />} onClick={() => { setCalcOpen(r); setResult(null); setQty(1) }}>库存换算</Button> },
  ]

  return (
    <div>
      <Alert type="info" showIcon message="组合商品 BOM" description="一个套装由多个子商品组成。库存换算会按套装数量计算各子商品需求量、可组装套数和成本。" style={{ marginBottom: 16 }} />
      <CrudPage collection="bundles" title="组合商品" desc="套装商品与物料清单（BOM）" fields={[
        { name: 'name', label: '套装名称', required: true },
        { name: 'sku', label: '套装SKU', required: true },
        { name: 'price', label: '售价', type: 'number' },
        { name: 'items', label: '子商品（JSON数组，字段 productId/sku/name/qty）', span: 2, placeholder: '[{"productId":"...","sku":"SKU-1","name":"商品1","qty":2}]' },
      ]} columns={cols} />
      <Modal open={!!calcOpen} title={`库存换算 · ${calcOpen?.name || ''}`} onCancel={() => setCalcOpen(null)} footer={null} width={720}>
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <span>套装数量：</span><InputNumber min={1} value={qty} onChange={(v) => setQty(Number(v || 1))} /> <Button type="primary" onClick={calc} style={{ marginLeft: 12 }}>计算</Button>
        </div>
        {result && <>
          <Alert type={result.canAssemble ? 'success' : 'error'} showIcon
            message={result.canAssemble ? `可以组装，最多 ${result.maxSets} 套` : '子商品库存不足，无法组装'}
            description={`成本合计 ${money(result.costTotal)}`} style={{ marginBottom: 16 }} />
          <Table size="small" pagination={false} rowKey="productId" dataSource={result.rows}
            columns={[
              { title: 'SKU', dataIndex: 'sku', key: 'sku' },
              { title: '商品', dataIndex: 'name', key: 'name' },
              { title: '每套用量', dataIndex: 'perSet', key: 'perSet', align: 'right' as const },
              { title: '需求数', dataIndex: 'needed', key: 'needed', align: 'right' as const },
              { title: '现有库存', dataIndex: 'stock', key: 'stock', align: 'right' as const },
              { title: '成本', dataIndex: 'cost', key: 'cost', align: 'right' as const, render: (v: number) => money(v) },
              { title: '状态', dataIndex: 'enough', key: 'enough', render: (v: boolean) => <Tag color={v ? 'success' : 'error'}>{v ? '充足' : '不足'}</Tag> },
            ]} />
        </>}
      </Modal>
    </div>
  )
}

export default function ServiceBom() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">售后服务 · 组合商品</h1>
        <p className="page-desc">退换工单全流程 + 套装BOM库存换算</p>
      </div>
      <Tabs items={[
        { key: 'as', label: '售后服务', children: <AfterSales /> },
        { key: 'bom', label: '组合商品 BOM', children: <Bom /> },
      ]} />
    </div>
  )
}
