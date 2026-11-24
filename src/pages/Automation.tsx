import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, Modal, Form, Input, Select, InputNumber, message, Alert, Row, Col, Card, Statistic } from 'antd'
import { PlayCircleOutlined, ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../api'
import CrudPage, { Field } from './CrudPage'

const condLabels: Record<string, string> = { lowStock: '库存低于安全线', overdueOrder: '订单超时未处理', overdueReceivable: '应收逾期未收' }
const actionLabels: Record<string, string> = { createPurchase: '生成采购单', notify: '发送通知', createAlert: '创建预警' }

function RuleRunner() {
  const [rules, setRules] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([api.list('automationRules'), api.list('ruleLogs')])
      .then(([a, b]) => { setRules(a.data); setLogs(b.data) })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const run = async (id: string) => {
    setRunning(id)
    try { const r: any = await api.ruleRun(id); message.success(r.message); load() }
    catch (e: any) { message.error(e.message) }
    finally { setRunning(null) }
  }
  const runAll = async () => {
    setRunning('all')
    try { const r: any = await api.ruleRunAll(); message.success(r.message); load() }
    catch (e: any) { message.error(e.message) }
    finally { setRunning(null) }
  }

  const cols = [
    { title: '规则名称', dataIndex: 'name', key: 'name', width: 180 },
    { title: '触发条件', dataIndex: ['condition', 'type'], key: 'cond', width: 160, render: (_: any, r: any) => condLabels[r.condition?.type] || r.condition?.type || '-' },
    { title: '执行动作', dataIndex: 'actions', key: 'actions', render: (v: string[]) => (v || []).map((a) => <Tag key={a} color="blue">{actionLabels[a] || a}</Tag>) },
    { title: '状态', dataIndex: 'enabled', key: 'enabled', width: 90, render: (v: string) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag> },
    { title: '上次命中', dataIndex: 'lastMatched', key: 'lastMatched', width: 100, align: 'right' as const, render: (v: number) => v ?? 0 },
    { title: '上次运行', dataIndex: 'lastRun', key: 'lastRun', width: 160, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '操作', key: 'action', width: 100, render: (_: any, r: any) => <Button type="link" size="small" icon={<PlayCircleOutlined />} loading={running === r.id} onClick={() => run(r.id)}>立即运行</Button> },
  ]
  const logCols = [
    { title: '时间', dataIndex: 'at', key: 'at', width: 175, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '规则', dataIndex: 'ruleName', key: 'ruleName', width: 160 },
    { title: '命中数', dataIndex: 'matched', key: 'matched', width: 90, align: 'right' as const },
    { title: '执行动作', dataIndex: 'actions', key: 'actions', ellipsis: true },
    { title: '触发方式', dataIndex: 'triggeredBy', key: 'triggeredBy', width: 110 },
  ]

  return (
    <div>
      <Alert type="info" showIcon message="自动化规则" description="设定「当…就…」规则，让系统替你盯库存、催订单、追应收。可手动运行，也可在规则管理中启用后批量运行。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="规则总数" value={rules.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="已启用" value={rules.filter((r) => r.enabled === '启用').length} valueStyle={{ color: '#16b364' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="运行记录" value={logs.length} valueStyle={{ color: '#f79009' }} /></Card></Col>
      </Row>
      <div className="table-toolbar">
        <div className="table-toolbar-left"><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button></div>
        <Button type="primary" icon={<ThunderboltOutlined />} loading={running === 'all'} onClick={runAll}>运行全部启用规则</Button>
      </div>
      <Table title={() => '规则列表'} columns={cols} dataSource={rules} rowKey="id" loading={loading} size="middle" pagination={false} style={{ marginBottom: 24 }} />
      <Table title={() => '运行日志'} columns={logCols} dataSource={logs} rowKey="id" size="middle" pagination={{ pageSize: 10 }} />
    </div>
  )
}

const ruleFields: Field[] = [
  { name: 'name', label: '规则名称', required: true },
  { name: 'conditionType', label: '触发条件', type: 'select', required: true, options: [
    { label: '库存低于安全线', value: 'lowStock' },
    { label: '订单超时未处理', value: 'overdueOrder' },
    { label: '应收逾期未收', value: 'overdueReceivable' },
  ] },
  { name: 'days', label: '天数阈值（订单/应收用）', type: 'number' },
  { name: 'actions', label: '执行动作', type: 'select', required: true, options: [
    { label: '生成采购单', value: 'createPurchase' }, { label: '发送通知', value: 'notify' }, { label: '创建预警', value: 'createAlert' },
  ] },
  { name: 'enabled', label: '状态', type: 'select', options: [{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }] },
]

export default function Automation() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">自动化规则引擎</h1>
        <p className="page-desc">配置「当…就…」规则，让系统自动盯库存、催订单、追应收</p>
      </div>
      <Tabs items={[
        { key: 'run', label: '规则运行', children: <RuleRunner /> },
        { key: 'manage', label: '规则配置', children: <div><Alert type="warning" showIcon message="字段映射说明" description="配置时用「触发条件」和「执行动作」下拉选择；天数阈值仅订单超时/应收逾期规则需要，留空用默认值。" style={{ marginBottom: 16 }} /><RuleConfig /></div> },
      ]} />
    </div>
  )
}

