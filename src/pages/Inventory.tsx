import React, { useEffect, useState } from 'react'
import { Card, Table, Tabs, Button, InputNumber, Modal, Form, Select, Tag, Space, message, Progress, Input } from 'antd'
import { ImportOutlined, ExportOutlined, SearchOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons'
import { api, money } from '../api'

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [modal, setModal] = useState<{ type: '入库' | '出库'; record: any } | null>(null)
  const [form] = Form.useForm()
  const watchedQty = Form.useWatch('qty', form)

  const load = () => {
    setLoading(true)
    Promise.all([api.list('products'), api.list('stockLogs')])
      .then(([p, l]) => { setProducts(p.data); setLogs(l.data) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const submit = async () => {
    const values = await form.validateFields()
    const rec = modal!.record
    const delta = modal!.type === '入库' ? values.qty : -values.qty
    const newStock = Math.max(0, (rec.stock || 0) + delta)
    await api.update('products', rec.id, { stock: newStock })
    await api.create('stockLogs', {
      type: modal!.type, productId: rec.id, sku: rec.sku, name: rec.name, qty: values.qty,
      relatedNo: values.relatedNo || '-', note: values.note || (modal!.type === '入库' ? '手工入库' : '手工出库'),
    })
    message.success(`${modal!.type}成功`)
    setModal(null)
    form.resetFields()
    load()
  }

  const filtered = keyword.trim()
    ? products.filter((p) => Object.values(p).some((v) => typeof v === 'string' && v.toLowerCase().includes(keyword.toLowerCase())))
    : products

  const totalValue = products.reduce((s, p) => s + p.costPrice * p.stock, 0)
  const lowCount = products.filter((p) => p.stock <= p.safeStock).length

  const stockCols = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 110 },
    { title: '商品名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '分类', dataIndex: 'category', key: 'category', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '当前库存', dataIndex: 'stock', key: 'stock', align: 'right' as const, sorter: (a: any, b: any) => a.stock - b.stock, render: (v: number, r: any) => <span className="num-strong" style={{ color: v <= r.safeStock ? '#f04438' : undefined }}>{v} {r.unit}</span> },
    { title: '安全库存', dataIndex: 'safeStock', key: 'safeStock', align: 'right' as const, render: (v: number) => v ?? 20 },
    { title: '库存状态', key: 'level', width: 150, render: (_: any, r: any) => {
      const pct = Math.min(100, Math.round((r.stock / (r.safeStock || 20)) * 100))
      return <Progress percent={pct} size="small" strokeColor={r.stock <= r.safeStock ? '#f04438' : r.stock < r.safeStock * 2 ? '#f79009' : '#16b364'} format={() => r.stock <= r.safeStock ? '偏低' : '充足'} />
    } },
    { title: '库存金额', key: 'value', align: 'right' as const, render: (_: any, r: any) => <span className="num-strong">{money(r.costPrice * r.stock)}</span> },
    { title: '操作', key: 'action', fixed: 'right' as const, width: 150, render: (_: any, r: any) => (
      <Space size={2}>
        <Button type="link" size="small" icon={<ImportOutlined />} onClick={() => { setModal({ type: '入库', record: r }); form.resetFields() }}>入库</Button>
        <Button type="link" size="small" icon={<ExportOutlined />} onClick={() => { setModal({ type: '出库', record: r }); form.resetFields() }}>出库</Button>
      </Space>
    ) },
  ]

  const logCols = [
    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag color={v === '入库' ? 'success' : 'processing'}>{v}</Tag> },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: '商品', dataIndex: 'name', key: 'name' },
    { title: '数量', dataIndex: 'qty', key: 'qty', align: 'right' as const, render: (v: number, r: any) => <span className="num-strong" style={{ color: r.type === '入库' ? '#16b364' : '#f04438' }}>{r.type === '入库' ? '+' : '-'}{v}</span> },
    { title: '关联单号', dataIndex: 'relatedNo', key: 'relatedNo' },
    { title: '备注', dataIndex: 'note', key: 'note' },
    { title: '日期', dataIndex: 'createdAt', key: 'createdAt' },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">库存管理</h1>
        <p className="page-desc">实时查看库存水平，执行出入库操作并追踪流水</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Card size="small" style={{ flex: 1, minWidth: 160 }}><div style={{ color: '#888', fontSize: 12 }}>库存 SKU 数</div><div style={{ fontSize: 22, fontWeight: 700 }}>{products.length}</div></Card>
        <Card size="small" style={{ flex: 1, minWidth: 160 }}><div style={{ color: '#888', fontSize: 12 }}>库存总价值</div><div style={{ fontSize: 22, fontWeight: 700 }}>{money(totalValue)}</div></Card>
        <Card size="small" style={{ flex: 1, minWidth: 160 }}><div style={{ color: '#888', fontSize: 12 }}>低库存预警</div><div style={{ fontSize: 22, fontWeight: 700, color: lowCount ? '#f04438' : '#16b364' }}>{lowCount} <span style={{ fontSize: 12 }}>项</span></div></Card>
      </div>

      <Tabs items={[
        {
          key: 'stock', label: '库存台账',
          children: <>
            <div className="table-toolbar">
              <div className="table-toolbar-left">
                <Input prefix={<SearchOutlined />} placeholder="搜索商品/SKU" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
                <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
              </div>
              {lowCount > 0 && <Tag color="error" icon={<WarningOutlined />}>{lowCount} 项库存低于安全线</Tag>}
            </div>
            <Table columns={stockCols} dataSource={filtered} rowKey="id" loading={loading} size="middle" scroll={{ x: 'max-content' }} pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />
          </>,
        },
        {
          key: 'logs', label: '出入库流水',
          children: <Table columns={logCols} dataSource={logs} rowKey="id" loading={loading} size="middle" scroll={{ x: 'max-content' }} pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />,
        },
      ]} />

      <Modal
        open={!!modal}
        title={`${modal?.type || ''} · ${modal?.record?.name || ''}`}
        onOk={submit}
        onCancel={() => setModal(null)}
        okText="确认"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="qty" label={`${modal?.type}数量`} rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="请输入数量" />
          </Form.Item>
          <Form.Item name="relatedNo" label="关联单号（选填）">
            <Input placeholder="如 SO202600001 / PO202600001" />
          </Form.Item>
          <Form.Item name="note" label="备注（选填）">
            <Input placeholder="操作说明" />
          </Form.Item>
          {modal && <div style={{ color: '#888', fontSize: 12 }}>当前库存：<b>{modal.record.stock}</b>，操作后预计：<b style={{ color: modal.type === '入库' ? '#16b364' : '#f04438' }}>{Math.max(0, modal.record.stock + (modal.type === '入库' ? 1 : -1) * (watchedQty || 0))}</b></div>}
        </Form>
      </Modal>
    </div>
  )
}
