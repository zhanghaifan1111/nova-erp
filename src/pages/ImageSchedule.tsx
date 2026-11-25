import React, { useEffect, useRef, useState } from 'react'
import { Tabs, Card, Row, Col, Button, message, Alert, Upload, Space, Slider, Input, Radio, Tag, Table, Statistic, Modal, Form, Select, DatePicker, InputNumber } from 'antd'
import { PictureOutlined, DownloadOutlined, UploadOutlined, ClockCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api } from '../api'
import CrudPage, { Field } from './CrudPage'

// ============ 在线美图（真实 Canvas 处理） ============
function ImageStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [scale, setScale] = useState(100)
  const [watermark, setWatermark] = useState('')
  const [ruler, setRuler] = useState(false)
  const [mosaic, setMosaic] = useState(false)

  const loadFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => { setImg(image); setFileName(file.name); draw(image) }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
    return false
  }

  const draw = (image: HTMLImageElement, opts?: any) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const o = opts || { scale, watermark, ruler, mosaic }
    const w = Math.max(100, Math.round(image.width * o.scale / 100))
    const h = Math.max(100, Math.round(image.height * o.scale / 100))
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(image, 0, 0, w, h)

    // 马赛克：对中央区域像素化
    if (o.mosaic) {
      const mw = Math.floor(w * 0.4), mh = Math.floor(h * 0.3)
      const x = Math.floor((w - mw) / 2), y = Math.floor((h - mh) / 2)
      const tmp = document.createElement('canvas'); tmp.width = mw / 8; tmp.height = mh / 8
      const tctx = tmp.getContext('2d')
      if (tctx) { tctx.drawImage(canvas, x, y, mw, mh, 0, 0, tmp.width, tmp.height); ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, x, y, mw, mh) }
    }
    // 标尺：底部刻度线
    if (o.ruler) {
      ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#000000'; ctx.lineWidth = 2
      const ry = h - 30
      ctx.fillRect(0, ry, w, 30)
      ctx.strokeStyle = '#000000'
      for (let i = 0; i <= w; i += 50) { ctx.beginPath(); ctx.moveTo(i, ry); ctx.lineTo(i, ry + 10); ctx.stroke(); ctx.font = '12px sans-serif'; ctx.fillText(String(i), i + 2, ry + 24) }
    }
    // 水印
    if (o.watermark) {
      ctx.font = `bold ${Math.max(16, Math.floor(w / 15))}px sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2
      const tw = ctx.measureText(o.watermark).width
      const wx = w - tw - 20, wy = h - (o.ruler ? 50 : 20)
      ctx.strokeText(o.watermark, wx, wy); ctx.fillText(o.watermark, wx, wy)
    }
  }

  const apply = () => { if (img) draw(img) }
  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `processed-${fileName || 'image'}.png`; a.click()
    message.success('图片已下载')
  }

  return (
    <div>
      <Alert type="info" showIcon message="在线美图（对标店小秘小秘美图）" description="真实浏览器 Canvas 处理：缩放尺寸、加标尺、打水印、局部马赛克，处理后直接下载 PNG。所有处理在本地完成，图片不上传。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="chart-card" title={<span><PictureOutlined /> 图片处理</span>} styles={{ body: { padding: 20 } }}>
            <Upload accept="image/*" beforeUpload={loadFile} showUploadList={false}>
              <Button block icon={<UploadOutlined />} size="large">选择图片</Button>
            </Upload>
            {fileName && <div style={{ marginTop: 12, color: '#888', fontSize: 12 }}>已载入：{fileName}</div>}
            <div style={{ marginTop: 20 }}>
              <div style={{ marginBottom: 6 }}>缩放：<Tag color="blue">{scale}%</Tag></div>
              <Slider min={20} max={200} value={scale} onChange={setScale} onChangeComplete={apply} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 6 }}>水印文字</div>
              <Input value={watermark} onChange={(e) => setWatermark(e.target.value)} placeholder="如：© MyStore" onBlur={apply} />
            </div>
            <div style={{ marginTop: 16 }}>
              <Button block type={ruler ? 'primary' : 'default'} onClick={() => { setRuler(!ruler); if (img) draw(img, { scale, watermark, ruler: !ruler, mosaic }) }}>{ruler ? '✓ ' : ''}底部标尺</Button>
              <Button block style={{ marginTop: 8 }} type={mosaic ? 'primary' : 'default'} onClick={() => { setMosaic(!mosaic); if (img) draw(img, { scale, watermark, ruler, mosaic: !mosaic }) }}>{mosaic ? '✓ ' : ''}中央马赛克</Button>
            </div>
            <Button block type="primary" icon={<DownloadOutlined />} style={{ marginTop: 20 }} disabled={!img} onClick={download}>下载处理后图片</Button>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card className="chart-card" title="预览" styles={{ body: { padding: 20, textAlign: 'center', minHeight: 400 } }}>
            <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: 460, border: '1px solid rgba(127,127,127,.15)' }} />
            {!img && <div style={{ color: '#888', padding: 80 }}>选择一张图片开始处理</div>}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// ============ 定时上下架 ============
function Schedule() {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const load = () => api.list('scheduledListings').then((r: any) => setTasks(r.data)).catch(() => {})
  useEffect(() => { load() }, [])
  const process = async () => {
    setLoading(true)
    try { const r: any = await api.scheduleProcess(); message.success(r.message); load() }
    catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }
  return (
    <div>
      <Alert type="info" showIcon message="定时刊登/下架（对标店小秘定时上下架）" description="设置商品在未来某个时间自动上架或下架。点「执行到期任务」处理所有到点任务。" style={{ marginBottom: 16 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="任务总数" value={tasks.length} valueStyle={{ color: '#4f6ef7' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="待执行" value={tasks.filter((t) => t.status === '待执行').length} valueStyle={{ color: '#f79009' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="kpi-card" styles={{ body: { padding: 16 } }}><Statistic title="已执行" value={tasks.filter((t) => t.status === '已执行').length} valueStyle={{ color: '#16b364' }} /></Card></Col>
      </Row>
      <div className="table-toolbar"><div className="table-toolbar-left"><span style={{ color: '#888' }}>设置 runAt 为 ISO 时间，如 2026-11-26T09:00:00</span></div><Button type="primary" icon={<PlayCircleOutlined />} loading={loading} onClick={process}>执行到期任务</Button></div>
      <CrudPage collection="scheduledListings" title="定时任务" desc="定时上下架队列" fields={[
        { name: 'name', label: '任务名称', required: true },
        { name: 'targetId', label: '商品/刊登ID' },
        { name: 'targetType', label: '目标类型', type: 'select', options: [{ label: '商品', value: 'product' }, { label: '刊登', value: 'listing' }] },
        { name: 'action', label: '动作', type: 'select', options: [{ label: '上架', value: '上架' }, { label: '下架', value: '下架' }] },
        { name: 'runAt', label: '执行时间（ISO）', required: true, placeholder: '2026-11-26T09:00:00' },
        { name: 'status', label: '状态', type: 'select', options: [{ label: '待执行', value: '待执行' }, { label: '已执行', value: '已执行' }, { label: '已取消', value: '已取消' }] },
      ]} columns={[
        { title: '任务', dataIndex: 'name', key: 'name' },
        { title: '动作', dataIndex: 'action', key: 'action', render: (v: string) => <Tag color={v === '上架' ? 'success' : 'default'}>{v}</Tag> },
        { title: '执行时间', dataIndex: 'runAt', key: 'runAt' },
        { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === '已执行' ? 'success' : v === '已取消' ? 'default' : 'orange'}>{v}</Tag> },
        { title: '执行于', dataIndex: 'executedAt', key: 'executedAt', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
      ]} />
    </div>
  )
}

export default function ImageSchedule() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">在线美图 · 定时刊登</h1>
        <p className="page-desc">浏览器本地图片处理，定时自动上下架任务</p>
      </div>
      <Tabs items={[
        { key: 'image', label: '在线美图', children: <ImageStudio /> },
        { key: 'schedule', label: '定时刊登', children: <Schedule /> },
      ]} />
    </div>
  )
}
