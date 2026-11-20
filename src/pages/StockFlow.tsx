import React, { useEffect, useState } from 'react'
import {
  Tabs, Table, Tag, Button, Space, Input, Modal, Form, Select, InputNumber,
  message, Popconfirm, Card, Row, Col, Statistic, Alert, Upload, Progress,
} from 'antd'
import {
  ImportOutlined, ExportOutlined, SearchOutlined, ReloadOutlined, CheckCircleOutlined,
  InboxOutlined, PlusOutlined, RollbackOutlined, EditOutlined,
} from '@ant-design/icons'
import { api } from '../api'

const statusColor: Record<string, string> = {
  待入库: 'orange', 已入库: 'success', 待盘点: 'orange', 已盘点: 'success',
  待退货: 'orange', 已退货: 'success',
}

// ============ 采购入库 ============
function Receipts() {
  const [rows, setRows] = useState<any[]>([])
  const [pos, setPos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    Promise.all([api.list('receipts'), api.list('purchaseOrders')])
      .then(([a, b]) => { setRows(a.data); setPos(b.data) })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const gen = async (id: string) => {
    try { const r: any = await api.receiptFromPurchase(id); message.success(r.message); load() }
    catch (e: any) { message.error(e.message) }
  }
  const confirm = (id: string) => {
    Modal.confirm({
      title: '确认入库', content: '确认后会增加商品库存并写入库存流水，采购单标记为已完成。',
      okText: '确认入库', cancelText: '取消',
      onOk: async () => {
        try { const r: any = await api.receiptConfirm(id); message.success(r.message); load() }
        catch (e: any) { message.error(e.message) }
      },
    })
  }
  const cols = [
    { title: '入库单号', dataIndex: 'receiptNo', key: 'receiptNo', width: 170 },
    { title: '采购单号', dataIndex: 'purchaseNo', key: 'purchaseNo', width: 140 },
    { title: '供应商', dataIndex: 'supplierName', key: 'supplierName' },
    { title: '品项数', key: 'cnt', width: 80, render: (_: any, r: any) => (r.items || []).length },
    { title: '总数量', key: 'qty', width: 80, align: 'right' as const, render: (_: any, r: any) => (r.items || []).reduce((s: number, i: any) => s + Number(i.qty || 0), 0) },
    { title: '金额', dataIndex: 'total', key: 'total', width: 100, align: 'right' as const, render: (v: number) => `¥${Number(v || 0).toFixed(2)}` },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
    { title: '入库日期', dataIndex: 'receivedAt', key: 'receivedAt', width: 110 },
    {
      title: '操作', key: 'action', width: 110,
      render: (_: any, r: any) => r.status === '待入库'
        ? <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => confirm(r.id)}>确认入库</Button>
        : <Tag color="success">已入库</Tag>,
    },
  ]
  return (
    <div>
      <div className="table-toolbar">
        <div className="table-toolbar-left"><span style={{ color: '#888' }}>从采购订单生成入库单，确认后库存自动增加</span></div>
        <Select style={{ width: 240 }} placeholder="选择采购单生成入库单" optionFilterProp="label" allowClear
          onChange={(v) => v && gen(v)}
          options={pos.map((p) => ({ label: `${p.orderNo} — ${p.supplierName || ''}`, value: p.id }))} />
      </div>
      <Table columns={cols} dataSource={rows} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />
    </div>
  )
}

