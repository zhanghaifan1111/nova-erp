import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, Input, Modal, Form, InputNumber, DatePicker, Select, message, Alert, Row, Col, Card, Statistic, Popconfirm } from 'antd'
import { PlusOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api, money } from '../api'
import CrudPage, { Field } from './CrudPage'

const typeColor: Record<string, string> = { 资产: 'blue', 负债: 'orange', 所有者权益: 'purple', 损益: 'green', 成本: 'cyan' }

// ============ 会计科目 ============
const accountFields: Field[] = [
  { name: 'code', label: '科目编码', required: true },
  { name: 'name', label: '科目名称', required: true },
  { name: 'type', label: '类别', type: 'select', options: ['资产', '负债', '所有者权益', '损益', '成本'].map((v) => ({ label: v, value: v })) },
  { name: 'direction', label: '余额方向', type: 'select', options: [{ label: '借', value: '借' }, { label: '贷', value: '贷' }] },
  { name: 'status', label: '状态', type: 'select', options: [{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }] },
]
const accountCols = [
  { title: '编码', dataIndex: 'code', key: 'code', width: 100 },
  { title: '科目名称', dataIndex: 'name', key: 'name', width: 180 },
  { title: '类别', dataIndex: 'type', key: 'type', width: 120, render: (v: string) => <Tag color={typeColor[v] || 'default'}>{v}</Tag> },
  { title: '方向', dataIndex: 'direction', key: 'direction', width: 80, render: (v: string) => <Tag>{v}</Tag> },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag> },
]

function Accounts() {
  const [key, setKey] = useState(0)
  const init = async () => {
    try { const r: any = await api.glInitAccounts(); message.success(r.message); setKey((k) => k + 1) }
    catch (e: any) { message.error(e.message) }
  }
  return (
    <div>
      <div className="table-toolbar">
        <div className="table-toolbar-left"><span style={{ color: '#888' }}>会计科目采用中国会计准则常用科目编码</span></div>
        <Button icon={<PlusOutlined />} onClick={init}>初始化标准科目</Button>
      </div>
      <CrudPage key={key} collection="glAccounts" title="会计科目" desc="科目编码、类别、借贷方向" fields={accountFields} columns={accountCols} />
    </div>
  )
}

// ============ 记账凭证 ============
function Vouchers() {
  const [rows, setRows] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [lines, setLines] = useState([{ accountCode: '', debit: 0, credit: 0, summary: '' }, { accountCode: '', debit: 0, credit: 0, summary: '' }])
  const [detail, setDetail] = useState<any>(null)

  const load = () => {
    setLoading(true)
    Promise.all([api.list('vouchers'), api.list('glAccounts')])
      .then(([a, b]) => { setRows(a.data); setAccounts(b.data) })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const submit = async () => {
    const v = await form.validateFields()
    try {
      const r: any = await api.glVoucher({
        voucherNo: v.voucherNo, date: v.date ? dayjs(v.date).format('YYYY-MM-DD') : undefined,
        summary: v.summary, lines: lines.map((l: any) => ({ ...l, accountName: accounts.find((a) => a.code === l.accountCode)?.name || '' })),
      })
      message.success(r.message); setOpen(false); form.resetFields(); load()
    } catch (e: any) { message.error(e.message) }
  }

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01

  const cols = [
    { title: '凭证号', dataIndex: 'voucherNo', key: 'voucherNo', width: 150 },
    { title: '日期', dataIndex: 'date', key: 'date', width: 110 },
    { title: '摘要', dataIndex: 'summary', key: 'summary', ellipsis: true },
    { title: '分录数', key: 'cnt', width: 80, render: (_: any, r: any) => (r.lines || []).length },
    { title: '金额', dataIndex: 'total', key: 'total', width: 120, align: 'right' as const, render: (v: number) => money(v) },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color="success">{v}</Tag> },
    { title: '制单人', dataIndex: 'createdBy', key: 'createdBy', width: 110 },
    { title: '操作', key: 'action', width: 80, render: (_: any, r: any) => <Button type="link" size="small" onClick={() => setDetail(r)}>查看</Button> },
  ]

  return (
    <div>
      <Alert type="info" showIcon message="借贷记账法" description="每张凭证必须借贷平衡才能入账。系统自动校验，不平衡会拒绝。" style={{ marginBottom: 16 }} />
      <div className="table-toolbar">
        <div className="table-toolbar-left"><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button></div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ date: dayjs() }); setLines([{ accountCode: '', debit: 0, credit: 0, summary: '' }, { accountCode: '', debit: 0, credit: 0, summary: '' }]); setOpen(true) }}>录入凭证</Button>
      </div>
      <Table columns={cols} dataSource={rows} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />

      <Modal open={open} title="录入记账凭证" onOk={submit} onCancel={() => setOpen(false)} okText="记账" cancelText="取消" width={780}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="date" label="日期"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="voucherNo" label="凭证号（选填）"><Input placeholder="系统自动生成" /></Form.Item></Col>
          </Row>
          <Form.Item name="summary" label="摘要"><Input placeholder="凭证摘要" /></Form.Item>
        </Form>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>分录明细</div>
        <Table size="small" pagination={false} rowKey={(_, i) => String(i)}
          dataSource={lines}
          columns={[
            {
              title: '科目', dataIndex: 'accountCode', key: 'accountCode', width: 220,
              render: (v: string, r: any, i: number) => <Select value={v || undefined} placeholder="选择科目" showSearch optionFilterProp="label" style={{ width: '100%' }}
                options={accounts.map((a) => ({ label: `${a.code} ${a.name}`, value: a.code }))}
                onChange={(val) => { const ns = [...lines]; ns[i].accountCode = val; setLines(ns) }} />,
            },
            {
              title: '摘要', dataIndex: 'summary', key: 'summary',
              render: (v: string, r: any, i: number) => <Input value={v} placeholder="选填" onChange={(e) => { const ns = [...lines]; ns[i].summary = e.target.value; setLines(ns) }} />,
            },
            {
              title: '借方', dataIndex: 'debit', key: 'debit', width: 130,
              render: (v: number, r: any, i: number) => <InputNumber value={v} min={0} precision={2} style={{ width: '100%' }} onChange={(val) => { const ns = [...lines]; ns[i].debit = Number(val || 0); ns[i].credit = 0; setLines(ns) }} />,
            },
            {
              title: '贷方', dataIndex: 'credit', key: 'credit', width: 130,
              render: (v: number, r: any, i: number) => <InputNumber value={v} min={0} precision={2} style={{ width: '100%' }} onChange={(val) => { const ns = [...lines]; ns[i].credit = Number(val || 0); ns[i].debit = 0; setLines(ns) }} />,
            },
            {
              title: '', key: 'del', width: 50,
              render: (_: any, r: any, i: number) => lines.length > 2 ? <Button type="link" size="small" danger onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>删</Button> : null,
            },
          ]} />
        <Button type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 8 }} onClick={() => setLines([...lines, { accountCode: '', debit: 0, credit: 0, summary: '' }])}>增加分录</Button>
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          借方合计 <b>{money(totalDebit)}</b>　贷方合计 <b>{money(totalCredit)}</b>　
          <Tag color={balanced ? 'success' : 'error'} icon={balanced ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>{balanced ? '借贷平衡' : '不平衡'}</Tag>
        </div>
      </Modal>

      <Modal open={!!detail} title={`凭证 ${detail?.voucherNo || ''}`} onCancel={() => setDetail(null)} footer={null} width={720}>
        {detail && <>
          <p>{detail.date}　{detail.summary}</p>
          <Table size="small" pagination={false} rowKey={(_, i) => String(i)} dataSource={detail.lines}
            columns={[
              { title: '科目', dataIndex: 'accountCode', key: 'accountCode', render: (v: string, r: any) => `${v} ${r.accountName}` },
              { title: '摘要', dataIndex: 'summary', key: 'summary' },
              { title: '借方', dataIndex: 'debit', key: 'debit', align: 'right' as const, render: (v: number) => v ? money(v) : '-' },
              { title: '贷方', dataIndex: 'credit', key: 'credit', align: 'right' as const, render: (v: number) => v ? money(v) : '-' },
            ]} />
        </>}
      </Modal>
    </div>
  )
}

