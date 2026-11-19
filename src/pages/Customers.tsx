import React from 'react'
import { Tag } from 'antd'
import CrudPage, { Field } from './CrudPage'

const fields: Field[] = [
  { name: 'name', label: '客户名称', required: true, span: 2 },
  { name: 'code', label: '客户编号', required: true },
  { name: 'level', label: '客户等级', type: 'select', options: ['VIP', '重点', '普通'].map((v) => ({ label: v, value: v })) },
  { name: 'contact', label: '联系人' },
  { name: 'phone', label: '联系电话' },
  { name: 'email', label: '邮箱' },
  { name: 'address', label: '地址', span: 2 },
  { name: 'status', label: '状态', type: 'select', options: [{ label: '正常', value: '正常' }, { label: '停用', value: '停用' }] },
]

const levelColor: Record<string, string> = { VIP: 'gold', 重点: 'red', 普通: 'blue' }
const columns = [
  { title: '编号', dataIndex: 'code', key: 'code', width: 110 },
  { title: '客户名称', dataIndex: 'name', key: 'name', width: 180 },
  { title: '等级', dataIndex: 'level', key: 'level', render: (v: string) => <Tag color={levelColor[v] || 'blue'}>{v}</Tag> },
  { title: '联系人', dataIndex: 'contact', key: 'contact' },
  { title: '电话', dataIndex: 'phone', key: 'phone' },
  { title: '地址', dataIndex: 'address', key: 'address' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === '正常' ? 'success' : 'default'}>{v}</Tag> },
]

export default function Customers() {
  return <CrudPage collection="customers" title="客户管理" desc="维护客户档案与分级信息" fields={fields} columns={columns} />
}
