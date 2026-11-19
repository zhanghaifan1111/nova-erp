import React, { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Tag } from 'antd'
import { DollarOutlined, RiseOutlined, FallOutlined, WalletOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { api, money } from '../api'
import { useAppTheme } from '../theme'

export default function Finance() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<any[]>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const { dark } = useAppTheme()

  useEffect(() => {
    Promise.all([api.dashboard(), api.list('salesOrders'), api.list('purchaseOrders')])
      .then(([d, s, p]) => { setData(d.data); setSales(s.data); setPurchases(p.data) })
      .finally(() => setLoading(false))
  }, [])

  const axisColor = dark ? '#8b93a7' : '#8c8c8c'
  const splitColor = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'
  const tooltipStyle = { backgroundColor: dark ? '#1f2740' : '#fff', borderColor: dark ? '#333c58' : '#eee', textStyle: { color: dark ? '#e6e8ef' : '#333' } }

  const profitTrend: any = {
    tooltip: { trigger: 'axis', ...tooltipStyle },
    legend: { data: ['销售收入', '采购支出', '毛利'], textStyle: { color: axisColor }, top: 0 },
    grid: { left: 8, right: 8, top: 40, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: (data?.trend || []).map((t: any) => t.month.slice(2)), axisLabel: { color: axisColor }, axisLine: { lineStyle: { color: splitColor } } },
    yAxis: { type: 'value', axisLabel: { color: axisColor, formatter: (v: number) => v >= 1000 ? (v / 1000) + 'k' : String(v) }, splitLine: { lineStyle: { color: splitColor } } },
    series: [
      { name: '销售收入', type: 'bar', data: (data?.trend || []).map((t: any) => t.revenue), itemStyle: { color: '#4f6ef7', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 20 },
      { name: '采购支出', type: 'bar', data: (data?.trend || []).map((t: any) => Math.round(t.revenue * (data?.kpi?.purchaseAmount || 0) / Math.max(1, data?.kpi?.revenue || 1))), itemStyle: { color: '#f04438', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 20 },
      { name: '毛利', type: 'line', smooth: true, data: (data?.trend || []).map((t: any) => Math.round(t.revenue * (data?.kpi?.profit || 0) / Math.max(1, data?.kpi?.revenue || 1))), lineStyle: { color: '#16b364', width: 2.5 }, itemStyle: { color: '#16b364' }, symbolSize: 6 },
    ],
  }

  const pieOption: any = {
    tooltip: { trigger: 'item', ...tooltipStyle },
    legend: { bottom: 0, textStyle: { color: axisColor } },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['50%', '42%'],
      itemStyle: { borderColor: dark ? '#1f2740' : '#fff', borderWidth: 2, borderRadius: 4 },
      label: { formatter: '{b}\n{d}%', color: axisColor, fontSize: 11 },
      data: [
        { name: '销售收入', value: data?.kpi?.revenue || 0, itemStyle: { color: '#4f6ef7' } },
        { name: '采购支出', value: data?.kpi?.purchaseAmount || 0, itemStyle: { color: '#f04438' } },
        { name: '毛利', value: Math.max(0, data?.kpi?.profit || 0), itemStyle: { color: '#16b364' } },
      ],
    }],
  }

  const kpi = data?.kpi || {}
  const margin = kpi.revenue ? ((kpi.profit / kpi.revenue) * 100).toFixed(1) : '0'

  const flowColumns = [
    { title: '单号', dataIndex: 'orderNo', key: 'orderNo' },
    { title: '类型', key: 'type', render: () => <Tag color="blue">销售</Tag> },
    { title: '往来单位', dataIndex: 'customerName', key: 'party' },
    { title: '金额', dataIndex: 'total', key: 'total', align: 'right' as const, render: (v: number) => <span className="num-strong" style={{ color: '#16b364' }}>+{money(v)}</span> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag>{v}</Tag> },
    { title: '日期', dataIndex: 'orderDate', key: 'date' },
  ]
  const flowRows = [...sales].sort((a, b) => (b.orderDate || '').localeCompare(a.orderDate || '')).slice(0, 8)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">财务报表</h1>
        <p className="page-desc">汇总销售收入、采购支出与经营毛利</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card" loading={loading} styles={{ body: { padding: 20 } }}>
            <div className="kpi-icon" style={{ background: 'linear-gradient(135deg,#4f6ef7,#6d8bff)', color: '#fff' }}><DollarOutlined /></div>
            <div className="kpi-label">累计销售收入</div>
            <div className="kpi-value" style={{ color: '#4f6ef7' }}>{money(kpi.revenue)}</div>
            <div className="kpi-foot"><RiseOutlined /> 有效订单累计</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card" loading={loading} styles={{ body: { padding: 20 } }}>
            <div className="kpi-icon" style={{ background: 'linear-gradient(135deg,#f04438,#f97066)', color: '#fff' }}><FallOutlined /></div>
            <div className="kpi-label">累计采购支出</div>
            <div className="kpi-value" style={{ color: '#f04438' }}>{money(kpi.purchaseAmount)}</div>
            <div className="kpi-foot">采购订单累计</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card" loading={loading} styles={{ body: { padding: 20 } }}>
            <div className="kpi-icon" style={{ background: 'linear-gradient(135deg,#16b364,#3CCB7F)', color: '#fff' }}><RiseOutlined /></div>
            <div className="kpi-label">经营毛利</div>
            <div className="kpi-value" style={{ color: '#16b364' }}>{money(kpi.profit)}</div>
            <div className="kpi-foot">收入 - 支出</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card" loading={loading} styles={{ body: { padding: 20 } }}>
            <div className="kpi-icon" style={{ background: 'linear-gradient(135deg,#7c5cff,#9b7cff)', color: '#fff' }}><WalletOutlined /></div>
            <div className="kpi-label">毛利率</div>
            <div className="kpi-value" style={{ color: '#7c5cff' }}>{margin}%</div>
            <div className="kpi-foot">毛利 / 销售收入</div>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card className="chart-card" title="收支与毛利趋势（近 12 个月）" loading={loading} styles={{ body: { padding: 16 } }}>
            <ReactECharts option={profitTrend} style={{ height: 320 }} notMerge />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="chart-card" title="收支结构" loading={loading} styles={{ body: { padding: 16 } }}>
            <ReactECharts option={pieOption} style={{ height: 320 }} notMerge />
          </Card>
        </Col>

        <Col span={24}>
          <Card className="chart-card" title="近期资金流水（销售回款）" loading={loading} styles={{ body: { padding: 0 } }}>
            <Table columns={flowColumns} dataSource={flowRows} rowKey="orderNo" pagination={false} size="middle" />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
