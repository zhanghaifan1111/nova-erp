import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, Input, message, Modal, Form, InputNumber, Alert, Row, Col, Card, Statistic, Descriptions, Select } from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import { api } from '../api'
import CrudPage, { Field } from './CrudPage'

const qcStatus: Record<string, string> = { 待检: 'orange', 合格: 'success', 不合格: 'error' }

// ============ 质检管理 ============
function Quality() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [judge, setJudge] = useState<any>(null)
  const [form] = Form.useForm()
  const load = () => {
    setLoading(true)
    api.list('qualityChecks').then((r) => setRows(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const doJudge = async () => {
    const v = await form.validateFields()
    try {
      const r: any = await api.qcJudge(judge.id, v.result, v.passQty, v.note)
      message.success(r.message); setJudge(null); form.resetFields(); load()
    } catch (e: any) { message.error(e.message) }
  }

  const cols = [
    { title: '质检单号', dataIndex: 'qcNo', key: 'qcNo', width: 150 },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: '商品', dataIndex: 'productName', key: 'productName', ellipsis: true },
    { title: '送检数', dataIndex: 'qty', key: 'qty', width: 90, align: 'right' as const },
    { title: '方式', dataIndex: 'method', key: 'method', width: 90 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={qcStatus[v] || 'default'}>{v}</Tag> },
    { title: '检验日期', dataIndex: 'checkedAt', key: 'checkedAt', width: 110 },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, r: any) => r.status === '待检' ? <Button type="link" size="small" onClick={() => { setJudge(r); form.resetFields(); form.setFieldsValue({ result: '合格', passQty: r.qty }) }}>判定</Button> : '-',
    },
  ]

  return (
    <div>
      <Alert type="info" showIcon message="质检联动" description="判定合格 → 自动增加商品库存并写入库流水；判定不合格 → 发通知提醒退货处理。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="质检单" value={rows.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="待检" value={rows.filter((r) => r.status === '待检').length} valueStyle={{ color: '#f79009' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="合格" value={rows.filter((r) => r.status === '合格').length} valueStyle={{ color: '#16b364' }} /></Card></Col>
      </Row>
      <CrudPage collection="qualityChecks" title="质检单" desc="入库抽检/全检登记" fields={[
        { name: 'qcNo', label: '质检单号', required: true },
        { name: 'sku', label: 'SKU' },
        { name: 'productId', label: '商品ID（合格自动入库用）' },
        { name: 'productName', label: '商品名称', span: 2 },
        { name: 'qty', label: '送检数', type: 'number' },
        { name: 'method', label: '方式', type: 'select', options: [{ label: '抽检', value: '抽检' }, { label: '全检', value: '全检' }] },
        { name: 'status', label: '状态', type: 'select', options: [{ label: '待检', value: '待检' }, { label: '合格', value: '合格' }, { label: '不合格', value: '不合格' }] },
      ]} columns={cols} />
      <Modal open={!!judge} title={`质检判定 · ${judge?.qcNo || ''}`} onOk={doJudge} onCancel={() => setJudge(null)} okText="确认判定" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="result" label="判定结果" rules={[{ required: true }]}>
            <Select options={[{ label: '合格（自动入库）', value: '合格' }, { label: '不合格（退货处理）', value: '不合格' }]} />
          </Form.Item>
          <Form.Item name="passQty" label="合格数量（入库数）"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="note" label="备注"><Input.TextArea rows={2} placeholder="检验情况说明" /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ============ 批次追溯 ============
function BatchTrace() {
  const [rows, setRows] = useState<any[]>([])
  const [keyword, setKeyword] = useState('')
  const [trace, setTrace] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.list('batches').then((r) => { setRows(r.data); setLoading(false) }).catch((e) => message.error(e.message))
  }, [])
  const doTrace = async (batchNo: string) => {
    try { const r: any = await api.batchTrace(batchNo); setTrace(r.data) }
    catch (e: any) { message.error(e.message) }
  }
  const cols = [
    { title: '批次号', dataIndex: 'batchNo', key: 'batchNo', width: 160 },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: '商品', dataIndex: 'productName', key: 'productName', ellipsis: true },
    { title: '数量', dataIndex: 'qty', key: 'qty', width: 90, align: 'right' as const },
    { title: '入库来源', dataIndex: 'source', key: 'source', width: 140 },
    { title: '生产/入库日期', dataIndex: 'produceDate', key: 'produceDate', width: 120 },
    { title: '有效期', dataIndex: 'expiryDate', key: 'expiryDate', width: 110 },
    { title: '操作', key: 'action', width: 90, render: (_: any, r: any) => <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => doTrace(r.batchNo)}>追溯</Button> },
  ]
  return (
    <div>
      <Alert type="info" showIcon message="批次追溯" description="给商品建批次号，入库/出库流水关联批次后，点「追溯」可看该批次全部流转记录。" style={{ marginBottom: 16 }} />
      <CrudPage collection="batches" title="批次管理" desc="批次号、来源、效期登记" fields={[
        { name: 'batchNo', label: '批次号', required: true },
        { name: 'sku', label: 'SKU' },
        { name: 'productName', label: '商品名称', span: 2 },
        { name: 'qty', label: '数量', type: 'number' },
        { name: 'source', label: '入库来源（采购单号等）' },
        { name: 'produceDate', label: '生产/入库日期' },
        { name: 'expiryDate', label: '有效期' },
      ]} columns={cols} />
      <Modal open={!!trace} title={`批次追溯 · ${trace?.batch?.batchNo || ''}`} onCancel={() => setTrace(null)} footer={null} width={720}>
        {trace && <>
          <Descriptions size="small" bordered column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="SKU">{trace.batch.sku}</Descriptions.Item>
            <Descriptions.Item label="商品">{trace.batch.productName}</Descriptions.Item>
            <Descriptions.Item label="数量">{trace.batch.qty}</Descriptions.Item>
            <Descriptions.Item label="来源">{trace.batch.source || '-'}</Descriptions.Item>
          </Descriptions>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>流转记录（{trace.traceCount} 条）</div>
          <Table size="small" pagination={false} rowKey={(_, i) => String(i)} dataSource={trace.logs}
            columns={[
              { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag color={v === '入库' ? 'success' : 'blue'}>{v}</Tag> },
              { title: '数量', dataIndex: 'qty', key: 'qty', align: 'right' as const },
              { title: '关联单号', dataIndex: 'relatedNo', key: 'relatedNo' },
              { title: '说明', dataIndex: 'note', key: 'note' },
            ]} />
          {!trace.logs.length && <Alert type="info" message="该批次暂无关联的库存流水。在出入库时填入此批次号作为关联单号即可追溯。" style={{ marginTop: 12 }} />}
        </>}
      </Modal>
    </div>
  )
}

export default function QualityTrace() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">质检管理 · 批次追溯</h1>
        <p className="page-desc">合格自动入库、不合格自动提醒；批次全链路可追溯</p>
      </div>
      <Tabs items={[
        { key: 'qc', label: '质检管理', children: <Quality /> },
        { key: 'batch', label: '批次追溯', children: <BatchTrace /> },
      ]} />
    </div>
  )
}
