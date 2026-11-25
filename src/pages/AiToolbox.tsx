import React, { useState } from 'react'
import { Tabs, Card, Row, Col, Form, Input, Button, message, Alert, Tag, Select, InputNumber, Space, Typography } from 'antd'
import { RobotOutlined, TranslationOutlined, SafetyCertificateOutlined, CopyOutlined } from '@ant-design/icons'
import { api } from '../api'
import CrudPage, { Field } from './CrudPage'

const { Text, Paragraph } = Typography

// ============ AI 描述生成 ============
function Description() {
  const [form] = Form.useForm()
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const gen = async () => {
    const v = await form.validateFields()
    setLoading(true)
    try { const r: any = await api.aiDescription(v); setResult(r.data); message.success('描述已生成') }
    catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }
  const copy = (text: string) => { navigator.clipboard?.writeText(text); message.success('已复制') }
  return (
    <div>
      <Alert type="info" showIcon message="AI 描述生成" description="输入产品名、卖点、关键词，一键生成结构化商品标题+五点描述+规格+营销文案。本地规则引擎，不依赖外部 API，可离线运行。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card className="chart-card" title={<span><RobotOutlined /> 产品信息</span>} styles={{ body: { padding: 20 } }}>
            <Form form={form} layout="vertical" initialValues={{ language: 'zh', tone: 'standard' }}>
              <Form.Item name="name" label="产品名称" rules={[{ required: true }]}><Input placeholder="如：磁吸无线移动电源" /></Form.Item>
              <Form.Item name="category" label="类目"><Input placeholder="如：3C数码 / 家居" /></Form.Item>
              <Form.Item name="keywords" label="关键词（逗号分隔）"><Input placeholder="快充,大容量,便携,磁吸" /></Form.Item>
              <Form.Item name="sellingPoints" label="卖点（逗号分隔）"><Input placeholder="20000mAh大容量,磁吸快充,轻巧便携" /></Form.Item>
              <Row gutter={12}>
                <Col span={12}><Form.Item name="language" label="语言"><Select options={[{ label: '中文', value: 'zh' }, { label: 'English', value: 'en' }]} /></Form.Item></Col>
                <Col span={12}><Form.Item name="tone" label="风格"><Select options={[{ label: '标准', value: 'standard' }, { label: '专业', value: 'professional' }]} /></Form.Item></Col>
              </Row>
              <Button type="primary" icon={<RobotOutlined />} loading={loading} onClick={gen}>生成描述</Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card className="chart-card" title="生成结果" styles={{ body: { padding: 20 } }} extra={result && <Button size="small" icon={<CopyOutlined />} onClick={() => copy(result.title + '\n\n' + result.description)}>复制全部</Button>}>
            {result ? <>
              <div style={{ background: 'var(--color-background-secondary)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <Text strong>标题：</Text><span>{result.title}</span>
                <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => copy(result.title)} style={{ float: 'right' }} />
              </div>
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>{result.description}</Paragraph>
              <Tag>{result.language === 'en' ? 'English' : '中文'}</Tag> <Tag>{result.wordCount} 字符</Tag>
            </> : <div style={{ color: '#888', textAlign: 'center', padding: 60 }}>填好信息点「生成描述」</div>}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// ============ 一键翻译 ============
function Translate() {
  const [text, setText] = useState('高品质手机壳 防水便携 多种颜色可选')
  const [from, setFrom] = useState('zh')
  const [to, setTo] = useState('en')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const doTranslate = async () => {
    setLoading(true)
    try { const r: any = await api.aiTranslate(text, from, to); setResult(r.data) }
    catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }
  return (
    <div>
      <Alert type="warning" showIcon message="翻译说明" description="内置电商常用词词典（手机壳/防水/高品质等），采用最长匹配替换，适合标题与卖点快速本地化。整段文学性翻译需接入专业翻译 API。" style={{ marginBottom: 16 }} />
      <Card className="chart-card" title={<span><TranslationOutlined /> 一键翻译</span>} styles={{ body: { padding: 20 } }}>
        <Space style={{ marginBottom: 12 }}>
          <Select value={from} onChange={setFrom} style={{ width: 100 }} options={[{ label: '中文', value: 'zh' }]} />
          <span>→</span>
          <Select value={to} onChange={setTo} style={{ width: 120 }} options={[{ label: '英语', value: 'en' }, { label: '日语', value: 'ja' }, { label: '韩语', value: 'ko' }]} />
        </Space>
        <Input.TextArea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="输入要翻译的标题/卖点" style={{ marginBottom: 12 }} />
        <Button type="primary" icon={<TranslationOutlined />} loading={loading} onClick={doTranslate}>翻译</Button>
        {result && <div style={{ marginTop: 20, padding: 16, background: 'var(--color-background-secondary)', borderRadius: 8 }}>
          <Text type="secondary">翻译结果（匹配 {result.matchedTerms} 个词条）：</Text>
          <Paragraph style={{ marginTop: 8, marginBottom: 0, fontSize: 15 }}>{result.translated}</Paragraph>
          <Button size="small" icon={<CopyOutlined />} onClick={() => { navigator.clipboard?.writeText(result.translated); message.success('已复制') }} style={{ marginTop: 8 }}>复制</Button>
        </div>}
      </Card>
    </div>
  )
}

// ============ 合规检测 ============
function Compliance() {
  const [text, setText] = useState('全网最低价 100%正品 最好用的手机壳')
  const [platform, setPlatform] = useState('亚马逊')
  const [result, setResult] = useState<any>(null)
  const check = async () => {
    try { const r: any = await api.aiCompliance(text, platform); setResult(r.data) }
    catch (e: any) { message.error(e.message) }
  }
  return (
    <div>
      <Alert type="info" showIcon message="违禁词检测" description="按平台检测标题/描述中的极限词、虚假宣传词，避免 listing 被平台强制下架。对标店小秘合规检测。" style={{ marginBottom: 16 }} />
      <Card className="chart-card" title={<span><SafetyCertificateOutlined /> 合规检测</span>} styles={{ body: { padding: 20 } }}>
        <Select value={platform} onChange={setPlatform} style={{ width: 140, marginBottom: 12 }} options={[{ label: '通用', value: '通用' }, { label: '亚马逊', value: '亚马逊' }, { label: 'Shopee', value: 'Shopee' }, { label: 'TikTok', value: 'TikTok' }]} />
        <Input.TextArea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="输入标题或描述" style={{ marginBottom: 12 }} />
        <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={check}>检测</Button>
        {result && <div style={{ marginTop: 20 }}>
          <Alert type={result.passed ? 'success' : 'error'} showIcon message={result.suggestion} />
          {result.found.length > 0 && <div style={{ marginTop: 12 }}><Text type="secondary">命中违禁词：</Text>{result.found.map((w: string) => <Tag key={w} color="red" style={{ marginLeft: 6 }}>{w}</Tag>)}</div>}
        </div>}
      </Card>
    </div>
  )
}

export default function AiToolbox() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">AI 工具箱</h1>
        <p className="page-desc">AI描述、一键翻译、违禁词检测——本地可运行，对标店小秘 AI 能力</p>
      </div>
      <Tabs items={[
        { key: 'desc', label: 'AI 描述生成', children: <Description /> },
        { key: 'translate', label: '一键翻译', children: <Translate /> },
        { key: 'compliance', label: '合规检测', children: <Compliance /> },
      ]} />
    </div>
  )
}
