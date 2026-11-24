import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, message, Input, Popconfirm, Alert, Row, Col, Card, Statistic, Modal } from 'antd'
import { SearchOutlined, ReloadOutlined, SendOutlined, EyeOutlined } from '@ant-design/icons'
import { api, money } from '../api'
import CrudPage, { Field } from './CrudPage'

// ============ 发票管理 ============
const invoiceFields: Field[] = [
  { name: 'invoiceNo', label: '发票号码', required: true },
  { name: 'direction', label: '类型', type: 'select', options: [{ label: '销项发票', value: '销项' }, { label: '进项发票', value: '进项' }] },
  { name: 'party', label: '客户/供应商' },
  { name: 'relatedNo', label: '关联单号' },
  { name: 'amount', label: '不含税金额', type: 'number' },
  { name: 'taxRate', label: '税率(%)', type: 'number' },
  { name: 'taxAmount', label: '税额', type: 'number' },
  { name: 'invoiceDate', label: '开票日期' },
  { name: 'status', label: '状态', type: 'select', options: [{ label: '待开票', value: '待开票' }, { label: '已开票', value: '已开票' }, { label: '已作废', value: '已作废' }] },
]
const invoiceCols = [
  { title: '发票号码', dataIndex: 'invoiceNo', key: 'invoiceNo', width: 150 },
  { title: '类型', dataIndex: 'direction', key: 'direction', width: 100, render: (v: string) => <Tag color={v === '销项' ? 'blue' : 'orange'}>{v === '销项' ? '销项' : '进项'}</Tag> },
  { title: '客户/供应商', dataIndex: 'party', key: 'party', width: 140 },
  { title: '关联单号', dataIndex: 'relatedNo', key: 'relatedNo', width: 130 },
  { title: '不含税金额', dataIndex: 'amount', key: 'amount', width: 120, align: 'right' as const, render: (v: number) => money(v) },
  { title: '税额', dataIndex: 'taxAmount', key: 'taxAmount', width: 100, align: 'right' as const, render: (v: number) => money(v) },
  { title: '价税合计', key: 'total', width: 120, align: 'right' as const, render: (_: any, r: any) => <b>{money(Number(r.amount || 0) + Number(r.taxAmount || 0))}</b> },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={v === '已开票' ? 'success' : v === '已作废' ? 'error' : 'orange'}>{v}</Tag> },
  { title: '开票日期', dataIndex: 'issuedAt', key: 'issuedAt', width: 110 },
]

function Invoices() {
  const extra = (record: any, reload: () => void) => record.status === '待开票'
    ? <Popconfirm title="确认标记为已开票？" okText="确认" cancelText="取消" onConfirm={async () => { try { const r: any = await api.invoiceIssue(record.id); message.success(r.message); reload() } catch (e: any) { message.error(e.message) } }}>
      <Button type="link" size="small" icon={<SendOutlined />}>开票</Button>
    </Popconfirm> : <Tag color="success">已开票</Tag>
  return <CrudPage collection="invoices" title="发票管理" desc="进项/销项发票登记、税额统计、开票状态跟踪" fields={invoiceFields} columns={invoiceCols} extraActions={extra} />
}

// ============ 操作审计日志 ============
function AuditLogs() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [detail, setDetail] = useState<any>(null)
  const load = () => {
    setLoading(true)
    api.list('auditLogs').then((r) => setRows(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = keyword.trim()
    ? rows.filter((r) => [r.actor, r.path, r.method].some((v) => String(v || '').toLowerCase().includes(keyword.toLowerCase())))
    : rows

  const cols = [
    { title: '时间', dataIndex: 'at', key: 'at', width: 175, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '操作人', dataIndex: 'actor', key: 'actor', width: 120 },
    { title: '角色', dataIndex: 'role', key: 'role', width: 90, render: (v: string) => <Tag>{v || '-'}</Tag> },
    { title: '方法', dataIndex: 'method', key: 'method', width: 80, render: (v: string) => <Tag color={v === 'DELETE' ? 'error' : v === 'POST' ? 'success' : 'blue'}>{v}</Tag> },
    { title: '接口路径', dataIndex: 'path', key: 'path', ellipsis: true },
    { title: 'IP', dataIndex: 'ip', key: 'ip', width: 120 },
    { title: '操作', key: 'action', width: 80, render: (_: any, r: any) => <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetail(r)}>详情</Button> },
  ]

  const todayCount = rows.filter((r) => r.at && new Date(r.at).toDateString() === new Date().toDateString()).length

  return (
    <div>
      <Alert type="info" showIcon message="操作审计" description="系统自动记录所有新增、修改、删除操作（谁、何时、哪个接口、提交内容），管理员可追溯，满足企业合规要求。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="操作总数" value={rows.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="今日操作" value={todayCount} valueStyle={{ color: '#16b364' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="删除操作" value={rows.filter((r) => r.method === 'DELETE').length} valueStyle={{ color: '#f04438' }} /></Card></Col>
      </Row>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input prefix={<SearchOutlined />} placeholder="搜索操作人/接口" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
      </div>
      <Table columns={cols} dataSource={filtered} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} />
      <Modal open={!!detail} title="操作详情" onCancel={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>关闭</Button>} width={680}>
        {detail && (
          <div>
            <p><b>操作人：</b>{detail.actor}（{detail.role || '-'}）</p>
            <p><b>时间：</b>{detail.at ? new Date(detail.at).toLocaleString('zh-CN') : '-'}</p>
            <p><b>接口：</b>{detail.method} {detail.path}</p>
            <p><b>IP：</b>{detail.ip || '-'}</p>
            <p><b>提交内容：</b></p>
            <pre style={{ background: 'rgba(127,127,127,.1)', padding: 12, borderRadius: 8, maxHeight: 300, overflow: 'auto', fontSize: 12 }}>{detail.body || '（无）'}</pre>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default function Compliance() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">发票 · 操作审计</h1>
        <p className="page-desc">发票全流程管理 + 所有写操作自动留痕，合规可追溯</p>
      </div>
      <Tabs items={[
        { key: 'invoice', label: '发票管理', children: <Invoices /> },
        { key: 'audit', label: '操作审计', children: <AuditLogs /> },
      ]} />
    </div>
  )
}
