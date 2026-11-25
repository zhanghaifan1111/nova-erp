import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, message, Alert, Row, Col, Card, Statistic, Space, Modal, Form } from 'antd'
import { AuditOutlined, SyncOutlined, ThunderboltOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons'
import { api, money } from '../api'
import CrudPage, { Field } from './CrudPage'

// ============ 自动审单 ============
function AutoReview() {
  const [rules, setRules] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [result, setResult] = useState<any>(null)
  const [testing, setTesting] = useState(false)

  const load = () => {
    Promise.all([api.list('orderRules'), api.list('salesOrders')]).then(([a, b]: any[]) => { setRules(a.data); setOrders(b.data) }).catch((e) => message.error(e.message))
  }
  useEffect(() => { load() }, [])

  const test = async (orderNo: string) => {
    setTesting(true)
    try { const r: any = await api.orderRuleEvaluate(orderNo); setResult(r.data); load() }
    catch (e: any) { message.error(e.message) }
    finally { setTesting(false) }
  }
  const batch = async () => {
    try { const r: any = await api.orderRuleBatch(); message.success(r.message); load() }
    catch (e: any) { message.error(e.message) }
  }

  return (
    <div>
      <Alert type="info" showIcon message="自动审单（对标店小秘智能规则）" description="按金额区间/关键词/地区设置规则，命中后自动审核通过或拦截，并智能分配最低成本物流渠道。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="审单规则" value={rules.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="待审核订单" value={orders.filter((o) => ['待审核', '新建'].includes(o.status)).length} valueStyle={{ color: '#f79009' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="已拦截" value={orders.filter((o) => o.status === '已拦截').length} valueStyle={{ color: '#f04438' }} /></Card></Col>
      </Row>
      <div className="table-toolbar"><div className="table-toolbar-left"><span style={{ color: '#888' }}>逐单测试或批量审单</span></div><Button type="primary" icon={<ThunderboltOutlined />} onClick={batch}>批量审单</Button></div>
      <Card className="chart-card" title="订单测试" styles={{ body: { padding: 12 } }} style={{ marginBottom: 16 }}>
        <Table size="small" pagination={{ pageSize: 8 }} rowKey="orderNo" dataSource={orders.filter((o) => ['待审核', '新建', '待发货'].includes(o.status))}
          columns={[
            { title: '订单号', dataIndex: 'orderNo', key: 'orderNo' },
            { title: '客户', dataIndex: 'customerName', key: 'customerName' },
            { title: '金额', dataIndex: 'total', key: 'total', align: 'right' as const, render: (v: number) => money(v) },
            { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === '已发货' ? 'success' : 'blue'}>{v}</Tag> },
            { title: '操作', key: 'act', width: 90, render: (_: any, r: any) => <Button type="link" size="small" loading={testing} onClick={() => test(r.orderNo)}>审单</Button> },
          ]} />
        {result && <Alert style={{ marginTop: 12 }} type={result.action === '自动审核' ? 'success' : result.action === '拦截' ? 'error' : 'warning'} showIcon
          message={`${result.orderNo}：${result.action}`}
          description={`${result.reason} | 物流渠道：${result.shippingMethod || '未分配'} | 状态：${result.newStatus}`} />}
      </Card>
      <CrudPage collection="orderRules" title="审单规则" desc="条件→自动审核/拦截" fields={[
        { name: 'name', label: '规则名称', required: true },
        { name: 'conditionType', label: '条件类型', type: 'select', options: [{ label: '金额区间', value: 'amount' }, { label: '关键词', value: 'keyword' }, { label: '地区', value: 'region' }] },
        { name: 'min', label: '最小金额' },
        { name: 'max', label: '最大金额' },
        { name: 'value', label: '关键词/地区值' },
        { name: 'action', label: '执行动作', type: 'select', options: [{ label: '自动审核', value: '自动审核' }, { label: '拦截', value: '拦截' }, { label: '手动处理', value: '手动处理' }] },
        { name: 'shippingMethod', label: '指定物流渠道（选填）' },
        { name: 'priority', label: '优先级', type: 'number' },
        { name: 'enabled', label: '状态', type: 'select', options: [{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }] },
      ]} columns={[
        { title: '规则名', dataIndex: 'name', key: 'name' },
        { title: '条件', key: 'cond', render: (_: any, r: any) => {
          const c = r.condition || {}
          return c.type === 'amount' ? `金额 ${c.min || 0}-${c.max || '∞'}` : `${c.type === 'keyword' ? '关键词' : '地区'} ${c.value || ''}`
        } },
        { title: '动作', dataIndex: 'action', key: 'action', render: (v: string) => <Tag color={v === '自动审核' ? 'success' : v === '拦截' ? 'error' : 'default'}>{v}</Tag> },
        { title: '物流', dataIndex: 'shippingMethod', key: 'shippingMethod', render: (v: string) => v || '自动最便宜' },
        { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80, align: 'right' as const },
      ]} />
    </div>
  )
}

