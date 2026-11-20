import React from 'react'
import { Tag } from 'antd'
import CrudPage, { Field } from './CrudPage'

const platforms = ['Shopee', 'Lazada', 'Amazon', 'TikTok Shop', 'Temu', 'AliExpress', '独立站', '其他']
const fields: Field[] = [
  { name: 'name', label: '店铺名称', required: true },
  { name: 'platform', label: '平台', type: 'select', required: true, options: platforms.map((v) => ({ label: v, value: v })) },
  { name: 'account', label: '店铺账号', span: 2 },
  { name: 'region', label: '站点/国家', type: 'select', options: ['中国台湾', '新加坡', '马来西亚', '泰国', '越南', '菲律宾', '印尼', '美国', '英国', '德国', '其他'].map((v) => ({ label: v, value: v })) },
  { name: 'commissionRate', label: '平台佣金率(%)', type: 'number' },
  { name: 'manager', label: '负责人' },
  { name: 'status', label: '状态', type: 'select', options: [{ label: '运营中', value: '运营中' }, { label: '暂停', value: '暂停' }] },
  { name: 'remark', label: '备注', span: 2 },
]

const platformColor: Record<string, string> = {
  Shopee: 'orange', Lazada: 'purple', Amazon: 'gold', 'TikTok Shop': 'cyan', Temu: 'red', AliExpress: 'blue', 独立站: 'green',
}
const columns = [
  { title: '店铺名称', dataIndex: 'name', key: 'name', width: 160 },
  { title: '平台', dataIndex: 'platform', key: 'platform', render: (v: string) => <Tag color={platformColor[v] || 'blue'}>{v}</Tag> },
  { title: '账号', dataIndex: 'account', key: 'account' },
  { title: '站点', dataIndex: 'region', key: 'region' },
  { title: '佣金率', dataIndex: 'commissionRate', key: 'commissionRate', align: 'right' as const, render: (v: number) => v ? `${v}%` : '-' },
  { title: '负责人', dataIndex: 'manager', key: 'manager' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === '运营中' ? 'success' : 'default'}>{v}</Tag> },
]

export default function Shops() {
  return <CrudPage collection="shops" title="店铺管理" desc="管理多平台店铺档案与平台佣金设置" fields={fields} columns={columns} />
}
