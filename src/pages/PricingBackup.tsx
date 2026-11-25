import React, { useEffect, useState } from 'react'
import { Tabs, Card, Row, Col, Form, InputNumber, Button, message, Alert, Statistic, Table, Tag, Space, Upload, Progress, Modal, Typography, Select } from 'antd'
import { CalculatorOutlined, DownloadOutlined, UploadOutlined, DatabaseOutlined, InboxOutlined } from '@ant-design/icons'
import { api, money } from '../api'

const { Text, Paragraph } = Typography
const { Dragger } = Upload

// ============ 智能定价 ============
function SmartPricing() {
  const [form] = Form.useForm()
  const [result, setResult] = useState<any>(null)
  const [platform, setPlatform] = useState('Shopee')

  const calc = async () => {
    const v = await form.validateFields()
    try { const r: any = await api.pricingSuggest(v); setResult(r.data) }
    catch (e: any) { message.error(e.message) }
  }

  const platforms: Record<string, { commission: number }> = {
    Shopee: { commission: 6 }, Amazon: { commission: 15 }, TikTok: { commission: 5 },
    Temu: { commission: 0 }, 独立站: { commission: 0 },
  }

  return (
    <div>
      <Alert type="info" showIcon message="定价公式" description="建议售价 =（商品成本 + 平台固定费 + 运费）/（1 − 平台佣金率 − 目标利润率）。先定利润，反推该卖多少钱。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card className="chart-card" title={<span><CalculatorOutlined /> 定价参数</span>} styles={{ body: { padding: 20 } }}>
            <Form form={form} layout="vertical" initialValues={{ cost: 50, platformFee: 2, shipping: 15, commissionRate: 6, profitRate: 30 }}>
              <Form.Item label="目标平台">
                <Select value={platform} onChange={(v) => { setPlatform(v); form.setFieldsValue({ commissionRate: platforms[v].commission }) }}
                  options={Object.keys(platforms).map((p) => ({ label: p, value: p }))} />
              </Form.Item>
              <Form.Item name="cost" label="商品成本" rules={[{ required: true }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" /></Form.Item>
              <Form.Item name="platformFee" label="平台固定费"><InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" /></Form.Item>
              <Form.Item name="shipping" label="运费"><InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" /></Form.Item>
              <Form.Item name="commissionRate" label="平台佣金率 (%)"><InputNumber min={0} max={99} style={{ width: '100%' }} addonAfter="%" /></Form.Item>
              <Form.Item name="profitRate" label="目标利润率 (%)"><InputNumber min={1} max={99} style={{ width: '100%' }} addonAfter="%" /></Form.Item>
              <Button type="primary" icon={<CalculatorOutlined />} onClick={calc}>计算建议售价</Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card className="chart-card" title="定价结果" styles={{ body: { padding: 20 } }}>
            {result ? <>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Text type="secondary">建议售价</Text>
                <div style={{ fontSize: 42, fontWeight: 700, color: '#4f6ef7' }}>{money(result.suggestPrice)}</div>
                <Tag color="green">目标利润率 {result.profitRate}%</Tag>
              </div>
              <Table size="small" pagination={false} rowKey="k" dataSource={[
                { k: '商品成本', v: money(result.cost) },
                { k: '固定费+运费', v: money(result.fixed) },
                { k: '平台佣金', v: money(result.commission) + ` (${result.commissionRate}%)` },
                { k: '目标利润', v: money(result.profit) },
                { k: '实际毛利率', v: result.margin + '%' },
              ]} columns={[{ title: '项目', dataIndex: 'k', key: 'k' }, { title: '金额', dataIndex: 'v', key: 'v', align: 'right' as const }]} />
              <Paragraph type="secondary" style={{ marginTop: 16 }}>计算式：{result.formula}</Paragraph>
            </> : <div style={{ color: '#888', textAlign: 'center', padding: 60 }}>填好参数点「计算建议售价」</div>}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// ============ 数据备份恢复 ============
function Backup() {
  const [health, setHealth] = useState<any>(null)
  const [backupData, setBackupData] = useState<any>(null)
  const [restoring, setRestoring] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => { api.systemHealth().then((r: any) => setHealth(r.data)).catch(() => {}) }, [])

  const doExport = async () => {
    try {
      message.loading('正在打包备份…', 0)
      const r: any = await api.backupExport()
      message.destroy()
      setBackupData(r.data)
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `erp-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
      URL.revokeObjectURL(url)
      message.success(`已备份 ${r.data.collections} 类数据`)
    } catch (e: any) { message.destroy(); message.error(e.message) }
  }

  const beforeUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try { setBackupData(JSON.parse(String(reader.result))); message.success('备份文件已载入，可恢复') }
      catch { message.error('备份文件格式错误') }
    }
    reader.readAsText(file)
    return false
  }

  const doRestore = async () => {
    if (!backupData?.data) { message.warning('请先载入备份文件'); return }
    Modal.confirm({
      title: '确认恢复数据', content: '将备份中的数据合并回系统（已存在的跳过，不覆盖）。建议先备份当前数据。',
      okText: '确认恢复', cancelText: '取消',
      onOk: async () => {
        setRestoring(true); setProgress(30)
        try { const r: any = await api.backupRestore(backupData.data, 'skip'); setProgress(100); message.success(r.message) }
        catch (e: any) { message.error(e.message) }
        finally { setRestoring(false); setTimeout(() => setProgress(0), 1000) }
      },
    })
  }

  const cols = Object.entries(health?.counts || {}).map(([k, v]) => ({ key: k, name: k, count: v as number }))
  return (
    <div>
      <Alert type="warning" showIcon message="数据安全提醒" description="备份包含全部业务数据但不含账号密码。请妥善保管备份文件，定期备份防止数据丢失。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card className="chart-card" title={<span><DownloadOutlined /> 数据备份</span>} styles={{ body: { padding: 20 } }}>
            <Paragraph type="secondary">导出全部业务数据为 JSON 文件，可用于归档或迁移。</Paragraph>
            <Statistic title="当前系统数据总量" value={health?.totalRecords || 0} suffix="条" valueStyle={{ color: '#4f6ef7' }} />
            <Button type="primary" icon={<DownloadOutlined />} onClick={doExport} style={{ marginTop: 16 }}>一键备份下载</Button>
            <Table style={{ marginTop: 16 }} size="small" pagination={false} rowKey="key" dataSource={cols.slice(0, 8)}
              columns={[{ title: '数据集合', dataIndex: 'name', key: 'name' }, { title: '记录数', dataIndex: 'count', key: 'count', align: 'right' as const }]} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="chart-card" title={<span><UploadOutlined /> 数据恢复</span>} styles={{ body: { padding: 20 } }}>
            <Paragraph type="secondary">载入之前备份的 JSON 文件，合并回系统。</Paragraph>
            <Dragger accept=".json" beforeUpload={beforeUpload} showUploadList={false}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽备份 JSON 文件</p>
            </Dragger>
            {progress > 0 && <Progress percent={progress} style={{ marginTop: 16 }} />}
            <Button type="primary" danger icon={<UploadOutlined />} loading={restoring} onClick={doRestore} disabled={!backupData} style={{ marginTop: 16 }}>恢复数据</Button>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default function PricingBackup() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">智能定价 · 数据备份</h1>
        <p className="page-desc">按目标利润反推售价，一键备份恢复保障数据安全</p>
      </div>
      <Tabs items={[
        { key: 'pricing', label: '智能定价', children: <SmartPricing /> },
        { key: 'backup', label: '数据备份恢复', children: <Backup /> },
      ]} />
    </div>
  )
}
