import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, message, Alert, Row, Col, Card, Statistic, Input, Space, Modal, Form, Select, InputNumber, Progress } from 'antd'
import { CustomerServiceOutlined, SearchOutlined, ThunderboltOutlined, PlusOutlined } from '@ant-design/icons'
import { api } from '../api'
import CrudPage, { Field } from './CrudPage'

// ============ 智能客服 ============
function SmartCs() {
  const [rules, setRules] = useState<any[]>([])
  const [blacklist, setBlacklist] = useState<any[]>([])
  const [testMessage, setTestMessage] = useState('')
  const [reply, setReply] = useState<any>(null)
  const [testing, setTesting] = useState(false)

  const load = () => {
    Promise.all([api.list('csRules'), api.list('blacklist')])
      .then(([a, b]: any[]) => { setRules(a.data); setBlacklist(b.data) })
      .catch((e: any) => message.error(e.message))
  }
  useEffect(() => { load() }, [])

  const test = async () => {
    setTesting(true)
    try { const r: any = await api.csAutoReply(testMessage); setReply(r.data) }
    catch (e: any) { message.error(e.message) }
    finally { setTesting(false) }
  }

  return (
    <div>
      <Alert type="info" showIcon message="智能客服" description="客户发来消息时，按关键词自动匹配规则给出建议回复；命中云黑名单则自动拦截。对标店小秘自动规则回复+云黑名单。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="回复规则" value={rules.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="黑名单" value={blacklist.length} valueStyle={{ color: '#f04438' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="启用规则" value={rules.filter((r) => r.enabled !== '停用').length} valueStyle={{ color: '#16b364' }} /></Card></Col>
      </Row>
      <Card className="chart-card" title={<span><CustomerServiceOutlined /> 自动回复测试台</span>} styles={{ body: { padding: 20 } }} style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input value={testMessage} onChange={(e) => setTestMessage(e.target.value)} placeholder="模拟客户消息，如：这个能便宜点吗？什么时候发货？" onPressEnter={test} />
          <Button type="primary" icon={<ThunderboltOutlined />} loading={testing} onClick={test}>匹配回复</Button>
        </Space.Compact>
        {reply && <div style={{ marginTop: 16 }}>
          {reply.blocked ? <Alert type="error" message="已拦截：命中云黑名单" description={reply.reason} />
            : reply.matched ? <Alert type="success" message={`匹配规则：${reply.rule.name}`} description={`分类：${reply.category} | 建议回复：${reply.reply}`} />
            : <Alert type="warning" message="未匹配到规则" description="建议新建一条关键词规则" />}
        </div>}
      </Card>
      <CrudPage collection="csRules" title="自动回复规则" desc="关键词匹配→自动回复" fields={[
        { name: 'name', label: '规则名称', required: true },
        { name: 'keywords', label: '关键词（逗号分隔）', required: true },
        { name: 'reply', label: '回复内容', required: true, span: 2 },
        { name: 'category', label: '分类', type: 'select', options: ['价格咨询', '物流咨询', '售后', '产品咨询', '其他'].map((v) => ({ label: v, value: v })) },
        { name: 'priority', label: '优先级（数字越大越高）', type: 'number' },
        { name: 'enabled', label: '状态', type: 'select', options: [{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }] },
      ]} columns={[
        { title: '规则名', dataIndex: 'name', key: 'name' },
        { title: '关键词', dataIndex: 'keywords', key: 'keywords' },
        { title: '回复', dataIndex: 'reply', key: 'reply', ellipsis: true },
        { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80, align: 'right' as const },
        { title: '状态', dataIndex: 'enabled', key: 'enabled', width: 80, render: (v: string) => <Tag color={v === '停用' ? 'default' : 'success'}>{v || '启用'}</Tag> },
      ]} />
      <Card className="chart-card" title="云黑名单" styles={{ body: { padding: 12 } }} style={{ marginTop: 16 }}>
        <CrudPage collection="blacklist" title="黑名单" desc="命中关键词的消息自动拦截" fields={[
          { name: 'keyword', label: '拦截关键词', required: true },
          { name: 'reason', label: '原因' },
          { name: 'active', label: '生效', type: 'select', options: [{ label: '是', value: '是' }, { label: '否', value: '否' }] },
        ]} columns={[
          { title: '关键词', dataIndex: 'keyword', key: 'keyword' },
          { title: '原因', dataIndex: 'reason', key: 'reason' },
          { title: '生效', dataIndex: 'active', key: 'active', render: (v: string) => <Tag color={v === '否' ? 'default' : 'error'}>{v === '否' ? '否' : '是'}</Tag> },
        ]} />
      </Card>
    </div>
  )
}

// ============ 选品与竞品 ============
const verdictColor: Record<string, string> = { 强烈推荐: 'success', 值得关注: 'blue', 观察: 'orange', 不推荐: 'default' }

