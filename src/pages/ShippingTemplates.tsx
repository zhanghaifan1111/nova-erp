import React from 'react'
import { Tag } from 'antd'
import CrudPage, { Field } from './CrudPage'

const fields: Field[] = [
  { name: 'name', label: '模板名称', required: true, span: 2 },
  { name: 'warehouse', label: '发货仓库' },
  { name: 'shippingMethod', label: '物流渠道' },
  { name: 'firstWeight', label: '首重(kg)', type: 'number' },
  { name: 'firstPrice', label: '首重费用', type: 'number' },
  { name: 'continueWeight', label: '续重单位(kg)', type: 'number' },
  { name: 'continuePrice', label: '续重费用', type: 'number' },
  { name: 'freeShipping', label: '包邮门槛', type: 'number' },
  { name: 'remark', label: '备注', span: 2 },
]

const columns = [
  { title: '模板名称', dataIndex: 'name', key: 'name', width: 160 },
  { title: '发货仓库', dataIndex: 'warehouse', key: 'warehouse' },
  { title: '物流渠道', dataIndex: 'shippingMethod', key: 'shippingMethod' },
  { title: '首重', dataIndex: 'firstWeight', key: 'firstWeight', align: 'right' as const, render: (v: number) => v ? `${v}kg` : '-' },
  { title: '首重费', dataIndex: 'firstPrice', key: 'firstPrice', align: 'right' as const, render: (v: number) => v ? `¥${v}` : '-' },
  { title: '续重费', dataIndex: 'continuePrice', key: 'continuePrice', align: 'right' as const, render: (v: number) => v ? `¥${v}/kg` : '-' },
  { title: '包邮门槛', dataIndex: 'freeShipping', key: 'freeShipping', align: 'right' as const, render: (v: number) => v ? `¥${v}` : '-' },
]

export default function ShippingTemplates() {
  return <CrudPage collection="shippingTemplates" title="运费模板" desc="按仓库与渠道设置首重续重运费规则" fields={fields} columns={columns} />
}