// ============ 库存同步规则 ============
function InventorySync() {
  const [rules, setRules] = useState<any[]>([])
  const [result, setResult] = useState<any>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  useEffect(() => { api.list('inventorySyncRules').then((r: any) => setRules(r.data)).catch(() => {}) }, [])

  const apply = async (id: string) => {
    setSyncing(id)
    try { const r: any = await api.inventorySyncApply(id); setResult(r.data); message.success(r.message) }
    catch (e: any) { message.error(e.message) }
    finally { setSyncing(null) }
  }

  return (
    <div>
      <Alert type="info" showIcon message="多店铺库存同步（对标店小秘库存推送规则）" description="同一个 SKU 在多店铺售卖时，按规则把总库存分配到各店铺，避免超卖。支持按比例或固定数量分配。" style={{ marginBottom: 16 }} />
      <CrudPage collection="inventorySyncRules" title="同步规则" desc="总库存→多店铺分配" fields={[
        { name: 'name', label: '规则名称', required: true },
        { name: 'sku', label: 'SKU', required: true },
        { name: 'mode', label: '分配方式', type: 'select', options: [{ label: '按比例', value: '按比例' }, { label: '固定数量', value: '固定数量' }] },
        { name: 'shops', label: '店铺分配（JSON数组，字段 name/ratio/fixed）', span: 2, placeholder: '[{"name":"Shopee店","ratio":60},{"name":"TikTok店","ratio":40}]' },
      ]} columns={[
        { title: '规则名', dataIndex: 'name', key: 'name' },
        { title: 'SKU', dataIndex: 'sku', key: 'sku' },
        { title: '方式', dataIndex: 'mode', key: 'mode', width: 100, render: (v: string) => <Tag color="blue">{v}</Tag> },
        { title: '店铺数', dataIndex: 'shops', key: 'shops', width: 90, render: (v: any[]) => (v || []).length },
        { title: '上次同步', dataIndex: 'lastSync', key: 'lastSync', width: 110 },
        { title: '操作', key: 'act', width: 90, render: (_: any, r: any) => <Button type="link" size="small" icon={<SyncOutlined />} loading={syncing === r.id} onClick={() => apply(r.id)}>同步</Button> },
      ]} extraActions={(r: any, reload: () => void) => <Button type="link" size="small" onClick={() => apply(r.id)}>同步</Button>} />
      {result && <Card className="chart-card" title={`同步结果 · ${result.sku}`} styles={{ body: { padding: 16 } }} style={{ marginTop: 16 }}>
        <Alert type="success" showIcon message={`总库存 ${result.totalStock}，已分配 ${result.allocated}，预留 ${result.reserved}`} style={{ marginBottom: 16 }} />
        <Table size="small" pagination={false} rowKey="shop" dataSource={result.allocations} columns={[
          { title: '店铺', dataIndex: 'shop', key: 'shop' },
          { title: '分配数量', dataIndex: 'qty', key: 'qty', align: 'right' as const },
          { title: '比例', dataIndex: 'ratio', key: 'ratio', align: 'right' as const, render: (v: number) => v ? `${v}%` : '-' },
        ]} />
      </Card>}
    </div>
  )
}

export default function ReviewSync() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">自动审单 · 库存同步</h1>
        <p className="page-desc">智能规则自动审单配物流，多店铺库存按比例同步防超卖</p>
      </div>
      <Tabs items={[
        { key: 'review', label: '自动审单', children: <AutoReview /> },
        { key: 'sync', label: '库存同步', children: <InventorySync /> },
      ]} />
    </div>
  )
}
