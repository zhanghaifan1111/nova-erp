import React from 'react'
import { Tag, Button, message } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import CrudPage, { Field } from './CrudPage'
import { api } from '../api'

const fields: Field[] = [
  { name: 'shipmentNo', label: '发货单号', required: true },
  { name: 'orderNo', label: '销售订单号', required: true },
  { name: 'customerName', label: '客户' },
  { name: 'shippingMethod', label: '物流渠道' },
  { name: 'trackingNo', label: '运单号', span: 2 },
  { name: 'warehouse', label: '发货仓库' },
  { name: 'shipDate', label: '发货日期' },
  { name: 'status', label: '状态', type: 'select', options: [{ label: '待发货', value: '待发货' }, { label: '已发货', value: '已发货' }, { label: '已签收', value: '已签收' }] },
  { name: 'remark', label: '备注', span: 2 },
]

const statusColor: Record<string, string> = { 待发货: 'orange', 已发货: 'blue', 已签收: 'success' }

export default function Shipments() {
  const markShipped = (record: any, reload: () => void) => (
    <Button
      type="link" size="small" icon={<CheckOutlined />}
      onClick={() => {
        api.update('shipments', record.id, { status: '已发货' })
          .then(() => { message.success('已标记为发货'); reload() })
          .catch((e: any) => message.error(e.message))
      }}
    >发货</Button>
  )

  const columns = [
    { title: '发货单号', dataIndex: 'shipmentNo', key: 'shipmentNo', width: 140 },
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 130 },
    { title: '客户', dataIndex: 'customerName', key: 'customerName' },
    { title: '物流渠道', dataIndex: 'shippingMethod', key: 'shippingMethod' },
    { title: '运单号', dataIndex: 'trackingNo', key: 'trackingNo' },
    { title: '仓库', dataIndex: 'warehouse', key: 'warehouse' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
    { title: '日期', dataIndex: 'shipDate', key: 'shipDate' },
  ]

  return <CrudPage collection="shipments" title="打单发货" desc="管理发货单、运单号与发货状态" fields={fields} columns={columns} extraActions={markShipped} />
}
