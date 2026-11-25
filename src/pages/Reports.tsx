import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Form, Select, Button, Table, Tag, message, Input, Space, Alert, Statistic, Modal } from 'antd'
import { BarChartOutlined, SaveOutlined, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons'
import { api } from '../api'

const sources = [
  { value: 'products', label: '商品' },
  { value: 'customers', label: '客户' },
  { value: 'suppliers', label: '供应商' },
  { value: 'salesOrders', label: '销售订单' },
  { value: 'purchaseOrders', label: '采购订单' },
  { value: 'stockLogs', label: '库存流水' },
  { value: 'payments', label: '资金流水' },
  { value: 'settlements', label: '结算单' },
  { value: 'invoices', label: '发票' },
  { value: 'expenses', label: '费用报销' },
]

export default function Reports() {
  const [form] = Form.useForm()
  const [source, setSource] = useState('salesOrders')
  const [fields, setFields] = useState<string[]>([])
  const [filters, setFilters] = useState<any[]>([])
  const [result, setResult] = useState<any>(null)
  const [saved, setSaved] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveForm] = Form.useForm()

  useEffect(() => {
    api.list('reports').then((r) => setSaved(r.data)).catch(() => {})
  }, [])

  // 切换数据源时拉取字段
  useEffect(() => {
    api.list(source).then((r: any) => {
      const cols = Object.keys(r.data[0] || {}).filter((k) => k !== '_id')
      setFields(cols.slice(0, 12)); form.setFieldsValue({ fields: cols.slice(0, 6) })
    }).catch(() => setFields([]))
  }, [source])

  const run = async () => {
    const v = await form.validateFields()
    setLoading(true)
    try {
      const r: any = await api.reportRun({
        collection: source,
        fields: v.fields || [],
        filters: (v.filters || []).map((f: any) => ({ field: f?.field, value: f?.value })),
      })
      setResult(r.data)
      message.success(`生成 ${r.data.total} 行`)
    } catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }

  const doSave = async () => {
    const v = await saveForm.validateFields()
    try {
      await api.create('reports', { name: v.name, collection: source, fields, filters })
      message.success('报表已保存'); setSaveOpen(false); saveForm.resetFields()
      setSaved((await api.list('reports')).data)
    } catch (e: any) { message.error(e.message) }
  }

  const loadSaved = async (r: any) => {
    setSource(r.collection)
    setFields(r.fields || [])
    form.setFieldsValue({ fields: r.fields || [], filters: r.filters || [] })
    try { const res: any = await api.reportRun({ collection: r.collection, fields: r.fields, filters: r.filters }); setResult(res.data) }
    catch (e: any) { message.error(e.message) }
  }

  return (
    <div>
      <Alert type="info" showIcon message="自定义报表设计器" description="选数据源 → 勾选字段 → 设筛选条件 → 生成报表，可保存常用报表下次一键打开。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="chart-card" title="报表配置" styles={{ body: { padding: 16 } }}>
            <Form form={form} layout="vertical" initialValues={{ fields: [] }}>
              <Form.Item label="数据源"><Select value={source} onChange={(v) => { setSource(v); setResult(null) }} options={sources} /></Form.Item>
              <Form.Item name="fields" label="显示字段">
                <Select mode="multiple" placeholder="选字段" options={fields.map((f) => ({ label: f, value: f }))} />
              </Form.Item>
              <Form.Item label="筛选条件（最多3条）">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {[0, 1, 2].map((i) => (
                    <Space key={i} style={{ width: '100%' }}>
                      <Form.Item name={['filters', i, 'field']} noStyle><Select placeholder="字段" style={{ width: 130 }} options={fields.map((f) => ({ label: f, value: f }))} allowClear /></Form.Item>
                      <Form.Item name={['filters', i, 'value']} noStyle><Input placeholder="包含..." style={{ width: 150 }} /></Form.Item>
                    </Space>
                  ))}
                </Space>
              </Form.Item>
              <Space>
                <Button type="primary" icon={<PlayCircleOutlined />} loading={loading} onClick={run}>生成报表</Button>
                <Button icon={<SaveOutlined />} onClick={() => setSaveOpen(true)}>保存</Button>
              </Space>
            </Form>
          </Card>
          <Card className="chart-card" title="已保存报表" styles={{ body: { padding: 12 } }} style={{ marginTop: 16 }}>
            {saved.length ? saved.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(127,127,127,.1)' }}>
                <Button type="link" onClick={() => loadSaved(r)} style={{ flex: 1, textAlign: 'left', padding: 0 }}>{r.name}</Button>
                <Tag>{sources.find((s) => s.value === r.collection)?.label || r.collection}</Tag>
                <PopConfirmDelete id={r.id} onDone={async () => { setSaved((await api.list('reports')).data) }} />
              </div>
            )) : <div style={{ color: '#888', padding: 16, textAlign: 'center' }}>暂无保存的报表</div>}
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card className="chart-card" title={`报表结果${result ? ` · ${result.total} 行` : ''}`} styles={{ body: { padding: 16 } }}>
            {result ? <Table size="small" dataSource={result.rows} rowKey={(_, i) => String(i)} scroll={{ x: 'max-content' }}
              columns={result.columns.map((c: string) => ({ title: c, dataIndex: c, key: c, ellipsis: true }))}
              pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 行` }} />
              : <div style={{ color: '#888', textAlign: 'center', padding: 60 }}>配置好后点「生成报表」</div>}
          </Card>
        </Col>
      </Row>

      <Modal open={saveOpen} title="保存报表" onOk={doSave} onCancel={() => setSaveOpen(false)} okText="保存" cancelText="取消">
        <Form form={saveForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="报表名称" rules={[{ required: true }]}><Input placeholder="如：本月销售明细" /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function PopConfirmDelete({ id, onDone }: any) {
  return <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={async () => { await api.remove('reports', id); message.success('已删除'); onDone() }} />
}
