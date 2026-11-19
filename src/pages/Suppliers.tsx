import React from 'react'
import { Tag } from 'antd'
import CrudPage, { Field } from './CrudPage'

const fields: Field[] = [
  { name: 'name', label: '供应商名称', required: true, span: 2 },
  { name: 'code', label: '供应商编号', required: true },
  { name: 'contact', label: '联系人' },
  { name: 'phone', label: '联系电话' },
  { name: 'email', label: '邮箱' },
  { name: 'address', label: '地址', span: 2 },
  { name: 'status', label: '合作状态', type: 'select', options: ['合作中', '待审核', '已终止'].map((v) => ({ label: v, value: v })) },
]

const columns = [
  { title: '编号', dataIndex: 'code', key: 'code', width: 110 },
  { title: '供应商名称', dataIndex: 'name', key: 'name', width: 180 },
  { title: '联系人', dataIndex: 'contact', key: 'contact' },
  { title: '电话', dataIndex: 'phone', key: 'phone' },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
  { title: '地址', dataIndex: 'address', key: 'address' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === '合作中' ? 'success' : v === '待审核' ? 'warning' : 'default'}>{v}</Tag> },
]

export default function Suppliers() {
  return <CrudPage collection="suppliers" title="供应商管理" desc="维护供应商档案与合作状态" fields={fields} columns={columns} />
}
