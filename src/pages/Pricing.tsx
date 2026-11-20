import React, { useState } from 'react'
import { Card, Form, InputNumber, Button, Row, Col, Statistic, Divider, Alert } from 'antd'
import { CalculatorOutlined } from '@ant-design/icons'
import { api, money } from '../api'

export default function Pricing() {
  const [form] = Form.useForm()
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const calc = async () => {
    const values = await form.validateFields()
    setError('')
    try {
      const r = await api.pricing(values)
      setResult(r.data)
    } catch (e: any) { setError(e.message); setResult(null) }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">定价计算器</h1>
        <p className="page-desc">根据成本、运费、平台佣金和目标利润率，反推建议售价</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<span><CalculatorOutlined style={{ marginRight: 8 }} />输入参数</span>} className="chart-card">
            <Form form={form} layout="vertical" initialValues={{ cost: 50, shipping: 20, commissionRate: 15, targetMargin: 30, otherFee: 0 }}>
              <Form.Item name="cost" label="商品成本价（¥）" rules={[{ required: true, message: '请输入成本' }]}>
                <InputNumber min={0} precision={2} style={{ width: '100%' }} addonAfter="¥" />
              </Form.Item>
              <Form.Item name="shipping" label="运费（¥）" rules={[{ required: true, message: '请输入运费' }]}>
                <InputNumber min={0} precision={2} style={{ width: '100%' }} addonAfter="¥" />
              </Form.Item>
              <Form.Item name="commissionRate" label="平台佣金率（%）" rules={[{ required: true, message: '请输入佣金率' }]}>
                <InputNumber min={0} max={99} precision={1} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
              <Form.Item name="targetMargin" label="目标利润率（%）" rules={[{ required: true, message: '请输入目标利润率' }]}>
                <InputNumber min={0} max={99} precision={1} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
              <Form.Item name="otherFee" label="其他费用（¥）">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} addonAfter="¥" />
              </Form.Item>
              <Button type="primary" size="large" block onClick={calc}>计算建议售价</Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="计算结果" className="chart-card">
            {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
            {!result && !error && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                <CalculatorOutlined style={{ fontSize: 48, marginBottom: 16, opacity: .4 }} />
                <div>填写左侧参数，点击「计算建议售价」</div>
              </div>
            )}
            {result && (
              <>
                <div style={{ textAlign: 'center', padding: '20px 0', background: 'linear-gradient(135deg,rgba(79,110,247,.1),rgba(124,92,255,.1))', borderRadius: 12, marginBottom: 20 }}>
                  <div style={{ color: '#888', fontSize: 13 }}>建议售价</div>
                  <div style={{ fontSize: 40, fontWeight: 800, color: '#4f6ef7' }}>{money(result.price)}</div>
                  <div style={{ color: '#16b364', fontSize: 13, marginTop: 4 }}>预期利润率 {result.margin}%</div>
                </div>
                <Row gutter={[16, 16]}>
                  <Col span={12}><Statistic title="平台佣金" value={result.commission} precision={2} prefix="¥" valueStyle={{ color: '#7c5cff', fontSize: 18 }} /></Col>
                  <Col span={12}><Statistic title="单件利润" value={result.profit} precision={2} prefix="¥" valueStyle={{ color: '#16b364', fontSize: 18 }} /></Col>
                </Row>
                <Divider />
                <div style={{ color: '#888', fontSize: 12, lineHeight: 1.8 }}>
                  计算公式：售价 = (成本 + 运费 + 其他费用) ÷ (1 − 佣金率 − 目标利润率)<br />
                  该价格可保证在扣除各项费用后，达到你设定的目标利润率。
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
