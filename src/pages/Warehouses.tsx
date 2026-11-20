import React from 'react'
import { Tag } from 'antd'
import CrudPage, { Field } from './CrudPage'

const fields: Field[] = [
  { name: 'name', label: '仓库名称', required: true },
  { name: 'code', label: '仓库编码', required: true },
  { name: 'manager', label: '负责人' },
  { name: 'phone', label: '联系电话' },
  { name: 'address', label: '仓库地址', span: 2 },
  { name: 'type', label: '类型', type: 'select', options: [{ label: '自营仓', value: '自营仓' }, { label: '第三方仓', value: '第三方仓' }, { label: '海外仓', value: '海外仓' }] },
  { name: 'status', label: '状态', type: 'select', options: [{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }] },
]

const columns = [
  { title: '编码', dataIndex: 'code', key: 'code', width: 110 },
  { title: '仓库名称', dataIndex: 'name', key: 'name', width: 160 },
  { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag color="blue">{v}</Tag> },
  { title: '负责人', dataIndex: 'manager', key: 'manager' },
  { title: '电话', dataIndex: 'phone', key: 'phone' },
  { title: '地址', dataIndex: 'address', key: 'address' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag> },
]

export default function Warehouses() {
  return <CrudPage collection="warehouses" title="仓库管理" desc="管理自营仓、第三方仓与海外仓档案" fields={fields} columns={columns} />
}
