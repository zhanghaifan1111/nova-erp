import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, message, Alert, Row, Col, Card, Statistic, Progress } from 'antd'
import { DollarOutlined, SwapOutlined, ReloadOutlined } from '@ant-design/icons'
import { api, money } from '../api'
import CrudPage, { Field } from './CrudPage'

const healthColor: Record<string, string> = { 优秀: 'success', 良好: 'blue', 一般: 'orange', 亏损: 'error', 无数据: 'default' }

// ============ 广告 ROI ============
function AdsRoi() {
  const [data, setData] = useState<any>({ rows: [], sum: {} })
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    api.adsRoi().then((r: any) => setData(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const cols = [
    { title: '广告活动', dataIndex: 'name', key: 'name', width: 160 },
    { title: '平台', dataIndex: 'platform', key: 'platform', width: 100, render: (v: string) => <Tag color="blue">{v || '-'}</Tag> },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 110 },
    { title: '花费', dataIndex: 'spend', key: 'spend', width: 110, align: 'right' as const, render: (v: number) => money(v) },
    { title: '广告销售额', dataIndex: 'adSales', key: 'adSales', width: 120, align: 'right' as const, render: (v: number) => money(v) },
    { title: '订单', dataIndex: 'orders', key: 'orders', width: 70, align: 'right' as const },
    { title: 'CPC', dataIndex: 'cpc', key: 'cpc', width: 90, align: 'right' as const, render: (v: number | null) => v == null ? '-' : money(v) },
    { title: 'ACOS', dataIndex: 'acos', key: 'acos', width: 90, align: 'right' as const, render: (v: number | null) => v == null ? '-' : <b style={{ color: v <= 35 ? '#16b364' : '#f04438' }}>{v}%</b> },
    { title: 'ROAS', dataIndex: 'roas', key: 'roas', width: 90, align: 'right' as const, render: (v: number | null) => v == null ? '-' : `${v}x` },
    { title: '健康度', dataIndex: 'health', key: 'health', width: 90, render: (v: string) => <Tag color={healthColor[v]}>{v}</Tag> },
  ]

  return (
    <div>
      <Alert type="info" showIcon message="广告投放指标" description="ACOS=花费/广告销售额（越低越好，≤20%优秀）；ROAS=广告销售额/花费（越高越好）；CPC=平均点击成本。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="广告总花费" value={data.sum?.spend || 0} precision={2} prefix="¥" valueStyle={{ color: '#f04438' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="广告销售额" value={data.sum?.adSales || 0} precision={2} prefix="¥" valueStyle={{ color: '#16b364' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="整体 ACOS" value={data.sum?.acos ?? '-'} suffix={data.sum?.acos != null ? '%' : ''} valueStyle={{ color: (data.sum?.acos || 0) <= 35 ? '#16b364' : '#f04438' }} /></Card></Col>
      </Row>
      <div className="table-toolbar">
        <div className="table-toolbar-left"><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button></div>
      </div>
      <CrudPage collection="adCampaigns" title="广告活动" desc="登记各平台广告投放数据" fields={[
        { name: 'name', label: '活动名称', required: true },
        { name: 'platform', label: '平台', type: 'select', options: ['Shopee', 'Amazon', 'TikTok', 'Temu', '其他'].map((v) => ({ label: v, value: v })) },
        { name: 'sku', label: 'SKU' },
        { name: 'spend', label: '广告花费', type: 'number', required: true },
        { name: 'clicks', label: '点击数', type: 'number' },
        { name: 'orders', label: '订单数', type: 'number' },
        { name: 'adSales', label: '广告销售额（选填，留空从订单算）', type: 'number' },
      ]} columns={cols} />
    </div>
  )
}

// ============ 智能调拨 ============
function Transfer() {
  const [data, setData] = useState<any>({ rows: [] })
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.transferSuggest().then((r: any) => setData(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }, [])
  const cols = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: '商品', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '近30天销量', dataIndex: 'demand', key: 'demand', width: 110, align: 'right' as const },
    { title: '调出仓', dataIndex: 'fromWarehouse', key: 'fromWarehouse', width: 120 },
    { title: '调出库存', dataIndex: 'fromQty', key: 'fromQty', width: 90, align: 'right' as const },
    { title: '调入仓', dataIndex: 'toWarehouse', key: 'toWarehouse', width: 120 },
    { title: '调入库存', dataIndex: 'toQty', key: 'toQty', width: 90, align: 'right' as const },
    { title: '建议调拨', dataIndex: 'suggestQty', key: 'suggestQty', width: 100, align: 'right' as const, render: (v: number) => <b style={{ color: '#f79009' }}>{v}</b> },
    { title: '依据', dataIndex: 'reason', key: 'reason', ellipsis: true },
  ]
  return (
    <div>
      <Alert type="info" showIcon message="智能调拨建议" description="按各仓库存与近30天销量，找出「一仓积压、一仓缺货」的商品，建议调拨数量。需至少两个仓且有库存分布数据。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="建议调拨商品" value={data.rows.length} suffix="种" valueStyle={{ color: '#4f6ef7' }} prefix={<SwapOutlined />} /></Card></Col>
        <Col xs={24} sm={12}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="仓库数" value={data.warehouses || 0} valueStyle={{ color: '#16b364' }} /></Card></Col>
      </Row>
      <Table columns={cols} dataSource={data.rows} rowKey="sku" loading={loading} size="middle" pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条建议` }} />
    </div>
  )
}

export default function AdsTransfer() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">广告 ROI · 智能调拨</h1>
        <p className="page-desc">看清每分广告费的效果，自动发现多仓库存不平衡</p>
      </div>
      <Tabs items={[
        { key: 'ads', label: '广告 ROI 分析', children: <AdsRoi /> },
        { key: 'transfer', label: '智能调拨建议', children: <Transfer /> },
      ]} />
    </div>
  )
}
