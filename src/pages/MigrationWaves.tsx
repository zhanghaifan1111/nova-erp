import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, message, Alert, Row, Col, Card, Statistic, Modal, Form, Select, InputNumber, Checkbox, Space, Input } from 'antd'
import { SwapOutlined, ThunderboltOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../api'
import CrudPage, { Field } from './CrudPage'

// ============ 产品搬家 ============
function Migration() {
  const [shops, setShops] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [targetShop, setTargetShop] = useState('')
  const [priceFactor, setPriceFactor] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    Promise.all([api.list('shops'), api.list('products')]).then(([a, b]: any[]) => { setShops(a.data); setProducts(b.data) }).catch(() => {})
  }, [])

  const doMigrate = async () => {
    const v = await form.validateFields()
    setLoading(true)
    try {
      const r: any = await api.migrateProducts({ sourceShop: v.sourceShop, targetShop: v.targetShop, productIds: selected, priceFactor: Number(v.priceFactor || 1), status: v.status })
      message.success(r.message)
      setSelected([])
    } catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }

  const cols = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: '商品名称', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '店铺', dataIndex: 'shopName', key: 'shopName', width: 120, render: (v: string) => <Tag>{v || '未分配'}</Tag> },
    { title: '售价', dataIndex: 'price', key: 'price', width: 100, align: 'right' as const },
  ]

  return (
    <div>
      <Alert type="info" showIcon message="产品搬家（对标店小秘跨平台搬家）" description="把源店铺的商品批量复制到目标店铺，支持加价系数。选择商品后一键搬家，生成目标店铺的商品刊登草稿。" style={{ marginBottom: 16 }} />
      <Card className="chart-card" title={<span><SwapOutlined /> 搬家配置</span>} styles={{ body: { padding: 20 } }} style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" initialValues={{ priceFactor: 1, status: '草稿' }}>
          <Form.Item name="sourceShop" label="源店铺" rules={[{ required: true }]}>
            <Select style={{ width: 150 }} placeholder="选择源店铺" options={shops.map((s) => ({ label: s.name, value: s.name }))} />
          </Form.Item>
          <Form.Item name="targetShop" label="目标店铺" rules={[{ required: true }]}><Input placeholder="如：TikTok店" style={{ width: 150 }} /></Form.Item>
          <Form.Item name="priceFactor" label="加价系数"><InputNumber min={0.1} step={0.1} style={{ width: 110 }} /></Form.Item>
          <Form.Item name="status" label="生成状态"><Select style={{ width: 110 }} options={[{ label: '草稿', value: '草稿' }, { label: '待刊登', value: '待刊登' }]} /></Form.Item>
          <Button type="primary" icon={<ThunderboltOutlined />} loading={loading} onClick={doMigrate} disabled={!selected.length}>搬家 {selected.length} 个商品</Button>
        </Form>
        <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>勾选下方商品；不勾选则自动搬源店铺全部商品。加价系数 1.2 = 售价上浮20%。</div>
      </Card>
      <Table rowKey="id" dataSource={products} columns={[
        { title: '', key: 'sel', width: 50, render: (r: any) => <Checkbox checked={selected.includes(r.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id))} /> },
        ...cols,
      ]} size="middle" pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 个商品` }} />
    </div>
  )
}

// ============ 波次发货 ============
function Waves() {
  const [waves, setWaves] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [detail, setDetail] = useState<any>(null)
  const load = () => {
    Promise.all([api.list('waves'), api.list('salesOrders')]).then(([a, b]: any[]) => {
      setWaves(a.data); setOrders(b.data.filter((o: any) => !['已发货', '已取消'].includes(o.status)))
    }).catch((e) => message.error(e.message))
  }
  useEffect(() => { load() }, [])

  const createWave = async () => {
    try { const r: any = await api.waveCreate({ orderNos: selected }); message.success(r.message); setSelected([]); load() }
    catch (e: any) { message.error(e.message) }
  }
  const ship = async (id: string) => {
    try { const r: any = await api.waveShip(id); message.success(r.message); load() }
    catch (e: any) { message.error(e.message) }
  }

  const cols = [
    { title: '波次号', dataIndex: 'waveNo', key: 'waveNo', width: 150 },
    { title: '订单数', dataIndex: 'orderCount', key: 'orderCount', width: 90, align: 'right' as const },
    { title: 'SKU数', dataIndex: 'pickList', key: 'pickList', width: 90, align: 'right' as const, render: (v: any[]) => (v || []).length },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={v === '已发货' ? 'success' : 'orange'}>{v}</Tag> },
    { title: '创建日', dataIndex: 'createdAt', key: 'createdAt', width: 110 },
    { title: '操作', key: 'action', width: 140, render: (_: any, r: any) => <Space size={2}>
      <Button type="link" size="small" onClick={() => setDetail(r)}>拣货单</Button>
      {r.status !== '已发货' && <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => ship(r.id)}>发货</Button>}
    </Space> },
  ]

  return (
    <div>
      <Alert type="info" showIcon message="波次发货（对标店小秘波次拣货）" description="把多笔订单合并成一个波次，系统按 SKU 自动汇总拣货清单，拣完一次发货，日发万单不卡顿。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="波次数" value={waves.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="待拣货" value={waves.filter((w) => w.status === '待拣货').length} valueStyle={{ color: '#f79009' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="可合并订单" value={orders.length} valueStyle={{ color: '#16b364' }} /></Card></Col>
      </Row>
      <Card className="chart-card" title="选择订单合并波次" styles={{ body: { padding: 12 } }} style={{ marginBottom: 16 }}>
        <div className="table-toolbar">
          <div className="table-toolbar-left"><span style={{ color: '#888' }}>已选 {selected.length} 单</span></div>
          <Button type="primary" icon={<ThunderboltOutlined />} disabled={!selected.length} onClick={createWave}>创建波次</Button>
        </div>
        <Table rowKey="orderNo" dataSource={orders.slice(0, 20)} size="small" pagination={false} columns={[
          { title: '', key: 'sel', width: 45, render: (r: any) => <Checkbox checked={selected.includes(r.orderNo)} onChange={(e) => setSelected(e.target.checked ? [...selected, r.orderNo] : selected.filter((x) => x !== r.orderNo))} /> },
          { title: '订单号', dataIndex: 'orderNo', key: 'orderNo' },
          { title: '客户', dataIndex: 'customerName', key: 'customerName' },
          { title: '金额', dataIndex: 'total', key: 'total', align: 'right' as const },
          { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag>{v}</Tag> },
        ]} />
      </Card>
      <Table columns={cols} dataSource={waves} rowKey="id" size="middle" pagination={{ pageSize: 10 }} />

      <Modal open={!!detail} title={`拣货单 · ${detail?.waveNo || ''}`} onCancel={() => setDetail(null)} footer={null} width={700}>
        {detail && <Table size="small" pagination={false} rowKey="sku" dataSource={detail.pickList || []}
          columns={[
            { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 130 },
            { title: '商品', dataIndex: 'name', key: 'name' },
            { title: '需拣数量', dataIndex: 'qty', key: 'qty', width: 100, align: 'right' as const, render: (v: number) => <b style={{ color: '#4f6ef7' }}>{v}</b> },
            { title: '涉及订单', dataIndex: 'orders', key: 'orders', width: 200, render: (v: string[]) => <span style={{ fontSize: 12, color: '#888' }}>{(v || []).slice(0, 3).join(', ')}{v?.length > 3 ? '...' : ''}</span> },
          ]} />}
      </Modal>
    </div>
  )
}

export default function MigrationWaves() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">产品搬家 · 波次发货</h1>
        <p className="page-desc">跨店铺批量复制商品，多订单合并波次拣货发货</p>
      </div>
      <Tabs items={[
        { key: 'migration', label: '产品搬家', children: <Migration /> },
        { key: 'waves', label: '波次发货', children: <Waves /> },
      ]} />
    </div>
  )
}
