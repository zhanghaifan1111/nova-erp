import React from 'react'
import { Tag } from 'antd'
import CrudPage, { Field } from './CrudPage'

const fields: Field[] = [
  { name: 'title', label: '刊登标题', required: true, span: 2 },
  { name: 'shopId', label: '刊登店铺ID' },
  { name: 'sku', label: 'SKU' },
  { name: 'price', label: '售价', type: 'number' },
  { name: 'platformProductId', label: '平台商品ID' },
  { name: 'status', label: '状态', type: 'select', options: [{ label: '已刊登', value: '已刊登' }, { label: '草稿', value: '草稿' }, { label: '已下架', value: '已下架' }] },
  { name: 'sourceUrl', label: '采集来源链接', span: 2 },
]

const statusColor: Record<string, string> = { 已刊登: 'success', 草稿: 'default', 已下架: 'error' }
const columns = [
  { title: '刊登标题', dataIndex: 'title', key: 'title', width: 200, ellipsis: true },
  { title: '平台', dataIndex: 'platform', key: 'platform', render: (v: string) => <Tag color="blue">{v || '-'}</Tag> },
  { title: '店铺', dataIndex: 'shopName', key: 'shopName' },
  { title: 'SKU', dataIndex: 'sku', key: 'sku' },
  { title: '售价', dataIndex: 'price', key: 'price', align: 'right' as const, render: (v: number) => v ? `¥${v}` : '-' },
  { title: '平台商品ID', dataIndex: 'platformProductId', key: 'platformProductId' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
  { title: '刊登日期', dataIndex: 'publishedAt', key: 'publishedAt' },
]

export default function Listings() {
  return <CrudPage collection="listings" title="刊登管理" desc="管理采集商品在各平台的刊登记录与状态（采集箱点刊登会自动生成记录）" fields={fields} columns={columns} />
}
