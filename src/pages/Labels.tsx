import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, Input, Modal, Select, message, Popconfirm } from 'antd'
import { SearchOutlined, ReloadOutlined, PrinterOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { api } from '../api'
import { Barcode, QrCode } from '../components/Barcodes'
import CrudPage, { Field } from './CrudPage'

// ============ 打印模板（从 printTemplates 读，有则用之） ============
type Template = { companyName?: string; logoText?: string; showPrice?: string; showBarcode?: string; showQr?: string; footer?: string }
const defaultTemplate: Template = { companyName: '周桂祥的ERP', logoText: 'ZGX', showPrice: '是', showBarcode: '是', showQr: '否', footer: '感谢您的支持' }

// ============ 箱唛标签（外箱标签 100x100 / 100x150） ============
export function CartonLabel({ row, tpl }: { row: any; tpl: Template }) {
  return (
    <div className="print-label carton-label">
      <div className="label-head">
        <div className="label-logo">{tpl.logoText || 'ZGX'}</div>
        <div className="label-company">{tpl.companyName || '周桂祥的ERP'}</div>
      </div>
      <div className="label-title">箱 唛 / CARTON LABEL</div>
      <div className="label-row"><span>箱号</span><b className="label-big">{row.cartonNo}</b></div>
      <div className="label-row"><span>订单号</span><b>{row.orderNo || '-'}</b></div>
      <div className="label-row"><span>SKU</span><b>{row.sku || '-'}</b></div>
      <div className="label-row"><span>品名</span><b>{row.productName || '-'}</b></div>
      <div className="label-row"><span>数量</span><b className="label-big">{row.qty}</b></div>
      {(row.grossWeight || row.netWeight) ? <div className="label-row"><span>重量</span><b>毛{row.grossWeight || 0} / 净{row.netWeight || 0} kg</b></div> : null}
      {row.destination ? <div className="label-row"><span>目的地</span><b>{row.destination}</b></div> : null}
      {row.trackingNo ? <div className="label-row"><span>运单号</span><b>{row.trackingNo}</b></div> : null}
      {tpl.showBarcode !== '否' && <div className="label-barcode"><Barcode value={row.cartonNo || row.sku || 'CARTON'} height={45} /></div>}
      {tpl.showQr === '是' && <div className="label-qr"><QrCode value={JSON.stringify({ c: row.cartonNo, o: row.orderNo, s: row.sku, q: row.qty })} size={80} /></div>}
      {tpl.footer && <div className="label-footer">{tpl.footer}</div>}
    </div>
  )
}

// ============ 快递面单（100x150 常见面单） ============
export function WaybillLabel({ row, tpl }: { row: any; tpl: Template }) {
  return (
    <div className="print-label waybill-label">
      <div className="label-head">
        <div className="label-logo">{tpl.logoText || 'ZGX'}</div>
        <div className="label-company">{tpl.companyName || '周桂祥的ERP'}</div>
        <div className="label-carrier">{row.carrier || '快递'}</div>
      </div>
      <div className="waybill-no">{row.waybillNo || '（待填运单号）'}</div>
      <div className="label-barcode"><Barcode value={row.waybillNo || 'WAYBILL'} height={40} /></div>
      <div className="waybill-parties">
        <div className="party">
          <div className="party-title">寄件人</div>
          <div className="party-name">{row.senderName || '-'} {row.senderPhone || ''}</div>
          <div className="party-addr">{row.senderAddress || '-'}</div>
        </div>
        <div className="party">
          <div className="party-title">收件人</div>
          <div className="party-name party-big">{row.receiverName || '-'} {row.receiverPhone || ''}</div>
          <div className="party-addr party-big">{row.receiverAddress || '-'}</div>
        </div>
      </div>
      <div className="waybill-items">
        <div className="items-title">商品信息</div>
        <div>{row.itemSummary || '-'}</div>
        <div className="items-meta">总件数：{row.totalQty || 0}　重量：{row.weight || 0}kg　{tpl.showPrice !== '否' ? `货款：¥${row.cod || 0}` : ''}</div>
      </div>
      {row.orderNo && <div className="waybill-order">关联订单：{row.orderNo}</div>}
      {tpl.showQr === '是' && <div className="label-qr"><QrCode value={row.waybillNo || row.orderNo || 'WAYBILL'} size={70} /></div>}
      {tpl.footer && <div className="label-footer">{tpl.footer}</div>}
    </div>
  )
}

// ============ 箱唛管理 ============
function Cartons() {
  const [rows, setRows] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [tpl, setTpl] = useState<Template>(defaultTemplate)
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [printOpen, setPrintOpen] = useState(false)
  const [selected, setSelected] = useState<any[]>([])

  const load = () => {
    setLoading(true)
    Promise.all([api.list('cartons'), api.list('salesOrders'), api.list('printTemplates')])
      .then(([a, b, c]) => {
        setRows(a.data)
        setOrders(b.data)
        setTpl(c.data?.[0] || defaultTemplate)
      })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const generate = async (orderId: string) => {
    try { const r: any = await api.genCartons(orderId); message.success(r.message); load() }
    catch (e: any) { message.error(e.message) }
  }

  const filtered = keyword.trim()
    ? rows.filter((r) => [r.cartonNo, r.orderNo, r.sku, r.productName].some((v) => String(v || '').toLowerCase().includes(keyword.toLowerCase())))
    : rows

  const cols = [
    { title: '箱号', dataIndex: 'cartonNo', key: 'cartonNo', width: 170 },
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 130 },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 110 },
    { title: '品名', dataIndex: 'productName', key: 'productName' },
    { title: '数量', dataIndex: 'qty', key: 'qty', width: 70, align: 'right' as const },
    { title: '目的地', dataIndex: 'destination', key: 'destination' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: string) => <Tag color={v === '已打印' ? 'success' : 'orange'}>{v}</Tag> },
    {
      title: '操作', key: 'action', width: 150,
      render: (_: any, r: any) => (
        <Space size={2}>
          <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => { setSelected([r]); setPrintOpen(true) }}>打印</Button>
          <Popconfirm title="删除？" onConfirm={async () => { await api.remove('cartons', r.id); load() }} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input prefix={<SearchOutlined />} placeholder="搜索箱号/订单/SKU" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
        <Space>
          <Select style={{ width: 220 }} placeholder="选择订单生成箱唛" optionFilterProp="label" allowClear
            onChange={(v) => v && generate(v)}
            options={orders.map((o) => ({ label: `${o.orderNo} — ${o.customerName || ''}`, value: o.id }))} />
          <Button disabled={!filtered.length} icon={<PrinterOutlined />} onClick={() => { setSelected(filtered); setPrintOpen(true) }}>打印全部</Button>
        </Space>
      </div>
      <Table columns={cols} dataSource={filtered} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />
      <Modal open={printOpen} onCancel={() => setPrintOpen(false)} footer={null} width={900} title={`打印预览（${selected.length} 张箱唛）`}>
        <div className="print-toolbar">
          <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>打印</Button>
          <span style={{ marginLeft: 12, color: '#888' }}>打印时请在浏览器对话框中选择对应标签纸尺寸，缩放设为 100%</span>
        </div>
        <div className="print-area">
          {selected.map((r) => <CartonLabel key={r.id} row={r} tpl={tpl} />)}
        </div>
      </Modal>
    </div>
  )
}

