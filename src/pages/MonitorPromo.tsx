import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Row, Col, Card, Statistic, message, Alert, Input, Space, Modal, Form, InputNumber, Select, DatePicker } from 'antd'
import { HeartOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined, GiftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api, money } from '../api'
import CrudPage, { Field } from './CrudPage'

// ============ 系统监控 ============
function SystemMonitor() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    api.systemHealth().then((r: any) => setData(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  const uptimeMin = Math.floor((data?.uptime || 0) / 60)

  const cols = Object.entries(data?.counts || {}).map(([k, v]) => ({ key: k, name: k, count: v as number }))
    .sort((a: any, b: any) => b.count - a.count)

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="系统状态" value="正常" valueStyle={{ color: '#16b364' }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col xs={24} sm={6}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="数据总量" value={data?.totalRecords || 0} suffix="条" valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={6}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="写操作" value={data?.writeOps || 0} suffix="次" valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col xs={24} sm={6}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="运行时间" value={uptimeMin} suffix="分钟" valueStyle={{ color: '#f79009' }} /></Card></Col>
      </Row>
      {data?.errorCount > 0 && <Alert type="error" showIcon message={`最近有 ${data.errorCount} 条失败记录`} description="推送/同步失败的日志，请检查。" style={{ marginBottom: 16 }} />}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card className="chart-card" title="各模块数据量" styles={{ body: { padding: 12 } }} extra={<Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>}>
            <Table size="small" pagination={false} rowKey="key" dataSource={cols}
              columns={[
                { title: '数据集合', dataIndex: 'name', key: 'name' },
                { title: '记录数', dataIndex: 'count', key: 'count', align: 'right' as const, sorter: (a: any, b: any) => a.count - b.count, render: (v: number) => <b>{v}</b> },
              ]} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card className="chart-card" title="最近失败记录" styles={{ body: { padding: 12 } }}>
            {(data?.recentErrors || []).length ? (data.recentErrors || []).map((e: any, i: number) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(127,127,127,.1)' }}>
                <Tag color="error">失败</Tag> {e.title || e.message || e.error || JSON.stringify(e).slice(0, 60)}
              </div>
            )) : <div style={{ color: '#16b364', padding: 24, textAlign: 'center' }}>暂无失败记录，系统运行良好</div>}
            <div style={{ marginTop: 16, color: '#888', fontSize: 12 }}>服务器时间：{data?.serverTime ? new Date(data.serverTime).toLocaleString('zh-CN') : '-'}</div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// ============ 促销优惠券 ============
function Coupons() {
  const [code, setCode] = useState('')
  const [amount, setAmount] = useState<number>(100)
  const [result, setResult] = useState<any>(null)
  const validate = async () => {
    try { const r: any = await api.couponValidate(code, amount); setResult(r.data); message.success('优惠券可用') }
    catch (e: any) { setResult(null); message.error(e.message) }
  }
  return (
    <div>
      <Alert type="info" showIcon message="优惠券类型" description="满减券（固定减金额）与折扣券（按折扣率减）。可设最低消费与有效期。" style={{ marginBottom: 16 }} />
      <Card className="chart-card" title={<span><GiftOutlined /> 优惠券验证器</span>} styles={{ body: { padding: 20 } }} style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="输入优惠码" value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 180 }} />
          <InputNumber value={amount} onChange={(v) => setAmount(Number(v || 0))} min={0} precision={2} prefix="¥" placeholder="订单金额" />
          <Button type="primary" onClick={validate}>验证</Button>
        </Space>
        {result && <Alert type="success" showIcon style={{ marginTop: 16 }}
          message={`优惠 ${money(result.discount)}，应付 ${money(result.payable)}`}
          description={`${result.coupon.type}券 · ${result.coupon.name || result.coupon.code}`} />}
      </Card>
      <CrudPage collection="coupons" title="优惠券" desc="满减/折扣券配置" fields={[
        { name: 'code', label: '优惠码', required: true },
        { name: 'name', label: '券名称' },
        { name: 'type', label: '类型', type: 'select', options: [{ label: '满减', value: '满减' }, { label: '折扣', value: '折扣' }] },
        { name: 'value', label: '面值/折扣率（满减填金额，折扣填如0.8表示8折）', type: 'number', required: true },
        { name: 'minAmount', label: '最低消费', type: 'number' },
        { name: 'expiryDate', label: '有效期' },
        { name: 'status', label: '状态', type: 'select', options: [{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }] },
      ]} columns={[
        { title: '优惠码', dataIndex: 'code', key: 'code', width: 140 },
        { title: '名称', dataIndex: 'name', key: 'name' },
        { title: '类型', dataIndex: 'type', key: 'type', width: 90, render: (v: string) => <Tag color="orange">{v}</Tag> },
        { title: '值', dataIndex: 'value', key: 'value', width: 100, align: 'right' as const },
        { title: '最低消费', dataIndex: 'minAmount', key: 'minAmount', width: 110, align: 'right' as const, render: (v: number) => v ? money(v) : '-' },
        { title: '有效期', dataIndex: 'expiryDate', key: 'expiryDate', width: 110 },
        { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag> },
      ]} />
    </div>
  )
}

export default function MonitorPromo() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">系统监控 · 促销管理</h1>
        <p className="page-desc">系统健康一目了然，优惠券配置与验证</p>
      </div>
      <Tabs items={[
        { key: 'monitor', label: '系统监控', children: <SystemMonitor /> },
        { key: 'coupon', label: '促销优惠券', children: <Coupons /> },
      ]} />
    </div>
  )
}
