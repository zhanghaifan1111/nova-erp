import React from 'react'
import { Tag } from 'antd'
import CrudPage, { Field } from './CrudPage'
import { money } from '../api'

const fields: Field[] = [
  { name: 'name', label: '商品名称', required: true, span: 2 },
  { name: 'sku', label: 'SKU 编码', required: true },
  { name: 'category', label: '分类', type: 'select', required: true, options: ['数码配件', '家居用品', '办公设备', '户外运动'].map((v) => ({ label: v, value: v })) },
  { name: 'spec', label: '规格型号', type: 'select', options: ['标准版', '升级版', '旗舰版', '基础款'].map((v) => ({ label: v, value: v })) },
  { name: 'unit', label: '单位', type: 'select', options: ['个', '台', '件', '套', '包', '张'].map((v) => ({ label: v, value: v })) },
  { name: 'costPrice', label: '成本价', type: 'number', required: true },
  { name: 'salePrice', label: '销售价', type: 'number', required: true },
  { name: 'stock', label: '库存数量', type: 'number', required: true },
  { name: 'safeStock', label: '安全库存', type: 'number' },
  { name: 'status', label: '状态', type: 'select', options: [{ label: '在售', value: '在售' }, { label: '下架', value: '下架' }] },
]

const columns = [
  { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 110 },
  { title: '商品名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '分类', dataIndex: 'category', key: 'category', render: (v: string) => <Tag color="blue">{v}</Tag> },
  { title: '规格', dataIndex: 'spec', key: 'spec' },
  { title: '成本价', dataIndex: 'costPrice', key: 'costPrice', align: 'right' as const, render: (v: number) => money(v) },
  { title: '销售价', dataIndex: 'salePrice', key: 'salePrice', align: 'right' as const, render: (v: number) => <span className="num-strong">{money(v)}</span> },
  { title: '库存', dataIndex: 'stock', key: 'stock', align: 'right' as const, render: (v: number, r: any) => <span style={{ color: v <= (r.safeStock || 20) ? '#f04438' : undefined, fontWeight: 600 }}>{v} {r.unit}</span> },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === '在售' ? 'success' : 'default'}>{v}</Tag> },
]

export default function Products() {
  return <CrudPage collection="products" title="商品管理" desc="管理商品档案、价格与基础库存信息" fields={fields} columns={columns} />
}