// ============ 科目余额表 ============
function Balance() {
  const [data, setData] = useState<any>(null)
  const load = () => api.glBalance().then((r: any) => setData(r.data)).catch((e) => message.error(e.message))
  useEffect(() => { load() }, [])
  const cols = [
    { title: '编码', dataIndex: 'code', key: 'code', width: 100 },
    { title: '科目', dataIndex: 'name', key: 'name', width: 180 },
    { title: '类别', dataIndex: 'type', key: 'type', width: 120, render: (v: string) => <Tag color={typeColor[v] || 'default'}>{v}</Tag> },
    { title: '方向', dataIndex: 'direction', key: 'direction', width: 70 },
    { title: '借方发生额', dataIndex: 'debit', key: 'debit', width: 140, align: 'right' as const, render: (v: number) => money(v) },
    { title: '贷方发生额', dataIndex: 'credit', key: 'credit', width: 140, align: 'right' as const, render: (v: number) => money(v) },
    { title: '余额', dataIndex: 'balance', key: 'balance', width: 140, align: 'right' as const, render: (v: number) => <b style={{ color: v < 0 ? '#f04438' : undefined }}>{money(v)}</b> },
  ]
  return (
    <div>
      <Alert type={data?.balanced ? 'success' : 'error'} showIcon
        message={data?.balanced ? '试算平衡：全部科目借方发生额 = 贷方发生额' : '试算不平衡：请检查凭证'}
        description={`借方合计 ${money(data?.totalDebit || 0)}　贷方合计 ${money(data?.totalCredit || 0)}`}
        style={{ marginBottom: 16 }} />
      <Table columns={cols} dataSource={data?.rows || []} rowKey="code" size="middle" loading={!data} pagination={false}
        summary={() => <Table.Summary.Row>
          <Table.Summary.Cell index={0} colSpan={4}><b>合计</b></Table.Summary.Cell>
          <Table.Summary.Cell index={4} align="right"><b>{money(data?.totalDebit || 0)}</b></Table.Summary.Cell>
          <Table.Summary.Cell index={5} align="right"><b>{money(data?.totalCredit || 0)}</b></Table.Summary.Cell>
          <Table.Summary.Cell index={6} align="right">-</Table.Summary.Cell>
        </Table.Summary.Row>} />
    </div>
  )
}

export default function Gl() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">会计总账</h1>
        <p className="page-desc">标准会计科目、借贷记账凭证、科目余额表、试算平衡——财务正规化的基础</p>
      </div>
      <Tabs items={[
        { key: 'accounts', label: '会计科目', children: <Accounts /> },
        { key: 'vouchers', label: '记账凭证', children: <Vouchers /> },
        { key: 'balance', label: '科目余额表', children: <Balance /> },
      ]} />
    </div>
  )
}
