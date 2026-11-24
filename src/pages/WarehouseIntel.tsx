import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, message, Modal, Form, InputNumber, Input, Select, Row, Col, Card, Statistic, Alert } from 'antd'
import { PlusOutlined, ReloadOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { api, money } from '../api'
import { useAppTheme } from '../theme'
import CrudPage, { Field } from './CrudPage'

// ============ 库位管理 ============
const locationFields: Field[] = [
  { name: 'code', label: '库位编码', required: true },
  { name: 'warehouseName', label: '所属仓库' },
  { name: 'zone', label: '区域' },
  { name: 'rack', label: '货架', type: 'number' },
  { name: 'level', label: '层', type: 'number' },
  { name: 'productSku', label: '存放商品SKU' },
  { name: 'status', label: '状态', type: 'select', options: [{ label: '空闲', value: '空闲' }, { label: '已占用', value: '已占用' }] },
]
const locationCols = [
  { title: '库位编码', dataIndex: 'code', key: 'code', width: 130, render: (v: string) => <Tag color="blue">{v}</Tag> },
  { title: '仓库', dataIndex: 'warehouseName', key: 'warehouseName', width: 140 },
  { title: '区域', dataIndex: 'zone', key: 'zone', width: 90 },
  { title: '货架', dataIndex: 'rack', key: 'rack', width: 70, align: 'right' as const },
  { title: '层', dataIndex: 'level', key: 'level', width: 60, align: 'right' as const },
  { title: '存放商品', dataIndex: 'productSku', key: 'productSku' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={v === '已占用' ? 'orange' : 'success'}>{v}</Tag> },
]

function Locations() {
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [genOpen, setGenOpen] = useState(false)
  const [form] = Form.useForm()
  const [key, setKey] = useState(0)
  useEffect(() => { api.list('warehouses').then((r) => setWarehouses(r.data)).catch(() => {}) }, [])

  const generate = async () => {
    const v = await form.validateFields()
    const wh = warehouses.find((w) => w.id === v.warehouseId)
    try {
      const r: any = await api.locationGenerate({ ...v, warehouseName: wh?.name || '' })
      message.success(r.message); setGenOpen(false); form.resetFields(); setKey((k) => k + 1)
    } catch (e: any) { message.error(e.message) }
  }

  return (
    <div>
      <div className="table-toolbar">
        <div className="table-toolbar-left"><span style={{ color: '#888' }}>按仓库批量生成库位（编码格式：区-架-层），可给商品指定库位</span></div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenOpen(true)} disabled={!warehouses.length}>批量生成库位</Button>
      </div>
      <CrudPage key={key} collection="locations" title="库位管理" desc="仓库 → 区域 → 货架 → 层，精细化管理库存位置" fields={locationFields} columns={locationCols} />
      <Modal open={genOpen} title="批量生成库位" onOk={generate} onCancel={() => setGenOpen(false)} okText="生成" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} initialValues={{ zones: 2, racksPerZone: 3, levelsPerRack: 3 }}>
          <Form.Item name="warehouseId" label="仓库" rules={[{ required: true, message: '请选择仓库' }]}>
            <Select options={warehouses.map((w) => ({ label: w.name, value: w.id }))} />
          </Form.Item>
          <Form.Item name="zones" label="区域数"><InputNumber min={1} max={20} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="racksPerZone" label="每区域货架数"><InputNumber min={1} max={20} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="levelsPerRack" label="每货架层数"><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item>
          <Alert type="info" showIcon message="将生成 区域数×货架数×层数 个库位，已存在的会跳过" style={{ marginTop: 8 }} />
        </Form>
      </Modal>
    </div>
  )
}

// ============ 销售预测 ============
function Forecast() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { dark } = useAppTheme()

  useEffect(() => {
    api.forecastSales().then((r: any) => setData(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }, [])

  const axisColor = dark ? '#8b93a7' : '#666'
  const splitColor = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'
  const months = [...(data?.actual || []).map((a: any) => a.month), ...(data?.forecasts || []).map((f: any) => f.month)]
  const opt: any = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['实际销售额', '预测销售额'], textStyle: { color: axisColor }, top: 0 },
    grid: { left: 8, right: 8, top: 40, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: months.map((m: string) => m.slice(2)), axisLabel: { color: axisColor }, axisLine: { lineStyle: { color: splitColor } } },
    yAxis: { type: 'value', axisLabel: { color: axisColor, formatter: (v: number) => v >= 1000 ? (v / 1000) + 'k' : String(v) }, splitLine: { lineStyle: { color: splitColor } } },
    series: [
      {
        name: '实际销售额', type: 'line', smooth: true,
        data: [...(data?.actual || []).map((a: any) => a.revenue), ...Array(3).fill(null)],
        lineStyle: { color: '#4f6ef7', width: 2.5 }, itemStyle: { color: '#4f6ef7' }, symbolSize: 6,
        areaStyle: { color: 'rgba(79,110,247,.1)' },
      },
      {
        name: '预测销售额', type: 'line', smooth: true,
        data: [...Array(11).fill(null), data?.actual?.[11]?.revenue || 0, ...(data?.forecasts || []).map((f: any) => f.predicted)],
        lineStyle: { color: '#f79009', width: 2.5, type: 'dashed' }, itemStyle: { color: '#f79009' }, symbolSize: 6,
      },
    ],
  }
  const trend = data?.trend === '上升'

  return (
    <div>
      <Alert type="info" showIcon message="预测算法" description="基于近12个月销售数据，用「线性回归 60% + 近3月移动平均 40%」预测未来3个月，仅供参考。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="未来3月预测总额" value={data?.totalPredicted || 0} precision={2} prefix="¥" valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="销售趋势" value={data?.trend || '-'} valueStyle={{ color: trend ? '#16b364' : '#f04438' }} prefix={trend ? <RiseOutlined /> : <FallOutlined />} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="预测月份数" value={(data?.forecasts || []).length} suffix="个月" /></Card></Col>
      </Row>
      <Card className="chart-card" styles={{ body: { padding: 16 } }}>
        <ReactECharts option={opt} style={{ height: 380 }} />
      </Card>
      <Table style={{ marginTop: 16 }} size="small" pagination={false} rowKey="month"
        dataSource={(data?.forecasts || []).map((f: any) => ({ ...f, key: f.month }))}
        columns={[
          { title: '月份', dataIndex: 'month', key: 'month' },
          { title: '预测销售额', dataIndex: 'predicted', key: 'predicted', align: 'right' as const, render: (v: number) => <b style={{ color: '#f79009' }}>{money(v)}</b> },
          { title: '算法', dataIndex: 'method', key: 'method' },
        ]} />
    </div>
  )
}

export default function WarehouseIntel() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">库位管理 · 销售预测</h1>
        <p className="page-desc">精细化管理仓库库位，用历史数据预测未来销售趋势</p>
      </div>
      <Tabs items={[
        { key: 'location', label: '库位管理', children: <Locations /> },
        { key: 'forecast', label: '销售预测', children: <Forecast /> },
      ]} />
    </div>
  )
}
