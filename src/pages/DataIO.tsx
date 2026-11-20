import React, { useState } from 'react'
import { Card, Tabs, Button, Select, Input, Upload, message, Table, Tag, Space, Alert, Typography } from 'antd'
import { InboxOutlined, DownloadOutlined, UploadOutlined, FileExcelOutlined } from '@ant-design/icons'
import { api } from '../api'

const { Text, Paragraph } = Typography
const { Dragger } = Upload

// 简易 CSV 解析（支持引号包裹与逗号分隔）
function parseCSV(text: string): any[] {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []
  const split = (line: string) => {
    const out: string[] = []
    let cur = '', quoted = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++ } else quoted = !quoted }
      else if (c === ',' && !quoted) { out.push(cur.trim()); cur = '' }
      else cur += c
    }
    out.push(cur.trim())
    return out
  }
  const headers = split(lines[0])
  return lines.slice(1).map((line) => {
    const vals = split(line)
    const obj: any = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    return obj
  })
}

function toCSV(rows: any[], columns: string[]): string {
  const esc = (v: any) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [columns.join(',')]
  rows.forEach((r) => lines.push(columns.map((c) => esc(r[c])).join(',')))
  return '\uFEFF' + lines.join('\n') // BOM 让 Excel 正确识别中文
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const exportKeys = [
  { value: 'products', label: '商品' },
  { value: 'customers', label: '客户' },
  { value: 'suppliers', label: '供应商' },
  { value: 'salesOrders', label: '销售订单' },
  { value: 'purchaseOrders', label: '采购订单' },
  { value: 'stockLogs', label: '库存流水' },
  { value: 'shops', label: '店铺' },
  { value: 'platformOrders', label: '平台订单' },
  { value: 'cartons', label: '箱唛' },
  { value: 'waybills', label: '面单' },
]

function ImportPanel() {
  const [key, setKey] = useState('products')
  const [rows, setRows] = useState<any[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)

  const beforeUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parseCSV(String(reader.result || ''))
        setRows(parsed)
        setFileName(file.name)
        message.success(`解析到 ${parsed.length} 行，首行表头：${Object.keys(parsed[0] || {}).join('、')}`)
      } catch { message.error('CSV 解析失败') }
    }
    reader.readAsText(file, 'UTF-8')
    return false
  }

  const doImport = async () => {
    if (!rows.length) { message.warning('请先上传 CSV 文件'); return }
    setImporting(true)
    try {
      const r: any = await api.importRows(key, rows)
      message.success(r.message)
      setRows([]); setFileName('')
    } catch (e: any) { message.error(e.message) }
    finally { setImporting(false) }
  }

  const sample = key === 'products'
    ? 'sku,name,category,unit,costPrice,salePrice,stock,safeStock\nSKU-001,示例商品,数码,个,10,20,100,10'
    : 'name,contact,phone,level,status\n示例客户,张三,13800000000,普通,正常'

  return (
    <div style={{ maxWidth: 800 }}>
      <Alert type="info" showIcon message="导入说明" description="上传 UTF-8 编码的 CSV 文件，首行是表头（列名）。商品按 SKU 去重、客户按名称去重，重复数据自动跳过。" style={{ marginBottom: 16 }} />
      <div style={{ marginBottom: 16 }}>
        <Text strong>导入类型：</Text>
        <Select value={key} onChange={(v) => { setKey(v); setRows([]); setFileName('') }} style={{ width: 200, marginLeft: 8 }}
          options={[{ value: 'products', label: '商品' }, { value: 'customers', label: '客户' }]} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary">表头示例：</Text>
        <pre style={{ background: 'rgba(127,127,127,.1)', padding: 8, borderRadius: 6, fontSize: 12, marginTop: 6 }}>{sample}</pre>
      </div>
      <Dragger accept=".csv" beforeUpload={beforeUpload} showUploadList={false}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">点击或拖拽 CSV 文件到此处</p>
        <p className="ant-upload-hint">{fileName ? `已选择：${fileName} · ${rows.length} 行` : '仅支持 .csv 文件'}</p>
      </Dragger>
      {rows.length > 0 && (
        <>
          <Table style={{ marginTop: 16 }} size="small" dataSource={rows.slice(0, 5)} rowKey={(_, i) => String(i)}
            columns={Object.keys(rows[0] || {}).slice(0, 8).map((k) => ({ title: k, dataIndex: k, key: k, ellipsis: true }))}
            pagination={false} scroll={{ x: 'max-content' }} />
          <Button type="primary" icon={<UploadOutlined />} loading={importing} onClick={doImport} style={{ marginTop: 16 }}>
            确认导入 {rows.length} 行
          </Button>
        </>
      )}
    </div>
  )
}

function ExportPanel() {
  const [key, setKey] = useState('products')
  const [loading, setLoading] = useState(false)
  const doExport = async () => {
    setLoading(true)
    try {
      const r: any = await api.exportRows(key)
      if (!r.data?.length) { message.warning('该分类暂无数据'); return }
      const cols = Object.keys(r.data[0]).filter((c) => c !== '_id')
      download(`${key}_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(r.data, cols))
      message.success(`已导出 ${r.data.length} 条`)
    } catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }
  return (
    <div style={{ maxWidth: 600 }}>
      <Alert type="info" showIcon message="导出说明" description="导出为 UTF-8 编码 CSV（带 BOM），Excel 打开中文不乱码。" style={{ marginBottom: 16 }} />
      <Text strong>选择导出分类：</Text>
      <Select value={key} onChange={setKey} style={{ width: 240, margin: '8px 12px 16px 0' }} options={exportKeys} />
      <Button type="primary" icon={<DownloadOutlined />} loading={loading} onClick={doExport}>导出 CSV</Button>
      <Paragraph type="secondary" style={{ marginTop: 24 }}>
        <FileExcelOutlined /> 支持导出全部 10 类业务数据。导出的是当前系统里的真实数据，可用于备份或交给其他系统。
      </Paragraph>
    </div>
  )
}

export default function DataIO() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">数据导入导出</h1>
        <p className="page-desc">CSV 批量导入商品与客户，一键导出全部业务数据，方便迁移与备份</p>
      </div>
      <Card className="chart-card">
        <Tabs items={[
          { key: 'import', label: '导入 CSV', children: <ImportPanel /> },
          { key: 'export', label: '导出 CSV', children: <ExportPanel /> },
        ]} />
      </Card>
    </div>
  )
}
