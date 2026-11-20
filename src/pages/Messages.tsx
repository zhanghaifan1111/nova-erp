import React, { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Input, Modal, Form, Select, message, Tabs, Card, Statistic, Row, Col } from 'antd'
import { SearchOutlined, ReloadOutlined, MessageOutlined, SendOutlined } from '@ant-design/icons'
import { api } from '../api'
import CrudPage, { Field } from './CrudPage'

const templateFields: Field[] = [
  { name: 'title', label: '模板名称', required: true },
  { name: 'content', label: '回复内容', required: true, span: 2 },
  { name: 'platform', label: '适用平台' },
]

const templateColumns = [
  { title: '模板名称', dataIndex: 'title', key: 'title' },
  { title: '平台', dataIndex: 'platform', key: 'platform', render: (v: string) => <Tag color="blue">{v || '通用'}</Tag> },
  { title: '回复内容', dataIndex: 'content', key: 'content', ellipsis: true },
]

const statusColor: Record<string, string> = { 未读: 'error', 已读: 'processing', 已回复: 'success', 已关闭: 'default' }
const typeColor: Record<string, string> = { 咨询: 'blue', 售后: 'orange', 评价: 'purple', 其他: 'default' }

function MessageInbox() {
  const [rows, setRows] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [replyTo, setReplyTo] = useState<any>(null)
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    Promise.all([api.list('messages'), api.list('replyTemplates')])
      .then(([a, b]) => { setRows(a.data); setTemplates(b.data) })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const openReply = (record: any) => {
    setReplyTo(record)
    form.resetFields()
  }

  const submitReply = async () => {
    const v = await form.validateFields()
    try {
      const r: any = await api.replyMessage(replyTo.id, v.content)
      message.success(r.message || '回复成功')
      setReplyTo(null); form.resetFields(); load()
    } catch (e: any) { message.error(e.message) }
  }

  const useTemplate = (content: string) => { form.setFieldsValue({ content }) }

  const markRead = async (record: any) => {
    try { await api.update('messages', record.id, { status: '已读' }); load() }
    catch (e: any) { message.error(e.message) }
  }

  const filtered = keyword.trim()
    ? rows.filter((r) => [r.customerName, r.content, r.shopName].some((v) => String(v || '').toLowerCase().includes(keyword.toLowerCase())))
    : rows
  const unread = rows.filter((r) => r.status === '未读')

  const columns = [
    { title: '平台', dataIndex: 'platform', key: 'platform', width: 100, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '店铺', dataIndex: 'shopName', key: 'shopName', width: 120 },
    { title: '客户', dataIndex: 'customerName', key: 'customerName', width: 120 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 90, render: (v: string) => <Tag color={typeColor[v] || 'default'}>{v}</Tag> },
    { title: '消息内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 120 },
    {
      title: '操作', key: 'action', width: 130,
      render: (_: any, r: any) => (
        <Space size={2}>
          {r.status === '未读' && <Button type="link" size="small" onClick={() => markRead(r)}>已读</Button>}
          {r.status !== '已关闭' && <Button type="link" size="small" icon={<SendOutlined />} onClick={() => openReply(r)}>回复</Button>}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="消息总数" value={rows.length} valueStyle={{ color: '#4f6ef7' }} prefix={<MessageOutlined />} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="未读消息" value={unread.length} valueStyle={{ color: '#f04438' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="已回复" value={rows.filter((r) => r.status === '已回复').length} valueStyle={{ color: '#16b364' }} /></Card></Col>
      </Row>

      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input prefix={<SearchOutlined />} placeholder="搜索客户/内容/店铺" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 260 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
      </div>
      <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />

      <Modal open={!!replyTo} title={`回复 ${replyTo?.customerName || '客户'}`} onOk={submitReply} onCancel={() => setReplyTo(null)} okText="发送回复" cancelText="取消" width={600}>
        {replyTo && (
          <div style={{ marginBottom: 16, padding: 12, background: 'rgba(127,127,127,.08)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>客户消息（{replyTo.platform} · {replyTo.shopName}）</div>
            <div>{replyTo.content}</div>
          </div>
        )}
        {templates.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>快捷回复模板（点击填入）</div>
            <Space wrap>
              {templates.map((t) => <Button key={t.id} size="small" onClick={() => useTemplate(t.content)}>{t.title}</Button>)}
            </Space>
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="content" label="回复内容" rules={[{ required: true, message: '请输入回复内容' }]}>
            <Input.TextArea rows={5} placeholder="输入回复内容，或点上方模板快捷填入" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function Messages() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">客户消息聚合</h1>
        <p className="page-desc">聚合多店铺客户咨询与售后消息，快捷模板回复，状态全程追踪</p>
      </div>
      <Tabs items={[
        { key: 'inbox', label: '消息收件箱', children: <MessageInbox /> },
        { key: 'templates', label: '回复模板', children: <CrudPage collection="replyTemplates" title="回复模板" desc="维护常用快捷回复话术" fields={templateFields} columns={templateColumns} /> },
      ]} />
    </div>
  )
}
