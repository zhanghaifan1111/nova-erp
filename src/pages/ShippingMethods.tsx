import React from 'react'
import { Tag } from 'antd'
import CrudPage, { Field } from './CrudPage'

const fields: Field[] = [
  { name: 'name', label: '物流渠道', required: true },
  { name: 'code', label: '渠道编码', required: true },
  { name: 'provider', label: '物流服务商' },
  { name: 'country', label: '目的国家', type: 'select', options: ['全球', '美国', '英国', '德国', '新加坡', '马来西亚', '泰国', '越南', '菲律宾', '其他'].map((v) => ({ label: v, value: v })) },
  { name: 'timeLimit', label: '时效(天)', type: 'number' },
  { name: 'firstPrice', label: '首重价格', type: 'number' },
  { name: 'continuePrice', label: '续重价格', type: 'number' },
  { name: 'trackingPrefix', label: '运单号前缀' },
  { name: 'status', label: '状态', type: 'select', options: [{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }] },
  { name: 'remark', label: '备注', span: 2 },
]

const columns = [
  { title: '编码', dataIndex: 'code', key: 'code', width: 100 },
  { title: '渠道名称', dataIndex: 'name', key: 'name', width: 150 },
  { title: '服务商', dataIndex: 'provider', key: 'provider' },
  { title: '目的国家', dataIndex: 'country', key: 'country', render: (v: string) => <Tag>{v}</Tag> },
  { title: '时效', dataIndex: 'timeLimit', key: 'timeLimit', render: (v: number) => v ? `${v}天` : '-' },
  { title: '首重价', dataIndex: 'firstPrice', key: 'firstPrice', align: 'right' as const, render: (v: number) => v ? `¥${v}` : '-' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag> },
]

export default function ShippingMethods() {
  return <CrudPage collection="shippingMethods" title="物流渠道" desc="管理物流渠道、时效与运费价格" fields={fields} columns={columns} />
}
