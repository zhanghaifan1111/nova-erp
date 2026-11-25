import React, { useState } from 'react'
import { Card, Row, Col, Form, Input, Button, message, Alert, Tag, Space, Typography, Steps, Select, InputNumber, Divider, Spin } from 'antd'
import { RocketOutlined, RobotOutlined, TranslationOutlined, SafetyCertificateOutlined, CalculatorOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { api, money } from '../api'

const { Text, Paragraph } = Typography
const { TextArea } = Input

// 超越点：店小秘做同样的事要跳4个模块，这里一步到位
export default function ListingStudio() {
  const [form] = Form.useForm()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const run = async () => {
    const v = await form.validateFields()
    setLoading(true)
    setStep(0)
    try {
      const name = v.name
      // Step 0: AI 描述
      const desc: any = await api.aiDescription({ name, keywords: v.keywords, sellingPoints: v.sellingPoints, category: v.category, language: v.language, tone: v.tone })
      setResult((r: any) => ({ ...r, desc: desc.data })); setStep(1)
      await sleep(400)
      // Step 1: 合规检测
      const compliance: any = await api.aiCompliance(desc.data.title + '\n' + desc.data.description, v.platform)
      setResult((r: any) => ({ ...r, compliance: compliance.data })); setStep(2)
      await sleep(400)
      // Step 2: 翻译（若非中文）
      if (v.language !== 'zh') {
        const tr: any = await api.aiTranslate(desc.data.title, 'zh', v.language === 'en' ? 'en' : v.language)
        setResult((r: any) => ({ ...r, translation: tr.data }))
      }
      setStep(3)
      await sleep(400)
      // Step 3: 定价
      const pricing: any = await api.pricingSuggest({ cost: v.cost, platformFee: v.platformFee, shipping: v.shipping, commissionRate: v.commission, profitRate: v.profit })
      setResult((r: any) => ({ ...r, pricing: pricing.data })); setStep(4)
      message.success('Listing 全套方案生成完成')
    } catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }

  const copyAll = () => {
    if (!result) return
    const txt = `标题：${result.desc?.title}\n\n${result.desc?.description}\n\n建议售价：${money(result.pricing?.suggestPrice || 0)}\n合规检测：${result.compliance?.passed ? '通过' : '有违禁词'}`
    navigator.clipboard?.writeText(txt); message.success('完整方案已复制')
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">一站式 Listing 工作台</h1>
        <p className="page-desc">对标店小秘，但更进一步——描述/合规/翻译/定价一次生成，不用跳转 4 个模块</p>
      </div>
      <Alert type="success" showIcon message="这就是我们的超越点" description="店小秘要分别在「AI描述」「一键翻译」「违禁词检测」「定价计算」四个模块操作；我们一次输入，全流程自动串联，一步到位。" style={{ marginBottom: 16 }} />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card className="chart-card" title={<span><RocketOutlined /> 产品信息（一次填完）</span>} styles={{ body: { padding: 20 } }}>
            <Form form={form} layout="vertical" initialValues={{
              language: 'en', platform: '亚马逊', tone: 'professional',
              cost: 30, platformFee: 3, shipping: 12, commission: 15, profit: 30,
            }}>
              <Form.Item name="name" label="产品名称" rules={[{ required: true }]}><Input placeholder="如：磁吸无线移动电源 20000mAh" /></Form.Item>
              <Form.Item name="category" label="类目"><Input placeholder="如：3C数码" /></Form.Item>
              <Form.Item name="keywords" label="关键词"><Input placeholder="磁吸,快充,大容量" /></Form.Item>
              <Form.Item name="sellingPoints" label="核心卖点"><Input placeholder="20000mAh,磁吸快充,轻巧便携" /></Form.Item>
              <Row gutter={10}>
                <Col span={12}><Form.Item name="language" label="生成语言"><Select options={[{ label: '中文', value: 'zh' }, { label: 'English', value: 'en' }]} /></Form.Item></Col>
                <Col span={12}><Form.Item name="platform" label="目标平台"><Select options={['亚马逊', 'Shopee', 'TikTok', 'Temu'].map((v) => ({ label: v, value: v }))} /></Form.Item></Col>
              </Row>
              <Divider orientation="left" plain style={{ fontSize: 12 }}>定价参数</Divider>
              <Row gutter={10}>
                <Col span={8}><Form.Item name="cost" label="成本"><InputNumber min={0} style={{ width: '100%' }} prefix="¥" /></Form.Item></Col>
                <Col span={8}><Form.Item name="platformFee" label="固定费"><InputNumber min={0} style={{ width: '100%' }} prefix="¥" /></Form.Item></Col>
                <Col span={8}><Form.Item name="shipping" label="运费"><InputNumber min={0} style={{ width: '100%' }} prefix="¥" /></Form.Item></Col>
              </Row>
              <Row gutter={10}>
                <Col span={12}><Form.Item name="commission" label="佣金%"><InputNumber min={0} max={99} style={{ width: '100%' }} addonAfter="%" /></Form.Item></Col>
                <Col span={12}><Form.Item name="profit" label="目标利润%"><InputNumber min={1} max={99} style={{ width: '100%' }} addonAfter="%" /></Form.Item></Col>
              </Row>
              <Button type="primary" icon={<RocketOutlined />} loading={loading} onClick={run} block size="large">一键生成全套方案</Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={15}>
          <Card className="chart-card" title="生成流水线" styles={{ body: { padding: 20 } }}>
            <Steps direction="vertical" size="small" current={step} style={{ marginBottom: 20 }} items={[
              { title: 'AI 生成描述', description: '标题 + 卖点 + 规格 + 营销文案', icon: <RobotOutlined /> },
              { title: '合规检测', description: '目标平台违禁词扫描', icon: <SafetyCertificateOutlined /> },
              { title: '多语言翻译', description: '电商词典本地化', icon: <TranslationOutlined /> },
              { title: '智能定价', description: '按目标利润反推售价', icon: <CalculatorOutlined /> },
            ]} />
            {loading && <div style={{ textAlign: 'center', padding: 20 }}><Spin tip="正在生成..." /></div>}
            {result && !loading && <>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={copyAll} style={{ marginBottom: 16 }}>复制完整方案</Button>
              <div style={{ border: '1px solid var(--color-border-tertiary)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <Text strong>建议标题</Text>
                <Paragraph style={{ marginTop: 6, marginBottom: 0 }}>{result.desc?.title}</Paragraph>
              </div>
              <div style={{ border: '1px solid var(--color-border-tertiary)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <Text strong>商品描述</Text>
                <Paragraph style={{ whiteSpace: 'pre-wrap', marginTop: 6, marginBottom: 0 }}>{result.desc?.description}</Paragraph>
              </div>
              <Space wrap style={{ marginBottom: 12 }}>
                <Alert type={result.compliance?.passed ? 'success' : 'error'} showIcon message={result.compliance?.suggestion} style={{ minWidth: 300 }} />
              </Space>
              {result.translation && <div style={{ border: '1px solid var(--color-border-tertiary)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <Text strong>翻译后标题</Text><Paragraph style={{ marginTop: 6, marginBottom: 0 }}>{result.translation.translated}</Paragraph>
              </div>}
              <div style={{ background: 'var(--color-background-info)', borderRadius: 8, padding: 16 }}>
                <Text strong>建议售价</Text>
                <div style={{ fontSize: 30, fontWeight: 500, color: '#4f6ef7', margin: '6px 0' }}>{money(result.pricing?.suggestPrice || 0)}</div>
                <Tag color="green">目标利润 {result.pricing?.profitRate}%</Tag>
                <Tag>佣金 {money(result.pricing?.commission || 0)}</Tag>
                <Tag>利润 {money(result.pricing?.profit || 0)}</Tag>
              </div>
            </>}
            {!result && !loading && <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>左侧填好产品信息，点「一键生成全套方案」</div>}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