// ============ 面单管理 ============
function Waybills() {
  const [rows, setRows] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [tpl, setTpl] = useState<Template>(defaultTemplate)
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [printOpen, setPrintOpen] = useState(false)
  const [selected, setSelected] = useState<any[]>([])

  const load = () => {
    setLoading(true)
    Promise.all([api.list('waybills'), api.list('salesOrders'), api.list('printTemplates')])
      .then(([a, b, c]) => { setRows(a.data); setOrders(b.data); setTpl(c.data?.[0] || defaultTemplate) })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const generate = async (orderId: string) => {
    try { const r: any = await api.genWaybill(orderId); message.success(r.message); load() }
    catch (e: any) { message.error(e.message) }
  }

  const filtered = keyword.trim()
    ? rows.filter((r) => [r.waybillNo, r.orderNo, r.receiverName, r.carrier].some((v) => String(v || '').toLowerCase().includes(keyword.toLowerCase())))
    : rows

  const cols = [
    { title: '运单号', dataIndex: 'waybillNo', key: 'waybillNo', width: 140 },
    { title: '物流', dataIndex: 'carrier', key: 'carrier', width: 100 },
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 120 },
    { title: '收件人', dataIndex: 'receiverName', key: 'receiverName', width: 120 },
    { title: '收件地址', dataIndex: 'receiverAddress', key: 'receiverAddress', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: string) => <Tag color={v === '已打印' ? 'success' : 'orange'}>{v}</Tag> },
    {
      title: '操作', key: 'action', width: 150,
      render: (_: any, r: any) => (
        <Space size={2}>
          <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => { setSelected([r]); setPrintOpen(true) }}>打印</Button>
          <Popconfirm title="删除？" onConfirm={async () => { await api.remove('waybills', r.id); load() }} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input prefix={<SearchOutlined />} placeholder="搜索运单/订单/收件人" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
        <Space>
          <Select style={{ width: 220 }} placeholder="选择订单生成面单" optionFilterProp="label" allowClear
            onChange={(v) => v && generate(v)}
            options={orders.map((o) => ({ label: `${o.orderNo} — ${o.customerName || ''}`, value: o.id }))} />
          <Button disabled={!filtered.length} icon={<PrinterOutlined />} onClick={() => { setSelected(filtered); setPrintOpen(true) }}>打印全部</Button>
        </Space>
      </div>
      <Table columns={cols} dataSource={filtered} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />
      <Modal open={printOpen} onCancel={() => setPrintOpen(false)} footer={null} width={900} title={`打印预览（${selected.length} 张面单）`}>
        <div className="print-toolbar">
          <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>打印</Button>
          <span style={{ marginLeft: 12, color: '#888' }}>打印时请在浏览器对话框中选择对应标签纸尺寸，缩放设为 100%</span>
        </div>
        <div className="print-area">
          {selected.map((r) => <WaybillLabel key={r.id} row={r} tpl={tpl} />)}
        </div>
      </Modal>
    </div>
  )
}

