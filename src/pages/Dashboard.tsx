import React, { useEffect, useState } from 'react'
import { Row, Col, Card, Tag, Table, Progress, Empty } from 'antd'
import {
  DollarOutlined, ShoppingCartOutlined, TeamOutlined, DatabaseOutlined,
  ArrowUpOutlined, ArrowDownOutlined, WarningOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { api, money } from '../api'
import { useAppTheme } from '../theme'

type D = any

const kpiGradient = (c1: string, c2: string) => `linear-gradient(135deg, ${c1}, ${c2})`

export default function Dashboard() {
  const [data, setData] = useState<D>(null)
  const [loading, setLoading] = useState(true)
  const { dark } = useAppTheme()

  useEffect(() => {
    api.dashboard().then((r) => setData(r.data)).finally(() => setLoading(false))
  }, [])

  const axisColor = dark ? '#8b93a7' : '#8c8c8c'
  const splitColor = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'
  const tooltipStyle = {
    backgroundColor: dark ? '#1f2740' : '#fff',
    borderColor: dark ? '#333c58' : '#eee',
    textStyle: { color: dark ? '#e6e8ef' : '#333' },
  }

  const trendOption: any = {
    tooltip: { trigger: 'axis', ...tooltipStyle },
    legend: { data: ['销售额', '订单数'], textStyle: { color: axisColor }, top: 0, right: 0 },
    grid: { left: 8, right: 8, top: 40, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: (data?.trend || []).map((t: any) => t.month.slice(2)), axisLine: { lineStyle: { color: splitColor } }, axisLabel: { color: axisColor } },
    yAxis: [
      { type: 'value', axisLabel: { color: axisColor, formatter: (v: number) => v >= 1000 ? (v / 1000) + 'k' : String(v) }, splitLine: { lineStyle: { color: splitColor } } },
      { type: 'value', axisLabel: { color: axisColor }, splitLine: { show: false } },
    ],
    series: [
      {
        name: '销售额', type: 'bar', data: (data?.trend || []).map((t: any) => t.revenue),
        itemStyle: { borderRadius: [5, 5, 0, 0], color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#6d8bff' }, { offset: 1, color: '#4f6ef7' }] } },
        barMaxWidth: 26,
      },
      {
        name: '订单数', type: 'line', yAxisIndex: 1, smooth: true, data: (data?.trend || []).map((t: any) => t.orders),
        symbol: 'circle', symbolSize: 6, lineStyle: { color: '#f79009', width: 2.5 }, itemStyle: { color: '#f79009' },
      },
    ],
  }

  const statusColors: Record<string, string> = { 已完成: '#16b364', 已发货: '#4f6ef7', 待发货: '#f79009', 待付款: '#f04438', 已取消: '#8c8c8c' }
  const statusOption: any = {
    tooltip: { trigger: 'item', ...tooltipStyle },
    legend: { bottom: 0, textStyle: { color: axisColor }, itemWidth: 10, itemHeight: 10 },
    series: [{
      type: 'pie', radius: ['48%', '72%'], center: ['50%', '44%'], avoidLabelOverlap: true,
      itemStyle: { borderColor: dark ? '#1f2740' : '#fff', borderWidth: 2, borderRadius: 4 },
      label: { show: false },
      data: (data?.statusDist || []).map((s: any) => ({ ...s, itemStyle: { color: statusColors[s.name] || '#888' } })),
    }],
  }

  const categoryOption: any = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...tooltipStyle },
    grid: { left: 8, right: 20, top: 8, bottom: 4, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: axisColor, formatter: (v: number) => v >= 1000 ? (v / 1000) + 'k' : String(v) }, splitLine: { lineStyle: { color: splitColor } } },
    yAxis: { type: 'category', data: (data?.categoryDist || []).map((c: any) => c.name), axisLabel: { color: axisColor }, axisLine: { lineStyle: { color: splitColor } } },
    series: [{ type: 'bar', data: (data?.categoryDist || []).map((c: any) => c.value), barWidth: 14, itemStyle: { borderRadius: [0, 6, 6, 0], color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#7c5cff' }, { offset: 1, color: '#4f6ef7' }] } } }],
  }

  const stockOption: any = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...tooltipStyle },
    grid: { left: 8, right: 8, top: 8, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: (data?.stockTop || []).map((s: any) => s.name.length > 6 ? s.name.slice(0, 6) + '…' : s.name), axisLabel: { color: axisColor, interval: 0, rotate: 20, fontSize: 10 }, axisLine: { lineStyle: { color: splitColor } } },
    yAxis: { type: 'value', axisLabel: { color: axisColor, formatter: (v: number) => v >= 1000 ? (v / 1000) + 'k' : String(v) }, splitLine: { lineStyle: { color: splitColor } } },
    series: [{ type: 'bar', data: (data?.stockTop || []).map((s: any) => s.value), barMaxWidth: 30, itemStyle: { borderRadius: [5, 5, 0, 0], color: '#00b8d9' } }],
  }

  const kpis = [
    { label: '总销售额', value: money(data?.kpi?.revenue), icon: <DollarOutlined />, g: kpiGradient('#4f6ef7', '#6d8bff'), trend: '+12.6%', up: true, foot: '累计有效订单收入' },
    { label: '销售订单', value: data?.kpi?.orders ?? 0, icon: <ShoppingCartOutlined />, g: kpiGradient('#16b364', '#3CCB7F'), trend: '+8.3%', up: true, foot: '含已发货/已完成' },
    { label: '客户总数', value: data?.kpi?.customers ?? 0, icon: <TeamOutlined />, g: kpiGradient('#7c5cff', '#9b7cff'), trend: '+4.1%', up: true, foot: '在册客户档案' },
    { label: '库存总价值', value: money(data?.kpi?.stockValue), icon: <DatabaseOutlined />, g: kpiGradient('#f79009', '#fdb022'), trend: '-2.4%', up: false, foot: '按成本价计算' },
  ]

  const orderColumns = [
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 130 },
    { title: '客户', dataIndex: 'customerName', key: 'customerName' },
    { title: '金额', dataIndex: 'total', key: 'total', align: 'right' as const, render: (v: number) => <span className="num-strong">{money(v)}</span> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColors[v] || 'default'}>{v}</Tag> },
    { title: '日期', dataIndex: 'orderDate', key: 'orderDate' },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">经营总览</h1>
        <p className="page-desc">欢迎回来，这是企业当前的经营状况概览</p>
      </div>

      <Row gutter={[16, 16]}>
        {kpis.map((k, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card className="kpi-card" loading={loading} styles={{ body: { padding: 20 } }}>
              <div className="kpi-icon" style={{ background: k.g, color: '#fff' }}>{k.icon}</div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}</div>
              <div className="kpi-foot">
                <span className={k.up ? 'kpi-trend-up' : 'kpi-trend-down'}>
                  {k.up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {k.trend}
                </span>
                <span style={{ marginLeft: 8 }}>{k.foot}</span>
              </div>
            </Card>
          </Col>
        ))}

        <Col xs={24} lg={16}>
          <Card className="chart-card" title="销售趋势（近 12 个月）" loading={loading} styles={{ body: { padding: 16 } }}>
            <ReactECharts option={trendOption} style={{ height: 300 }} notMerge />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="chart-card" title="订单状态分布" loading={loading} styles={{ body: { padding: 16 } }}>
            <ReactECharts option={statusOption} style={{ height: 300 }} notMerge />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="chart-card" title="分类销售占比" loading={loading} styles={{ body: { padding: 16 } }}>
            <ReactECharts option={categoryOption} style={{ height: 260 }} notMerge />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="chart-card" title="库存金额 TOP" loading={loading} styles={{ body: { padding: 16 } }}>
            <ReactECharts option={stockOption} style={{ height: 260 }} notMerge />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="stat-panel" title={<span><WarningOutlined style={{ color: '#f79009', marginRight: 6 }} />库存预警</span>} loading={loading} styles={{ body: { padding: 16 } }}>
            {(data?.lowStock || []).length === 0 && !loading ? <Empty description="库存充足" /> : (
              <div className="low-stock-list">
                {(data?.lowStock || []).map((p: any) => (
                  <div className="low-stock-item" key={p.sku}>
                    <div className="low-stock-row">
                      <span className="low-stock-name">{p.name}</span>
                      <span className="low-stock-sku">{p.sku}</span>
                    </div>
                    <Progress
                      percent={Math.min(100, Math.round((p.stock / p.safeStock) * 100))}
                      size="small"
                      strokeColor={p.stock < p.safeStock ? '#f04438' : '#f79009'}
                      format={() => `${p.stock} / 安全${p.safeStock}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card className="chart-card" title="最近销售订单" loading={loading} styles={{ body: { padding: 0 } }}>
            <Table columns={orderColumns} dataSource={data?.recentOrders || []} rowKey="id" pagination={false} size="middle" />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
