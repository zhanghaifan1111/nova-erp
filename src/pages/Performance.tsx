import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, Input, Modal, Form, InputNumber, DatePicker, Select, message, Alert, Row, Col, Card, Statistic, Progress } from 'antd'
import { WarningOutlined, BellOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api, money } from '../api'
import CrudPage, { Field } from './CrudPage'

// ============ KPI 目标达成 ============
function KpiPanel() {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [data, setData] = useState<any>({ rows: [] })
  const load = (m: string) => api.kpiAttainment(m).then((r: any) => setData(r.data)).catch((e) => message.error(e.message))
  useEffect(() => { load(month) }, [])
  const cols = [
    { title: '范围', dataIndex: 'scope', key: 'scope', width: 160 },
    { title: '月份', dataIndex: 'month', key: 'month', width: 110 },
    { title: '目标', dataIndex: 'target', key: 'target', width: 130, align: 'right' as const, render: (v: number) => money(v) },
    { title: '实际', dataIndex: 'actual', key: 'actual', width: 130, align: 'right' as const, render: (v: number) => money(v) },
    { title: '差额', dataIndex: 'gap', key: 'gap', width: 130, align: 'right' as const, render: (v: number) => <span style={{ color: v >= 0 ? '#16b364' : '#f04438' }}>{v >= 0 ? '+' : ''}{money(v)}</span> },
    {
      title: '达成率', dataIndex: 'rate', key: 'rate', width: 200,
      render: (v: number) => <Progress percent={Math.min(100, v)} strokeColor={v >= 100 ? '#16b364' : v >= 80 ? '#f79009' : '#f04438'} format={() => `${v}%`} />,
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={v === '达成' ? 'success' : v === '接近' ? 'orange' : 'error'}>{v}</Tag> },
  ]
  const avgRate = data.rows.length ? Math.round(data.rows.reduce((s: number, r: any) => s + r.rate, 0) / data.rows.length) : 0
  return (
    <div>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <span>查询月份</span>
          <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); load(e.target.value) }} style={{ width: 160 }} />
          <Button icon={<ReloadOutlined />} onClick={() => load(month)}>刷新</Button>
        </div>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="目标数" value={data.rows.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="平均达成率" value={avgRate} suffix="%" valueStyle={{ color: avgRate >= 100 ? '#16b364' : '#f79009' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="已达成" value={data.rows.filter((r: any) => r.status === '达成').length} valueStyle={{ color: '#16b364' }} prefix={<CheckCircleOutlined />} /></Card></Col>
      </Row>
      <Alert type="info" showIcon message="先在「目标设置」Tab 设定月度目标，再看这里达成率" style={{ marginBottom: 16 }} />
      <Table columns={cols} dataSource={data.rows} rowKey="targetId" size="middle" loading={!data.rows} pagination={false} />
    </div>
  )
}

const targetFields: Field[] = [
  { name: 'month', label: '月份（YYYY-MM）', required: true, placeholder: '2026-11' },
  { name: 'shopId', label: '店铺ID（留空为整体目标）' },
  { name: 'shopName', label: '店铺名称' },
  { name: 'target', label: '销售目标', type: 'number', required: true },
]
const targetCols = [
  { title: '月份', dataIndex: 'month', key: 'month', width: 110 },
  { title: '范围', dataIndex: 'shopName', key: 'shopName', render: (v: string) => v || '整体' },
  { title: '销售目标', dataIndex: 'target', key: 'target', align: 'right' as const, render: (v: number) => money(v) },
]

// ============ 预警中心 ============
function Alerts() {
  const [data, setData] = useState<any>({ rows: [], byLevel: {} })
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    api.alertsAll().then((r: any) => setData(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const cols = [
    { title: '级别', dataIndex: 'level', key: 'level', width: 80, render: (v: string) => <Tag color={v === '高' ? 'error' : v === '中' ? 'orange' : 'default'}>{v}</Tag> },
    { title: '类型', dataIndex: 'type', key: 'type', width: 120, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '预警内容', dataIndex: 'title', key: 'title' },
    { title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="预警总数" value={data.total} valueStyle={{ color: '#4f6ef7' }} prefix={<BellOutlined />} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="高优先级" value={data.byLevel?.高 || 0} valueStyle={{ color: '#f04438' }} prefix={<WarningOutlined />} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="中优先级" value={data.byLevel?.中 || 0} valueStyle={{ color: '#f79009' }} /></Card></Col>
      </Row>
      <Alert type="warning" showIcon message="统一预警中心" description="自动聚合低库存、逾期应收、待审批、跟进逾期、对账差异等所有需要你处理的事项，高优先级排在最前。" style={{ marginBottom: 16 }} />
      <div className="table-toolbar">
        <div className="table-toolbar-left"><span style={{ color: '#888' }}>{data.total ? `你有 ${data.total} 件事需要处理` : '暂无预警，一切正常'}</span></div>
        <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
      </div>
      <Table columns={cols} dataSource={data.rows} rowKey={(_, i) => String(i)} rowClassName={(r: any) => r.level === '高' ? 'row-alert-high' : ''} loading={loading} size="middle" pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} />
    </div>
  )
}

export default function Performance() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">KPI 目标 · 预警中心</h1>
        <p className="page-desc">目标达成率跟踪 + 全系统预警一屏掌控，重要的事不会漏</p>
      </div>
      <Tabs items={[
        { key: 'kpi', label: '目标达成', children: <KpiPanel /> },
        { key: 'targets', label: '目标设置', children: <CrudPage collection="kpiTargets" title="目标设置" desc="设定月度销售目标（整体或按店铺）" fields={targetFields} columns={targetCols} /> },
        { key: 'alerts', label: '预警中心', children: <Alerts /> },
      ]} />
    </div>
  )
}