// ============ 打印模板设置 ============
const templateFields: Field[] = [
  { name: 'name', label: '模板名称', required: true },
  { name: 'companyName', label: '公司名称' },
  { name: 'logoText', label: 'Logo 文字' },
  { name: 'showBarcode', label: '显示条码', type: 'select', options: [{ label: '是', value: '是' }, { label: '否', value: '否' }] },
  { name: 'showQr', label: '显示二维码', type: 'select', options: [{ label: '是', value: '是' }, { label: '否', value: '否' }] },
  { name: 'showPrice', label: '显示货款', type: 'select', options: [{ label: '是', value: '是' }, { label: '否', value: '否' }] },
  { name: 'footer', label: '底部文字', span: 2 },
]
const templateCols = [
  { title: '模板名称', dataIndex: 'name', key: 'name' },
  { title: '公司名称', dataIndex: 'companyName', key: 'companyName' },
  { title: 'Logo', dataIndex: 'logoText', key: 'logoText' },
  { title: '条码', dataIndex: 'showBarcode', key: 'showBarcode' },
  { title: '二维码', dataIndex: 'showQr', key: 'showQr' },
  { title: '货款', dataIndex: 'showPrice', key: 'showPrice' },
]

export default function Labels() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">箱唛 · 面单 · 标签打印</h1>
        <p className="page-desc">从订单一键生成箱唛和快递面单，条码/二维码齐备，直接连接标签打印机打印</p>
      </div>
      <Tabs items={[
        { key: 'carton', label: '箱唛管理', children: <Cartons /> },
        { key: 'waybill', label: '快递面单', children: <Waybills /> },
        { key: 'template', label: '打印模板', children: <CrudPage collection="printTemplates" title="打印模板" desc="设置标签上的公司信息、条码/二维码显示" fields={templateFields} columns={templateCols} /> },
      ]} />
    </div>
  )
}
