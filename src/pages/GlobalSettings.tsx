import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Select, Button, message, Alert, Input, Tag, Table, Statistic, Space, Typography, Progress } from 'antd'
import { GlobalOutlined, DollarOutlined, CheckCircleOutlined, WarningOutlined, BulbOutlined } from '@ant-design/icons'
import { api, getDisplayCurrency, setDisplayCurrency, CurrencySetting } from '../api'
import { useAppTheme } from '../theme'

const { Text, Paragraph } = Typography

export default function GlobalSettings() {
  const [currency, setCurrency] = useState<CurrencySetting>(getDisplayCurrency())
  const [rates, setRates] = useState<any[]>([])
  const { lang, setLang } = useAppTheme()

  // 文案助手
  const [title, setTitle] = useState('')
  const [checkResult, setCheckResult] = useState<any>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    api.list('exchangeRates').then((r: any) => setRates(r.data)).catch(() => {})
  }, [])

  const changeCurrency = (code: string) => {
    if (code === 'CNY') {
      setDisplayCurrency({ code: 'CNY', symbol: '¥', rate: 1 })
      message.success('已切换为人民币显示')
    } else {
      const r = rates.find((x) => x.currency === code)
      if (!r) { message.error('未找到该币种汇率'); return }
      setDisplayCurrency({ code, symbol: code + ' ', rate: Number(r.rate) })
      message.success(`已切换为 ${code} 显示（汇率 ${r.rate}），正在刷新…`)
    }
    setCurrency(getDisplayCurrency())
    setTimeout(() => window.location.reload(), 600)
  }

  const doCheck = async () => {
    if (!title.trim()) { message.warning('请输入商品标题'); return }
    setChecking(true)
    try { const r: any = await api.titleCheck(title); setCheckResult(r.data) }
    catch (e: any) { message.error(e.message) }
    finally { setChecking(false) }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">多语言 · 多币种 · 文案助手</h1>
        <p className="page-desc">界面语言、全局显示币种、商品标题优化建议——跨境出海必备</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card className="chart-card" title={<span><GlobalOutlined /> 界面语言</span>} styles={{ body: { padding: 20 } }}>
            <Alert type="info" showIcon message="语言说明" description="切换 Ant Design 组件（日期选择、分页、表单提示等）的中文/英文显示。业务模块文案以中文为主。" style={{ marginBottom: 16 }} />
            <div style={{ marginBottom: 12 }}>
              <Text strong>当前语言：</Text>
              <Tag color="blue" style={{ marginLeft: 8 }}>{lang === 'zh' ? '简体中文' : 'English'}</Tag>
            </div>
            <Select value={lang} onChange={(v) => { setLang(v); message.success('语言已切换') }} style={{ width: 200 }}
              options={[{ label: '简体中文', value: 'zh' }, { label: 'English', value: 'en' }]} />
          </Card>

          <Card className="chart-card" title={<span><DollarOutlined /> 全局显示币种</span>} styles={{ body: { padding: 20 } }} style={{ marginTop: 16 }}>
            <Alert type="warning" showIcon message="重要说明" description="切换后全系统所有金额（报表、订单、库存、财务等）按汇率换算显示。此功能只改变「显示」，不改变数据库里的人民币原值。" style={{ marginBottom: 16 }} />
            <div style={{ marginBottom: 12 }}>
              <Text strong>当前显示币种：</Text>
              <Tag color="green" style={{ marginLeft: 8 }}>{currency.code} ({currency.symbol})</Tag>
            </div>
            <Select value={currency.code} onChange={changeCurrency} style={{ width: 240 }}
              options={[{ label: '¥ CNY 人民币', value: 'CNY' }, ...rates.map((r) => ({ label: `${r.currency} ${r.name || ''}（汇率 ${r.rate}）`, value: r.currency }))]} />
            {!rates.length && <Paragraph type="secondary" style={{ marginTop: 12 }}>暂无其他币种，请先在「拣货单 · 汇率」里添加汇率。</Paragraph>}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card className="chart-card" title={<span><BulbOutlined /> 商品标题优化助手</span>} styles={{ body: { padding: 20 } }}>
            <Alert type="info" showIcon message="检查维度" description="标题长度、连续空格、平台违禁词、关键词数量、品牌前置等，给出优化建议与评分。" style={{ marginBottom: 16 }} />
            <Input.TextArea rows={3} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="粘贴商品标题，如：Portable Bluetooth Speaker 20W Waterproof..." style={{ marginBottom: 12 }} />
            <Button type="primary" loading={checking} onClick={doCheck}>检查标题</Button>
            {checkResult && (
              <div style={{ marginTop: 20 }}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong>优化评分：</Text>
                  <Progress percent={checkResult.score} strokeColor={checkResult.score >= 80 ? '#16b364' : checkResult.score >= 60 ? '#f79009' : '#f04438'} style={{ width: 200 }} />
                </div>
                <Paragraph><Text type="secondary">标题长度：</Text>{checkResult.length} 字符</Paragraph>
                {checkResult.issues.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong style={{ color: '#f04438' }}><WarningOutlined /> 问题：</Text>
                    {checkResult.issues.map((i: string, idx: number) => <div key={idx} style={{ color: '#f04438', marginLeft: 16 }}>• {i}</div>)}
                  </div>
                )}
                {checkResult.suggestions.length > 0 && (
                  <div>
                    <Text strong style={{ color: '#16b364' }}><CheckCircleOutlined /> 建议：</Text>
                    {checkResult.suggestions.map((s: string, idx: number) => <div key={idx} style={{ color: '#16b364', marginLeft: 16 }}>• {s}</div>)}
                  </div>
                )}
                {!checkResult.issues.length && !checkResult.suggestions.length && <Alert type="success" message="标题质量很好，无需修改" />}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
