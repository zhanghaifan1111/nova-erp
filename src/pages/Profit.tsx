import React, { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Input, Button, Space, message } from 'antd'
import { SearchOutlined, ReloadOutlined, DollarOutlined, RiseOutlined, FallOutlined, PercentageOutlined } from '@ant-design/icons'
import { api, money } from '../api'
import { useAppTheme } from '../theme'
import ReactECharts from 'echarts-for-react'

export default function Profit() {
  const [data, setData] = useState<{ rows: any[]; sum: any }>({ rows: [], sum: {} })
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const { dark } = useAppTheme()

  const load = () => {
    setLoading(true)
    api.profit().then((r) => setData(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = keyword.trim()
    ? data.rows.filter((r) => [r.orderNo, r.customerName, r.shopName].some((v) => String(v || '').toLowerCase().includes(keyword.toLowerCase())))
    : data.rows

  const sum = data.sum || {}
  const axisColor = dark ? '#8b93a7' : '#8c8c8c'
  const splitColor = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'
  const costChart: any = {
    tooltip: { trigger: 'item', backgroundColor: dark ? '#1f2740' : '#fff', borderColor: dark ? '#333c58' : '#eee', textStyle: { color: dark ? '#e6e8ef' : '#333' } },
    legend: { bottom: 0, textStyle: { color: axisColor } },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['50%', '42%'],
      itemStyle: { borderColor: dark ? '#1f2740' : '#fff', borderWidth: 2, borderRadius: 4 },
      label: { formatter: '{b}\n{d}%', color: axisColor, fontSize: 11 },
      data: [
        { name: '采购成本', value: sum.cost || 0, itemStyle: { color: '#f04438' } },
        { name: '运费', value: sum.shippingFee || 0, itemStyle: { color: '#f79009' } },
        { name: '平台佣金', value: sum.commission || 0, itemStyle: { color: '#7c5cff' } },
        { name: '其他费用', value: sum.otherFee || 0, itemStyle: { color: '#00b8d9' } },
        { name: '净利润', value: Math.max(0, sum.profit || 0), itemStyle: { color: '#16b364' } },
      ],
    }],
  }

  const columns = [
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 130 },
    { title: '店铺', dataIndex: 'shopName', key: 'shopName', width: 110 },
    { title: '客户', dataIndex: 'customerName', key: 'customerName', width: 120 },
    { title: '收入', dataIndex: 'revenue', key: 'revenue', align: 'right' as const, render: (v: number) => <span className="num-strong" style={{ color: '#4f6ef7' }}>{money(v)}</span> },
    { title: '采购成本', dataIndex: 'cost', key: 'cost', align: 'right' as const, render: (v: number) => money(v) },
    { title: '运费', dataIndex: 'shippingFee', key: 'shippingFee', align: 'right' as const, render: (v: number) => money(v) },
    { title: '佣金', dataIndex: 'commission', key: 'commission', align: 'right' as const, render: (v: number) => money(v) },
    { title: '利润', dataIndex: 'profit', key: 'profit', align: 'right' as const, render: (v: number) => <span className="num-strong" style={{ color: v >= 0 ? '#16b364' : '#f04438' }}>{money(v)}</span> },
    { title: '利润率', dataIndex: 'margin', key: 'margin', align: 'right' as const, render: (v: number) => <Tag color={v >= 20 ? 'success' : v >= 0 ? 'warning' : 'error'}>{v}%</Tag> },
    { title: '日期', dataIndex: 'orderDate', key: 'orderDate', width: 110 },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">利润核算</h1>
        <p className="page-desc">逐单核算净利润：收入 − 采购成本 − 运费 − 平台佣金 − 其他费用</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}><Card className="kpi-card" loading={loading} styles={{ body: { padding: 20 } }}><div className="kpi-icon" style={{ background: 'linear-gradient(135deg,#4f6ef7,#6d8bff)', color: '#fff' }}><DollarOutlined /></div><div className="kpi-label">总收入</div><div className="kpi-value" style={{ color: '#4f6ef7' }}>{money(sum.revenue)}</div></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="kpi-card" loading={loading} styles={{ body: { padding: 20 } }}><div className="kpi-icon" style={{ background: 'linear-gradient(135deg,#f04438,#f97066)', color: '#fff' }}><FallOutlined /></div><div className="kpi-label">总成本费用</div><div className="kpi-value" style={{ color: '#f04438' }}>{money((sum.cost || 0) + (sum.shippingFee || 0) + (sum.commission || 0) + (sum.otherFee || 0))}</div></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="kpi-card" loading={loading} styles={{ body: { padding: 20 } }}><div className="kpi-icon" style={{ background: 'linear-gradient(135deg,#16b364,#3CCB7F)', color: '#fff' }}><RiseOutlined /></div><div className="kpi-label">净利润</div><div className="kpi-value" style={{ color: '#16b364' }}>{money(sum.profit)}</div></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="kpi-card" loading={loading} styles={{ body: { padding: 20 } }}><div className="kpi-icon" style={{ background: 'linear-gradient(135deg,#7c5cff,#9b7cff)', color: '#fff' }}><PercentageOutlined /></div><div className="kpi-label">净利率</div><div className="kpi-value" style={{ color: '#7c5cff' }}>{sum.margin || 0}%</div></Card></Col>

        <Col xs={24} lg={8}>
          <Card title="成本构成" loading={loading} className="chart-card" styles={{ body: { padding: 16 } }}>
            <ReactECharts option={costChart} style={{ height: 280 }} notMerge />
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title="说明" className="chart-card" styles={{ body: { padding: 20 } }}>
            <div style={{ color: dark ? '#c9d0e0' : '#555', lineHeight: 2 }}>
              <div>• <b>收入</b>：销售订单总额（不含已取消订单）</div>
              <div>• <b>采购成本</b>：订单商品按商品档案中的成本价计算</div>
              <div>• <b>运费</b>：订单上填写的 shippingFee</div>
              <div>• <b>平台佣金</b>：订单关联店铺的佣金率 × 收入（在店铺管理设置）</div>
              <div>• <b>净利润</b>：收入 − 采购成本 − 运费 − 佣金 − 其他费用</div>
              <div style={{ marginTop: 8, color: '#f79009' }}>提示：要利润数据准确，请在「商品管理」维护成本价、在「店铺管理」维护佣金率，并在订单里填写运费。</div>
            </div>
          </Card>
        </Col>

        <Col span={24}>
          <Card className="chart-card" styles={{ body: { padding: 0 } }}>
            <div style={{ padding: '16px 16px 0' }} className="table-toolbar">
              <div className="table-toolbar-left">
                <Input prefix={<SearchOutlined />} placeholder="搜索订单号/客户/店铺" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 260 }} allowClear />
                <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
              </div>
            </div>
            <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} size="middle" scroll={{ x: 'max-content' }} pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
