import React, { useEffect, useState } from 'react'
import { Table, Tag, Button, Drawer, Descriptions, Input, Select, Space, message, Statistic, Row, Col, Card } from 'antd'
import { SearchOutlined, ReloadOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { api, money } from '../api'
import OrderModal from './OrderModal'

type Props = {
  collection: 'salesOrders' | 'purchaseOrders'
  title: string
  desc: string
  partyLabel: '客户' | '供应商'
  partyCollection: 'customers' | 'suppliers'
  statuses: string[]
  noPrefix: string
}

const statusColor: Record<string, string> = {
  已完成: 'success', 已发货: 'blue', 待发货: 'orange', 待付款: 'red', 待收货: 'cyan', 已取消: 'default',
}

export default function OrderPage({ collection, title, desc, partyLabel, partyCollection, statuses, noPrefix }: Props) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [detail, setDetail] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [parties, setParties] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  const load = () => {
    setLoading(true)
    Promise.all([api.list(collection), api.list(partyCollection), api.list('products')])
      .then(([o, p, pr]) => { setRows(o.data); setParties(p.data); setProducts(pr.data) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [collection])

  let filtered = rows
  if (statusFilter) filtered = filtered.filter((r) => r.status === statusFilter)
  if (keyword.trim()) {
    const kw = keyword.toLowerCase()
    filtered = filtered.filter((r) => (r.orderNo || '').toLowerCase().includes(kw) || (r[partyLabel === '客户' ? 'customerName' : 'supplierName'] || '').toLowerCase().includes(kw))
  }

  const total = filtered.filter((o) => o.status !== '已取消').reduce((s, o) => s + o.total, 0)

  const columns = [
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 140, fixed: 'left' as const },
    { title: partyLabel, dataIndex: partyLabel === '客户' ? 'customerName' : 'supplierName', key: 'party', width: 150 },
    { title: '商品明细', key: 'items', render: (_: any, r: any) => <span style={{ color: '#888' }}>{r.items?.length || 0} 种商品 · {r.items?.reduce((s: number, i: any) => s + i.qty, 0) || 0} 件</span> },
    { title: '订单金额', dataIndex: 'total', key: 'total', align: 'right' as const, sorter: (a: any, b: any) => a.total - b.total, render: (v: number) => <span className="num-strong">{money(v)}</span> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
    { title: '下单日期', dataIndex: 'orderDate', key: 'orderDate', width: 120 },
    { title: '操作', key: 'action', fixed: 'right' as const, width: 80, render: (_: any, r: any) => <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetail(r)}>详情</Button> },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-desc">{desc}</p>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card size="small"><Statistic title="订单总数" value={filtered.length} suffix="单" /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="有效订单额" value={total} precision={2} prefix="¥" valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="待处理" value={filtered.filter((o) => ['待发货', '待收货', '待付款'].includes(o.status)).length} suffix="单" valueStyle={{ color: '#f79009' }} /></Card></Col>
      </Row>

      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input prefix={<SearchOutlined />} placeholder={`搜索订单号 / ${partyLabel}`} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
          <Select allowClear placeholder="状态筛选" value={statusFilter} onChange={setStatusFilter} style={{ width: 140 }} options={statuses.map((s) => ({ label: s, value: s }))} />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建订单</Button>
      </div>

      <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} size="middle" scroll={{ x: 'max-content' }} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }} />

      <Drawer title={`订单详情 · ${detail?.orderNo || ''}`} width={560} open={!!detail} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="订单号">{detail.orderNo}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={statusColor[detail.status] || 'default'}>{detail.status}</Tag></Descriptions.Item>
              <Descriptions.Item label={partyLabel}>{detail[partyLabel === '客户' ? 'customerName' : 'supplierName']}</Descriptions.Item>
              <Descriptions.Item label="日期">{detail.orderDate}</Descriptions.Item>
              <Descriptions.Item label="商品种类">{detail.items?.length} 种</Descriptions.Item>
              <Descriptions.Item label="总件数">{detail.items?.reduce((s: number, i: any) => s + i.qty, 0)} 件</Descriptions.Item>
            </Descriptions>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>商品明细</div>
            <Table
              size="small" pagination={false} rowKey="sku"
              dataSource={detail.items || []}
              columns={[
                { title: 'SKU', dataIndex: 'sku', key: 'sku' },
                { title: '商品', dataIndex: 'name', key: 'name' },
                { title: '数量', dataIndex: 'qty', key: 'qty', align: 'right' as const },
                { title: '单价', dataIndex: 'price', key: 'price', align: 'right' as const, render: (v: number) => money(v) },
                { title: '小计', key: 'sub', align: 'right' as const, render: (_: any, r: any) => <span className="num-strong">{money(r.qty * r.price)}</span> },
              ]}
              summary={() => <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={4} align="right"><b>合计</b></Table.Summary.Cell><Table.Summary.Cell index={1} align="right"><b style={{ color: '#4f6ef7' }}>{money(detail.total)}</b></Table.Summary.Cell></Table.Summary.Row>}
            />
          </>
        )}
      </Drawer>

      <OrderModal
        open={modalOpen}
        title={`新建${title}`}
        partyLabel={partyLabel}
        parties={parties}
        products={products}
        statuses={statuses}
        noPrefix={noPrefix}
        onCancel={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); load(); message.success('订单创建成功') }}
        save={(values) => api.create(collection, values)}
      />
    </div>
  )
}
