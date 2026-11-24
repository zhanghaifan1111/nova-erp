import React, { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Button, Space, Input, DatePicker, Modal, Form, message, Tabs, Alert, Select } from 'antd'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api } from '../api'
import CrudPage, { Field } from './CrudPage'

const stageColor: Record<string, string> = {
  初步接触: 'default', 需求确认: 'blue', 报价中: 'orange', 谈判中: 'purple', 已成交: 'success', 已流失: 'error',
}

function FollowUps() {
  const [rows, setRows] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    Promise.all([api.list('followUps'), api.list('customers')])
      .then(([a, b]) => { setRows(a.data); setCustomers(b.data) })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const submit = async () => {
    const v = await form.validateFields()
    try {
      const r: any = await api.followUp({
        ...v,
        nextDate: v.nextDate ? dayjs(v.nextDate).format('YYYY-MM-DD') : '',
      })
      message.success(r.message); setOpen(false); form.resetFields(); load()
    } catch (e: any) { message.error(e.message) }
  }

  const today = dayjs().format('YYYY-MM-DD')
  const overdue = rows.filter((r) => r.nextDate && r.nextDate < today && r.stage !== '已成交' && r.stage !== '已流失')
  const todayDue = rows.filter((r) => r.nextDate === today)

  const filtered = keyword.trim()
    ? rows.filter((r) => [r.customerName, r.content, r.result].some((v) => String(v || '').toLowerCase().includes(keyword.toLowerCase())))
    : rows

  const cols = [
    { title: '日期', dataIndex: 'followDate', key: 'followDate', width: 110 },
    { title: '客户', dataIndex: 'customerName', key: 'customerName', width: 140 },
    { title: '阶段', dataIndex: 'stage', key: 'stage', width: 100, render: (v: string) => <Tag color={stageColor[v] || 'default'}>{v}</Tag> },
    { title: '方式', dataIndex: 'method', key: 'method', width: 90 },
    { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '结果', dataIndex: 'result', key: 'result', ellipsis: true },
    {
      title: '下次跟进', dataIndex: 'nextDate', key: 'nextDate', width: 120,
      render: (v: string, r: any) => v
        ? <Tag color={v < today && r.stage !== '已成交' ? 'error' : v === today ? 'orange' : 'default'}>{v}{v < today && r.stage !== '已成交' ? ' 逾期' : v === today ? ' 今天' : ''}</Tag>
        : '-',
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="跟进总数" value={rows.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="今日待跟进" value={todayDue.length} valueStyle={{ color: '#f79009' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="已逾期" value={overdue.length} valueStyle={{ color: '#f04438' }} /></Card></Col>
      </Row>
      {(overdue.length > 0 || todayDue.length > 0) && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          message={`今日 ${todayDue.length} 条待跟进，${overdue.length} 条已逾期`}
          description="建议尽快联系客户，避免商机流失。" />
      )}
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input prefix={<SearchOutlined />} placeholder="搜索客户/内容" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)} disabled={!customers.length}>记录跟进</Button>
      </div>
      <Table columns={cols} dataSource={filtered} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />

      <Modal open={open} title="记录客户跟进" onOk={submit} onCancel={() => setOpen(false)} okText="保存" cancelText="取消" width={600}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} initialValues={{ stage: '初步接触', method: '电话' }}>
          <Form.Item name="customerId" label="客户" rules={[{ required: true, message: '请选择客户' }]}>
            <Select showSearch optionFilterProp="label" placeholder="选择客户"
              options={customers.map((c) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Form.Item name="stage" label="商机阶段">
            <Select options={['初步接触', '需求确认', '报价中', '谈判中', '已成交', '已流失'].map((v) => ({ label: v, value: v }))} />
          </Form.Item>
          <Form.Item name="method" label="跟进方式">
            <Select options={['电话', '微信', '邮件', '上门', '平台消息', '其他'].map((v) => ({ label: v, value: v }))} />
          </Form.Item>
          <Form.Item name="content" label="跟进内容" rules={[{ required: true, message: '请输入跟进内容' }]}>
            <Input.TextArea rows={3} placeholder="沟通了什么" />
          </Form.Item>
          <Form.Item name="result" label="结果"><Input placeholder="客户反馈/结论，选填" /></Form.Item>
          <Form.Item name="nextDate" label="下次跟进日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function Crm() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">客户跟进 CRM</h1>
        <p className="page-desc">跟进记录、商机阶段、下次跟进提醒，不让客户跟丢</p>
      </div>
      <FollowUps />
    </div>
  )
}
