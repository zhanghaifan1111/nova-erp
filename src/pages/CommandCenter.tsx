import React, { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, message, Alert, Tabs, Button, Space } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, DollarOutlined, ShoppingCartOutlined, WarningOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { api, money } from '../api'
import { useAppTheme } from '../theme'

// ============ 数据驾驶舱 ============
function Dashboard() {
  const [dash, setDash] = useState<any>(null)
  const [alerts, setAlerts] = useState<any>(null)
  const [forecast, setForecast] = useState<any>(null)
  const { dark } = useAppTheme()

  useEffect(() => {
    Promise.all([api.dashboard(), api.alertsAll(), api.forecastSales()])
      .then(([d, a, f]) => { setDash(d.data); setAlerts(a.data); setForecast(f.data) })
      .catch((e) => message.error(e.message))
  }, [])

  const axisColor = dark ? '#8b93a7' : '#666'
  const splitColor = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'
  const tt = { backgroundColor: dark ? '#1f2740' : '#fff', borderColor: dark ? '#333c58' : '#eee', textStyle: { color: dark ? '#e6e8ef' : '#333' } }

  const trendOpt: any = {
    tooltip: { trigger: 'axis', ...tt },
    legend: { data: ['销售收入', '订单数'], textStyle: { color: axisColor }, top: 0 },
    grid: { left: 8, right: 8, top: 36, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: (dash?.trend || []).map((t: any) => t.month.slice(2)), axisLabel: { color: axisColor }, axisLine: { lineStyle: { color: splitColor } } },
    yAxis: [
      { type: 'value', axisLabel: { color: axisColor, formatter: (v: number) => v >= 1000 ? (v / 1000) + 'k' : String(v) }, splitLine: { lineStyle: { color: splitColor } } },
      { type: 'value', axisLabel: { color: axisColor }, splitLine: { show: false } },
    ],
    series: [
      { name: '销售收入', type: 'bar', data: (dash?.trend || []).map((t: any) => t.revenue), itemStyle: { color: '#4f6ef7', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 22 },
      { name: '订单数', type: 'line', yAxisIndex: 1, smooth: true, data: (dash?.trend || []).map((t: any) => t.orders), lineStyle: { color: '#16b364', width: 2.5 }, itemStyle: { color: '#16b364' }, symbolSize: 6 },
    ],
  }
  const alertOpt: any = {
    tooltip: { trigger: 'item', ...tt },
    legend: { bottom: 0, textStyle: { color: axisColor } },
    series: [{
      type: 'pie', radius: ['42%', '68%'], center: ['50%', '42%'],
      label: { formatter: '{b}\n{d}%', color: axisColor, fontSize: 11 },
      itemStyle: { borderColor: dark ? '#1f2740' : '#fff', borderWidth: 2, borderRadius: 4 },
      data: [
        { name: '销售订单', value: dash?.kpi?.orders || 0, itemStyle: { color: '#4f6ef7' } },
        { name: '库存预警', value: dash?.kpi?.lowStockCount || 0, itemStyle: { color: '#f04438' } },
        { name: '待处理预警', value: alerts?.total || 0, itemStyle: { color: '#f79009' } },
      ].filter((x) => x.value > 0),
    }],
  }

  const kpi = dash?.kpi || {}
  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>经营驾驶舱</h1>
          <span style={{ color: axisColor }}>全公司核心指标一屏掌控 · {new Date().toLocaleDateString('zh-CN')}</span>
        </div>
        <Tag color="blue" style={{ fontSize: 13, padding: '4px 10px' }}>{alerts?.total || 0} 条预警待处理</Tag>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card className="kpi-card" styles={{ body: { padding: 18 } }}><Statistic title="总销售额" value={kpi.revenue || 0} precision={2} prefix="¥" valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={12} sm={6}><Card className="kpi-card" styles={{ body: { padding: 18 } }}><Statistic title="毛利" value={kpi.profit || 0} precision={2} prefix="¥" valueStyle={{ color: '#16b364' }} /></Card></Col>
        <Col xs={12} sm={6}><Card className="kpi-card" styles={{ body: { padding: 18 } }}><Statistic title="销售订单" value={kpi.orders || 0} suffix="单" valueStyle={{ color: '#f79009' }} prefix={<ShoppingCartOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card className="kpi-card" styles={{ body: { padding: 18 } }}><Statistic title="待处理预警" value={alerts?.total || 0} suffix="条" valueStyle={{ color: '#f04438' }} prefix={<WarningOutlined />} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card className="chart-card" title="销售趋势与毛利（近12个月）" styles={{ body: { padding: 12 } }}>
            <ReactECharts option={trendOpt} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="chart-card" title="经营健康度" styles={{ body: { padding: 12 } }}>
            <ReactECharts option={alertOpt} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card className="chart-card" title="未来3月销售预测" styles={{ body: { padding: 16 } }}>
            {(forecast?.forecasts || []).map((f: any) => (
              <div key={f.month} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(127,127,127,.15)' }}>
                <span>{f.month}</span>
                <b style={{ color: '#f79009' }}>{money(f.predicted)}</b>
              </div>
            ))}
            <div style={{ marginTop: 12, color: axisColor, fontSize: 12 }}>预测依据：线性回归60% + 移动平均40%，当前趋势「{forecast?.trend || '-'}」</div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="chart-card" title="最新预警" styles={{ body: { padding: 16 } }}>
            {(alerts?.rows || []).slice(0, 5).map((a: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(127,127,127,.1)' }}>
                <Tag color={a.level === '高' ? 'error' : 'orange'}>{a.level}</Tag>
                <span style={{ flex: 1 }}>{a.title}</span>
              </div>
            ))}
            {!alerts?.rows?.length && <div style={{ color: '#16b364', padding: 24, textAlign: 'center' }}>暂无预警，经营正常</div>}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// ============ 库龄分析 ============
function Aging() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { dark } = useAppTheme()
  useEffect(() => {
    api.inventoryAging().then((r: any) => setData(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }, [])

  const axisColor = dark ? '#8b93a7' : '#666'
  const pieOpt: any = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: axisColor } },
    series: [{
      type: 'pie', radius: ['42%', '68%'], center: ['50%', '44%'],
      label: { formatter: '{b}\n¥{c}', color: axisColor, fontSize: 11 },
      itemStyle: { borderColor: dark ? '#1f2740' : '#fff', borderWidth: 2 },
      data: Object.entries(data?.summary || {}).map(([name, value], i) => ({ name, value, itemStyle: { color: ['#16b364', '#4f6ef7', '#f79009', '#f04438'][i] } })),
    }],
  }
  const cols = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: '商品', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '库存', dataIndex: 'stock', key: 'stock', width: 80, align: 'right' as const },
    { title: '最近入库', dataIndex: 'lastIn', key: 'lastIn', width: 110 },
    { title: '库龄', dataIndex: 'age', key: 'age', width: 90, align: 'right' as const, render: (v: number) => `${v}天` },
    { title: '库龄档', dataIndex: 'bucket', key: 'bucket', width: 100, render: (v: string) => <Tag color={v === '90天以上' ? 'error' : v === '61-90天' ? 'orange' : 'success'}>{v}</Tag> },
    { title: '占用资金', dataIndex: 'amount', key: 'amount', width: 120, align: 'right' as const, render: (v: number) => money(v) },
    { title: '状态', dataIndex: 'stagnant', key: 'stagnant', width: 90, render: (v: boolean) => v ? <Tag color="error">呆滞</Tag> : <Tag color="success">正常</Tag> },
  ]

  return (
    <div>
      <Alert type="warning" showIcon message="呆滞库存预警" description={`库龄超过 90 天的商品 ${data?.stagnantCount || 0} 种，占用资金 ${money(data?.stagnantAmount || 0)}。这些是压在仓库里的死钱，建议尽快处理。`} style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="库存总占用" value={Object.values(data?.summary || {}).reduce((s: number, v: any) => s + v, 0)} precision={2} prefix="¥" valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="呆滞SKU" value={data?.stagnantCount || 0} suffix="种" valueStyle={{ color: '#f04438' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="呆滞占用资金" value={data?.stagnantAmount || 0} precision={2} prefix="¥" valueStyle={{ color: '#f04438' }} /></Card></Col>
      </Row>
      <Card className="chart-card" title="库龄资金分布" styles={{ body: { padding: 12 } }} style={{ marginBottom: 16 }}>
        <ReactECharts option={pieOpt} style={{ height: 280 }} />
      </Card>
      <Table columns={cols} dataSource={data?.rows || []} rowKey="productId" loading={loading} size="middle" pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 种商品` }} />
    </div>
  )
}

export default function CommandCenter() {
  return (
    <div>
      <Tabs items={[
        { key: 'dash', label: '经营驾驶舱', children: <Dashboard /> },
        { key: 'aging', label: '库龄分析', children: <Aging /> },
      ]} />
    </div>
  )
}