// ============ 库存盘点 ============
function StockChecks() {
  const [rows, setRows] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const load = () => {
    setLoading(true)
    Promise.all([api.list('stockChecks'), api.list('products')])
      .then(([a, b]) => { setRows(a.data); setProducts(b.data) })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    const v = await form.validateFields()
    const items = (v.items || []).map((pid: string) => ({ productId: pid }))
    if (!items.length) { message.warning('请选择商品'); return }
    try {
      const r: any = await api.checkCreate({ warehouse: v.warehouse, items })
      message.success(r.message); setOpen(false); form.resetFields(); load()
    } catch (e: any) { message.error(e.message) }
  }

  const [editCheck, setEditCheck] = useState<any>(null)
  const [actualForm] = Form.useForm()
  const fillActual = (rec: any) => { setEditCheck(rec); actualForm.resetFields() }
  const saveActual = async () => {
    const v = await actualForm.validateFields()
    try {
      await api.checkUpdate(editCheck.id, v)
      message.success('实盘数已保存'); setEditCheck(null); load()
    } catch (e: any) { message.error(e.message) }
  }

  const confirm = (id: string) => {
    Modal.confirm({
      title: '确认盘点', content: '确认后按账面与实盘的差异调整库存（盘盈增加、盘亏减少）并写流水。',
      okText: '确认', cancelText: '取消',
      onOk: async () => {
        try { const r: any = await api.checkConfirm(id); message.success(r.message); load() }
        catch (e: any) { message.error(e.message) }
      },
    })
  }

  const cols = [
    { title: '盘点单号', dataIndex: 'checkNo', key: 'checkNo', width: 150 },
    { title: '仓库', dataIndex: 'warehouse', key: 'warehouse' },
    { title: '品项数', key: 'cnt', width: 80, render: (_: any, r: any) => (r.items || []).length },
    { title: '差异合计', dataIndex: 'diffTotal', key: 'diffTotal', width: 100, align: 'right' as const, render: (v: number) => <span style={{ color: v > 0 ? '#16b364' : v < 0 ? '#f04438' : undefined }}>{v > 0 ? '+' : ''}{v}</span> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
    { title: '盘点日期', dataIndex: 'checkedAt', key: 'checkedAt', width: 110 },
    {
      title: '操作', key: 'action', width: 170,
      render: (_: any, r: any) => (
        <Space size={2}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => fillActual(r)}>填实盘</Button>
          {r.status === '待盘点' && <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => confirm(r.id)}>确认</Button>}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="table-toolbar">
        <div className="table-toolbar-left"><span style={{ color: '#888' }}>选商品生成盘点单 → 填实盘数 → 确认后自动调整库存</span></div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新建盘点</Button>
      </div>
      <Table columns={cols} dataSource={rows} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />

      <Modal open={open} title="新建盘点单" onOk={create} onCancel={() => setOpen(false)} okText="生成" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="warehouse" label="仓库"><Input placeholder="选填" /></Form.Item>
          <Form.Item name="items" label="选择盘点商品" rules={[{ required: true, message: '请选择商品' }]}>
            <Select mode="multiple" optionFilterProp="label" placeholder="可多选"
              options={products.map((p) => ({ label: `${p.sku} ${p.name}（库存 ${p.stock}）`, value: p.id }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={!!editCheck} title={`填实盘数 · ${editCheck?.checkNo || ''}`} onOk={saveActual} onCancel={() => setEditCheck(null)} okText="保存实盘" cancelText="取消" width={640}>
        <Alert type="info" showIcon message="账面数取自商品当前库存，请填写实际盘点数量；保存后会生成新的盘点单用于确认。" style={{ marginBottom: 16 }} />
        <Form form={actualForm} layout="vertical">
          {(editCheck?.items || []).map((it: any) => (
            <Form.Item key={it.productId} name={it.productId} label={`${it.sku} ${it.name}（账面 ${it.bookQty}）`}>
              <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder={String(it.bookQty)} />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  )
}

// ============ 销售退货 ============
function Returns() {
  const [rows, setRows] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    Promise.all([api.list('returns'), api.list('salesOrders')])
      .then(([a, b]) => { setRows(a.data); setOrders(b.data) })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const gen = async (id: string) => {
    Modal.confirm({
      title: '生成退货单', content: '按订单全部商品生成退货单，确认退货后会回补库存。',
      okText: '生成', cancelText: '取消',
      onOk: async () => {
        try { const r: any = await api.returnFromOrder(id); message.success(r.message); load() }
        catch (e: any) { message.error(e.message) }
      },
    })
  }
  const confirm = (id: string) => {
    Modal.confirm({
      title: '确认退货', content: '确认后回补商品库存、写流水，原销售订单标记为已取消。',
      okText: '确认退货', cancelText: '取消',
      onOk: async () => {
        try { const r: any = await api.returnConfirm(id); message.success(r.message); load() }
        catch (e: any) { message.error(e.message) }
      },
    })
  }
  const cols = [
    { title: '退货单号', dataIndex: 'returnNo', key: 'returnNo', width: 160 },
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 130 },
    { title: '客户', dataIndex: 'customerName', key: 'customerName' },
    { title: '退款金额', dataIndex: 'refundAmount', key: 'refundAmount', width: 110, align: 'right' as const, render: (v: number) => `¥${Number(v || 0).toFixed(2)}` },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
    { title: '退货日期', dataIndex: 'returnedAt', key: 'returnedAt', width: 110 },
    {
      title: '操作', key: 'action', width: 110,
      render: (_: any, r: any) => r.status === '待退货'
        ? <Button type="link" size="small" icon={<RollbackOutlined />} onClick={() => confirm(r.id)}>确认退货</Button>
        : <Tag color="success">已退货</Tag>,
    },
  ]
  return (
    <div>
      <div className="table-toolbar">
        <div className="table-toolbar-left"><span style={{ color: '#888' }}>从销售订单生成退货单，确认后库存回补、订单取消</span></div>
        <Select style={{ width: 240 }} placeholder="选择销售订单生成退货单" optionFilterProp="label" allowClear
          onChange={(v) => v && gen(v)}
          options={orders.map((o) => ({ label: `${o.orderNo} — ${o.customerName || ''}`, value: o.id }))} />
      </div>
      <Table columns={cols} dataSource={rows} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />
    </div>
  )
}

export default function StockFlow() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">进销存闭环 · 入库盘点退货</h1>
        <p className="page-desc">采购入库、库存盘点、销售退货——所有操作自动联动库存与流水</p>
      </div>
      <Tabs items={[
        { key: 'receipt', label: '采购入库', children: <Receipts /> },
        { key: 'check', label: '库存盘点', children: <StockChecks /> },
        { key: 'return', label: '销售退货', children: <Returns /> },
      ]} />
    </div>
  )
}
