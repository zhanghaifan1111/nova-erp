import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, message, Modal, Form, Input, InputNumber, Select, DatePicker, Popconfirm, Alert, Row, Col, Card, Statistic } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, SendOutlined, PayCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api, money } from '../api'
import CrudPage, { Field } from './CrudPage'

const statusColor: Record<string, string> = { 待审批: 'orange', 通过: 'success', 驳回: 'error', 草稿: 'default', 审批中: 'processing', 待付款: 'blue', 已付款: 'success' }

// ============ 审批中心 ============
function Approvals() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [commentOpen, setCommentOpen] = useState<any>(null)
  const [form] = Form.useForm()
  const load = () => {
    setLoading(true)
    api.list('approvals').then((r) => setRows(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const doDecide = async (id: string, decision: string, comment?: string) => {
    try { const r: any = await api.approvalDecide(id, decision, comment); message.success(r.message); setCommentOpen(null); form.resetFields(); load() }
    catch (e: any) { message.error(e.message) }
  }
  const decide = (id: string, decision: string) => {
    if (decision === '驳回') { setCommentOpen({ id, decision }); form.resetFields() }
    else doDecide(id, decision)
  }
  const submitComment = async () => {
    const v = await form.validateFields()
    await doDecide(commentOpen.id, commentOpen.decision, v.comment)
  }

  const pending = rows.filter((r) => r.status === '待审批')
  const cols = [
    { title: '提交时间', dataIndex: 'createdAt', key: 'createdAt', width: 120 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 100, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '金额', dataIndex: 'amount', key: 'amount', width: 120, align: 'right' as const, render: (v: number) => money(v) },
    { title: '申请人', dataIndex: 'applicant', key: 'applicant', width: 110 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
    { title: '审批人', dataIndex: 'approver', key: 'approver', width: 110 },
    { title: '审批日期', dataIndex: 'approvedAt', key: 'approvedAt', width: 110 },
    { title: '备注', dataIndex: 'comment', key: 'comment', ellipsis: true },
    {
      title: '操作', key: 'action', width: 130,
      render: (_: any, r: any) => r.status === '待审批'
        ? <Space size={2}>
          <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => decide(r.id, '通过')}>通过</Button>
          <Button type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => decide(r.id, '驳回')}>驳回</Button>
        </Space>
        : <Tag color={statusColor[r.status]}>{r.status}</Tag>,
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="待审批" value={pending.length} valueStyle={{ color: '#f79009' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="已通过" value={rows.filter((r) => r.status === '通过').length} valueStyle={{ color: '#16b364' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="已驳回" value={rows.filter((r) => r.status === '驳回').length} valueStyle={{ color: '#f04438' }} /></Card></Col>
      </Row>
      <Alert type="info" showIcon message="审批联动" description="采购单审批通过 → 状态变「待入库」；费用报销审批通过 → 变「待付款」，付款后自动写资金流水。" style={{ marginBottom: 16 }} />
      <Table columns={cols} dataSource={rows} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />
      <Modal open={!!commentOpen} title="驳回原因" onOk={submitComment} onCancel={() => setCommentOpen(null)} okText="确认驳回" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="comment" label="驳回原因" rules={[{ required: true, message: '请填写驳回原因' }]}>
            <Input.TextArea rows={3} placeholder="说明驳回理由" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ============ 费用报销 ============
const expenseFields: Field[] = [
  { name: 'expenseNo', label: '报销单号', required: true },
  { name: 'applicant', label: '报销人' },
  { name: 'category', label: '费用类型', type: 'select', options: ['差旅费', '办公费', '交通费', '招待费', '采购费', '其他'].map((v) => ({ label: v, value: v })) },
  { name: 'amount', label: '金额', type: 'number', required: true },
  { name: 'expenseDate', label: '发生日期' },
  { name: 'status', label: '状态', type: 'select', options: [{ label: '草稿', value: '草稿' }, { label: '审批中', value: '审批中' }, { label: '待付款', value: '待付款' }, { label: '已付款', value: '已付款' }] },
  { name: 'note', label: '事由', span: 2 },
]
const expenseCols = [
  { title: '单号', dataIndex: 'expenseNo', key: 'expenseNo', width: 140 },
  { title: '报销人', dataIndex: 'applicant', key: 'applicant', width: 110 },
  { title: '类型', dataIndex: 'category', key: 'category', width: 100, render: (v: string) => <Tag color="blue">{v || '-'}</Tag> },
  { title: '金额', dataIndex: 'amount', key: 'amount', width: 110, align: 'right' as const, render: (v: number) => money(v) },
  { title: '日期', dataIndex: 'expenseDate', key: 'expenseDate', width: 110 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
  { title: '事由', dataIndex: 'note', key: 'note', ellipsis: true },
]

function Expenses() {
  const [rows, setRows] = useState<any[]>([])
  const load = () => api.list('expenses').then((r) => setRows(r.data)).catch((e) => message.error(e.message))
  useEffect(() => { load() }, [])
  const extra = (record: any, reload: () => void) => (
    <Space size={2}>
      {record.status === '草稿' && <Button type="link" size="small" icon={<SendOutlined />} onClick={async () => { try { const r: any = await api.expenseSubmitApproval(record.id); message.success(r.message); reload() } catch (e: any) { message.error(e.message) } }}>提交审批</Button>}
      {record.status === '待付款' && <Button type="link" size="small" icon={<PayCircleOutlined />} onClick={() => Modal.confirm({ title: '确认付款', content: '确认后标记已付款并写入资金流水。', okText: '确认', cancelText: '取消', onOk: async () => { try { const r: any = await api.expensePay(record.id); message.success(r.message); reload() } catch (e: any) { message.error(e.message) } } })}>付款</Button>}
    </Space>
  )
  return <CrudPage collection="expenses" title="费用报销" desc="报销登记 → 提交审批 → 审批通过 → 付款（自动写入资金流水）" fields={expenseFields} columns={expenseCols} extraActions={extra} />
}

export default function Workflow() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">审批中心 · 费用报销</h1>
        <p className="page-desc">企业级审批流，通过才生效，全程可追溯</p>
      </div>
      <Tabs items={[
        { key: 'approval', label: '审批中心', children: <Approvals /> },
        { key: 'expense', label: '费用报销', children: <Expenses /> },
      ]} />
    </div>
  )
}
