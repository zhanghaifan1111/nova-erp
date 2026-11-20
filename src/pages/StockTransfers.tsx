import React from 'react'
import { Tag } from 'antd'
import CrudPage, { Field } from './CrudPage'

const fields: Field[] = [
  { name: 'transferNo', label: '调拨单号', required: true },
  { name: 'sku', label: '商品SKU', required: true },
  { name: 'productName', label: '商品名称', span: 2 },
  { name: 'fromWarehouse', label: '调出仓库', required: true },
  { name: 'toWarehouse', label: '调入仓库', required: true },
  { name: 'qty', label: '调拨数量', type: 'number', required: true },
  { name: 'status', label: '状态', type: 'select', options: [{ label: '待调拨', value: '待调拨' }, { label: '运输中', value: '运输中' }, { label: '已完成', value: '已完成' }] },
  { name: 'transferDate', label: '调拨日期' },
  { name: 'remark', label: '备注', span: 2 },
]

const statusColor: Record<string, string> = { 待调拨: 'default', 运输中: 'processing', 已完成: 'success' }
const columns = [
  { title: '调拨单号', dataIndex: 'transferNo', key: 'transferNo', width: 140 },
  { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 110 },
  { title: '商品', dataIndex: 'productName', key: 'productName' },
  { title: '调出仓', dataIndex: 'fromWarehouse', key: 'fromWarehouse' },
  { title: '调入仓', dataIndex: 'toWarehouse', key: 'toWarehouse' },
  { title: '数量', dataIndex: 'qty', key: 'qty', align: 'right' as const, render: (v: number) => <span className="num-strong">{v}</span> },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
  { title: '日期', dataIndex: 'transferDate', key: 'transferDate' },
]

export default function StockTransfers() {
  return <CrudPage collection="stockTransfers" title="库存调拨" desc="管理仓库之间的库存调拨流转" fields={fields} columns={columns} />
}
