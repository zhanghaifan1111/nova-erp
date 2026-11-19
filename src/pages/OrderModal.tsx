import React, { useEffect, useState } from 'react'
import { Modal, Form, Input, Select, InputNumber, Button, Table, Space, DatePicker, message } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

type Props = {
  open: boolean
  title: string
  partyLabel: '客户' | '供应商'
  parties: any[]
  products: any[]
  statuses: string[]
  noPrefix: string
  onCancel: () => void
  onSaved: () => void
  save: (values: any) => Promise<any>
}

export default function OrderModal({ open, title, partyLabel, parties, products, statuses, noPrefix, onCancel, onSaved, save }: Props) {
  const [form] = Form.useForm()
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    if (open) {
      form.resetFields()
      setItems([])
      form.setFieldsValue({
        orderNo: noPrefix + new Date().getFullYear() + String(Math.floor(Math.random() * 90000) + 10000),
        orderDate: dayjs(),
        status: statuses[statuses.length - 1] || statuses[0],
      })
    }
  }, [open])

  const addItem = () => setItems((prev) => [...prev, { key: Date.now() + Math.random(), productId: undefined, qty: 1, price: 0 }])
  const updateItem = (key: any, patch: any) => setItems((prev) => prev.map((it) => it.key === key ? { ...it, ...patch } : it))
  const removeItem = (key: any) => setItems((prev) => prev.filter((it) => it.key !== key))

  const onProductChange = (key: any, productId: string) => {
    const p = products.find((x) => x.id === productId)
    updateItem(key, { productId, price: partyLabel === '客户' ? p?.salePrice : p?.costPrice, name: p?.name, sku: p?.sku })
  }

  const total = items.reduce((s, it) => s + (it.qty || 0) * (it.price || 0), 0)

  const handleOk = async () => {
    const values = await form.validateFields()
    if (!items.length || items.some((it) => !it.productId || it.qty <= 0)) {
      message.warning('请添加完整的商品明细')
      return
    }
    const party = parties.find((p) => p.id === values.partyId)
    const cleanItems = items.map((it) => ({ productId: it.productId, sku: it.sku, name: it.name, qty: it.qty, price: it.price }))
    await save({
      orderNo: values.orderNo,
      [partyLabel === '客户' ? 'customerId' : 'supplierId']: values.partyId,
      [partyLabel === '客户' ? 'customerName' : 'supplierName']: party?.name,
      items: cleanItems,
      total: Math.round(total * 100) / 100,
      status: values.status,
      orderDate: values.orderDate ? (typeof values.orderDate === 'string' ? values.orderDate : values.orderDate.format('YYYY-MM-DD')) : dayjs().format('YYYY-MM-DD'),
    })
    onSaved()
  }

  const itemColumns = [
    { title: '商品', key: 'product', width: 220, render: (_: any, r: any) => (
      <Select value={r.productId} onChange={(v) => onProductChange(r.key, v)} style={{ width: '100%' }} placeholder="选择商品" showSearch optionFilterProp="label"
        options={products.map((p) => ({ label: `${p.sku} ${p.name}`, value: p.id }))} />
    ) },
    { title: '数量', key: 'qty', width: 90, render: (_: any, r: any) => <InputNumber min={1} value={r.qty} onChange={(v) => updateItem(r.key, { qty: v || 1 })} style={{ width: '100%' }} /> },
    { title: '单价', key: 'price', width: 100, render: (_: any, r: any) => <InputNumber min={0} precision={2} value={r.price} onChange={(v) => updateItem(r.key, { price: v || 0 })} style={{ width: '100%' }} prefix="¥" /> },
    { title: '小计', key: 'sub', width: 100, align: 'right' as const, render: (_: any, r: any) => <span className="num-strong">¥{((r.qty || 0) * (r.price || 0)).toFixed(2)}</span> },
    { title: '', key: 'del', width: 40, render: (_: any, r: any) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeItem(r.key)} /> },
  ]

  return (
    <Modal open={open} title={title} onOk={handleOk} onCancel={onCancel} okText="创建订单" cancelText="取消" width={780} destroyOnClose>
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="orderNo" label="订单号" rules={[{ required: true, message: '请输入订单号' }]}><Input /></Form.Item>
          <Form.Item name="partyId" label={partyLabel} rules={[{ required: true, message: `请选择${partyLabel}` }]}>
            <Select showSearch optionFilterProp="label" placeholder={`选择${partyLabel}`} options={parties.map((p) => ({ label: p.name, value: p.id }))} />
          </Form.Item>
          <Form.Item name="orderDate" label="下单日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
        </div>
        <Form.Item name="status" label="订单状态" style={{ maxWidth: 240 }}><Select options={statuses.map((s) => ({ label: s, value: s }))} /></Form.Item>
      </Form>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 12px' }}>
        <div style={{ fontWeight: 600 }}>商品明细</div>
        <Button type="dashed" icon={<PlusOutlined />} onClick={addItem}>添加商品</Button>
      </div>
      <Table columns={itemColumns} dataSource={items} rowKey="key" size="small" pagination={false} locale={{ emptyText: '暂无明细，请点击"添加商品"' }} />
      <div style={{ textAlign: 'right', marginTop: 16, fontSize: 16 }}>
        订单合计：<span className="num-strong" style={{ color: '#4f6ef7', fontSize: 22 }}>¥{total.toFixed(2)}</span>
      </div>
    </Modal>
  )
}