function Research() {
  const [rows, setRows] = useState<any[]>([])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const score = async () => {
    setLoading(true)
    try { const r: any = await api.researchScore(rows); setResult(r.data); message.success(`已分析 ${r.data.analyzed} 个产品`) }
    catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    api.list('products_research').then((r: any) => setRows(r.data.map((x: any) => ({
      ...x,
      keywords: Array.isArray(x.keywords) ? x.keywords.join(',') : x.keywords,
    })))).catch(() => {})
  }, [])

  const cols = [
    { title: '产品', dataIndex: 'name', key: 'name', width: 160 },
    { title: '月销量', dataIndex: 'sales', key: 'sales', width: 100, align: 'right' as const },
    { title: '增速%', dataIndex: 'growth', key: 'growth', width: 90, align: 'right' as const, render: (v: number) => <span style={{ color: v >= 0 ? '#16b364' : '#f04438' }}>{v}%</span> },
    { title: '利润率%', dataIndex: 'margin', key: 'margin', width: 90, align: 'right' as const },
    { title: '竞争度', dataIndex: 'competition', key: 'competition', width: 90, align: 'right' as const, render: (v: number) => <Tag color={v <= 3 ? 'success' : v >= 7 ? 'error' : 'orange'}>{v}/10</Tag> },
  ]

  return (
    <div>
      <Alert type="info" showIcon message="选品评分模型" description="综合评分=销量40% + 增速30% + 利润率20% + 低竞争10%。≥80强烈推荐，65-79值得关注。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="候选产品" value={rows.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={12}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="强烈推荐" value={result?.rows.filter((r: any) => r.verdict === '强烈推荐').length || 0} valueStyle={{ color: '#16b364' }} /></Card></Col>
      </Row>
      <div className="table-toolbar"><div className="table-toolbar-left"><span style={{ color: '#888' }}>登记候选产品后点评分，系统按销量/增速/利润/竞争度排序</span></div><Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={score}>分析选品</Button></div>
      <CrudPage collection="products_research" title="候选产品" desc="选品池登记" fields={[
        { name: 'name', label: '产品名称', required: true },
        { name: 'sales', label: '月销量', type: 'number', required: true },
        { name: 'growth', label: '增速%', type: 'number' },
        { name: 'margin', label: '利润率%', type: 'number' },
        { name: 'competition', label: '竞争度1-10', type: 'number' },
        { name: 'platform', label: '平台' },
        { name: 'note', label: '备注', span: 2 },
      ]} columns={cols} />
      {result && <Card className="chart-card" title="选品分析结果" styles={{ body: { padding: 16 } }} style={{ marginTop: 16 }}>
        <Table size="small" pagination={false} rowKey="name" dataSource={result.rows}
          columns={[
            { title: '排名', key: 'rank', width: 60, render: (_: any, r: any, i: number) => `#${i + 1}` },
            { title: '产品', dataIndex: 'name', key: 'name' },
            { title: '综合评分', dataIndex: 'score', key: 'score', width: 180, render: (v: number) => <Progress percent={v} strokeColor={v >= 80 ? '#16b364' : v >= 65 ? '#4f6ef7' : '#f79009'} /> },
            { title: '结论', dataIndex: 'verdict', key: 'verdict', render: (v: string) => <Tag color={verdictColor[v]}>{v}</Tag> },
          ]} />
      </Card>}
      <Card className="chart-card" title="竞品追踪" styles={{ body: { padding: 12 } }} style={{ marginTop: 16 }}>
        <CrudPage collection="competitors" title="竞品" desc="记录竞品价格与排名，持续追踪" fields={[
          { name: 'name', label: '竞品名称', required: true },
          { name: 'platform', label: '平台' },
          { name: 'ourSku', label: '对应自家SKU' },
          { name: 'price', label: '竞品售价', type: 'number' },
          { name: 'rank', label: '类目排名', type: 'number' },
          { name: 'rating', label: '评分', type: 'number' },
          { name: 'note', label: '备注', span: 2 },
        ]} columns={[
          { title: '竞品', dataIndex: 'name', key: 'name' },
          { title: '平台', dataIndex: 'platform', key: 'platform' },
          { title: '自家SKU', dataIndex: 'ourSku', key: 'ourSku' },
          { title: '售价', dataIndex: 'price', key: 'price', align: 'right' as const },
          { title: '排名', dataIndex: 'rank', key: 'rank', align: 'right' as const },
          { title: '评分', dataIndex: 'rating', key: 'rating', align: 'right' as const },
        ]} />
      </Card>
    </div>
  )
}

export default function CsResearch() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">智能客服 · 选品竞品</h1>
        <p className="page-desc">自动回复+云黑名单，选品评分+竞品追踪——对标店小秘运营工具</p>
      </div>
      <Tabs items={[
        { key: 'cs', label: '智能客服', children: <SmartCs /> },
        { key: 'research', label: '选品竞品', children: <Research /> },
      ]} />
    </div>
  )
}