// 规则配置：把表单字段映射成后端的 condition/actions 结构
function RuleConfig() {
  const [rules, setRules] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const load = () => api.list('automationRules').then((r) => setRules(r.data)).catch((e) => message.error(e.message))
  useEffect(() => { load() }, [])
  const submit = async () => {
    const v = await form.validateFields()
    const actions = Array.isArray(v.actions) ? v.actions : [v.actions]
    try {
      await api.create('automationRules', {
        name: v.name,
        condition: { type: v.conditionType, days: Number(v.days || 0) },
        actions,
        enabled: v.enabled || '启用',
      })
      message.success('规则已创建'); setOpen(false); form.resetFields(); load()
    } catch (e: any) { message.error(e.message) }
  }
  const cols = [
    { title: '规则名称', dataIndex: 'name', key: 'name' },
    { title: '条件', key: 'cond', render: (_: any, r: any) => condLabels[r.condition?.type] || '-' },
    { title: '动作', key: 'act', render: (_: any, r: any) => (r.actions || []).map((a: string) => actionLabels[a] || a).join('、') },
    { title: '状态', dataIndex: 'enabled', key: 'enabled', render: (v: string) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag> },
  ]
  return (
    <div>
      <div className="table-toolbar">
        <div className="table-toolbar-left"><span style={{ color: '#888' }}>定义触发条件与执行动作</span></div>
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setOpen(true)}>新建规则</Button>
      </div>
      <Table columns={cols} dataSource={rules} rowKey="id" size="middle" pagination={false} />
      <Modal open={open} title="新建自动化规则" onOk={submit} onCancel={() => setOpen(false)} okText="创建" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} initialValues={{ enabled: '启用', days: 3 }}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input placeholder="如：库存不足自动生成采购单" /></Form.Item>
          <Form.Item name="conditionType" label="触发条件" rules={[{ required: true }]}>
            <Select options={[{ label: '库存低于安全线', value: 'lowStock' }, { label: '订单超时未处理', value: 'overdueOrder' }, { label: '应收逾期未收', value: 'overdueReceivable' }]} />
          </Form.Item>
          <Form.Item name="days" label="天数阈值（订单/应收用）"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="actions" label="执行动作（可多选）" rules={[{ required: true }]}>
            <Select mode="multiple" options={[{ label: '生成采购单', value: 'createPurchase' }, { label: '发送通知', value: 'notify' }, { label: '创建预警', value: 'createAlert' }]} />
          </Form.Item>
          <Form.Item name="enabled" label="状态"><Select options={[{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }]} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
