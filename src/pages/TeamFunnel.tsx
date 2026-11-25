import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Row, Col, Card, Statistic, message, Alert, Progress } from 'antd'
import { TrophyOutlined, RiseOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { api, money } from '../api'
import { useAppTheme } from '../theme'
import CrudPage, { Field } from './CrudPage'

// ============ 员工绩效 ============
function Team() {
  const [data, setData] = useState<any>({ rows: [] })
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.performanceTeam().then((r: any) => setData(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }, [])
  const medal = (r: number) => r === 1 ? <Tag color="gold"><TrophyOutlined /> 1</Tag> : r === 2 ? <Tag color="silver">2</Tag> : r === 3 ? <Tag color="bronze">3</Tag> : r
  const cols = [
    { title: '排名', dataIndex: 'rank', key: 'rank', width: 80, render: (v: number) => medal(v) },
    { title: '员工', dataIndex: 'name', key: 'name', width: 150 },
    { title: '订单数', dataIndex: 'orders', key: 'orders', width: 100, align: 'right' as const },
    { title: '销售额', dataIndex: 'amount', key: 'amount', width: 140, align: 'right' as const, render: (v: number) => <b style={{ color: '#16b364' }}>{money(v)}</b> },
    { title: '客单价', dataIndex: 'avg', key: 'avg', width: 130, align: 'right' as const, render: (v: number) => money(v) },
  ]
  const max = data.rows[0]?.amount || 1
  return (
    <div>
      <Alert type="info" showIcon message="员工绩效" description="按销售订单的负责人（owner/operator/salesperson 字段）统计业绩排名。给订单指定负责人后即可看到个人业绩。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="销售人数" value={data.total} suffix="人" valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={12}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="团队总业绩" value={data.rows.reduce((s: number, r: any) => s + r.amount, 0)} precision={2} prefix="¥" valueStyle={{ color: '#16b364' }} /></Card></Col>
      </Row>
      <Table columns={[
        ...cols,
        { title: '业绩占比', key: 'bar', width: 200, render: (_: any, r: any) => <Progress percent={Math.round(r.amount / max * 100)} strokeColor="#4f6ef7" showInfo={false} /> },
      ]} dataSource={data.rows} rowKey="name" loading={loading} size="middle" pagination={false} />
    </div>
  )
}

// ============ 销售漏斗 ============
const stageColor: Record<string, string> = { 初步接触: '#8c8c8c', 需求确认: '#4f6ef7', 报价中: '#722ed1', 谈判中: '#fa8c16', 已成交: '#16b364', 已流失: '#f04438' }

function Funnel() {
  const [data, setData] = useState<any>({ rows: [] })
  const { dark } = useAppTheme()
  useEffect(() => { api.funnelStages().then((r: any) => setData(r.data)).catch((e) => message.error(e.message)) }, [])
  const axisColor = dark ? '#8b93a7' : '#666'

  const funnelOpt: any = {
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br/>${p.value} 个商机` },
    legend: { bottom: 0, textStyle: { color: axisColor } },
    series: [{
      type: 'funnel', top: 10, bottom: 50, left: '10%', width: '80%',
      minSize: '18%', maxSize: '100%', sort: 'descending', gap: 3,
      label: { show: true, position: 'inside', color: '#fff', formatter: (p: any) => `${p.name} ${p.value}` },
      itemStyle: { borderColor: dark ? '#1f2740' : '#fff', borderWidth: 2 },
      data: data.rows.filter((r: any) => r.count > 0).map((r: any) => ({ name: r.stage, value: r.count, itemStyle: { color: stageColor[r.stage] } })),
    }],
  }
  const total = data.rows.reduce((s: number, r: any) => s + r.count, 0)
  const won = data.rows.find((r: any) => r.stage === '已成交')
  const winRate = total > 0 ? Math.round((won?.count || 0) / total * 100) : 0

  const cols = [
    { title: '阶段', dataIndex: 'stage', key: 'stage', render: (v: string) => <Tag color={stageColor[v]}>{v}</Tag> },
    { title: '商机数', dataIndex: 'count', key: 'count', align: 'right' as const },
    { title: '金额', dataIndex: 'amount', key: 'amount', align: 'right' as const, render: (v: number) => money(v) },
  ]

  return (
    <div>
      <Alert type="info" showIcon message="销售漏斗" description="按客户跟进阶段统计商机分布，看清客户卡在哪个环节。商机金额从 deals 记录统计。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="商机总数" value={total} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="已成交" value={won?.count || 0} valueStyle={{ color: '#16b364' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="成交率" value={winRate} suffix="%" valueStyle={{ color: '#f79009' }} prefix={<RiseOutlined />} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}><Card className="chart-card" title="商机漏斗" styles={{ body: { padding: 12 } }}><ReactECharts option={funnelOpt} style={{ height: 360 }} /></Card></Col>
        <Col xs={24} lg={10}><Card className="chart-card" title="阶段明细" styles={{ body: { padding: 12 } }}><Table size="small" pagination={false} rowKey="stage" dataSource={data.rows} columns={cols} /></Card></Col>
      </Row>
      <Card className="chart-card" title="商机记录" styles={{ body: { padding: 12 } }} style={{ marginTop: 16 }}>
        <CrudPage collection="deals" title="商机" desc="登记商机阶段与预计金额" fields={[
          { name: 'name', label: '商机名称', required: true },
          { name: 'customerName', label: '客户' },
          { name: 'stage', label: '阶段', type: 'select', options: ['初步接触', '需求确认', '报价中', '谈判中', '已成交', '已流失'].map((v) => ({ label: v, value: v })) },
          { name: 'amount', label: '预计金额', type: 'number' },
        ]} columns={[
          { title: '商机', dataIndex: 'name', key: 'name' },
          { title: '客户', dataIndex: 'customerName', key: 'customerName' },
          { title: '阶段', dataIndex: 'stage', key: 'stage', render: (v: string) => <Tag color={stageColor[v]}>{v}</Tag> },
          { title: '金额', dataIndex: 'amount', key: 'amount', align: 'right' as const, render: (v: number) => money(v) },
        ]} />
      </Card>
    </div>
  )
}

export default function TeamFunnel() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">员工绩效 · 销售漏斗</h1>
        <p className="page-desc">团队业绩排名 + 商机漏斗可视化，看清谁在扛业绩、商机卡在哪</p>
      </div>
      <Tabs items={[
        { key: 'team', label: '员工绩效', children: <Team /> },
        { key: 'funnel', label: '销售漏斗', children: <Funnel /> },
      ]} />
    </div>
  )
}
