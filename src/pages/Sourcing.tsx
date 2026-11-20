import React, { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Input, Modal, Form, Select, message, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, ReloadOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons'
import { api } from '../api'

// 采集箱：真实链接录入（不编造商品数据），可批量粘贴商品链接
export default function Sourcing() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [collectOpen, setCollectOpen] = useState(false)
  const [form] = Form.useForm()
  const [shops, setShops] = useState<any[]>([])

  useEffect(() => { api.list('shops').then((r) => setShops(r.data)).catch(() => {}) }, [])

  const publish = (record: any) => {
    if (!shops.length) { message.warning('请先在「店铺管理」添加店铺'); return }
    Modal.confirm({
      title: '刊登到店铺',
      content: `将「${record.title}」刊登到哪个店铺？`,
      okText: '确认刊登', cancelText: '取消',
      onOk: async () => {
        try {
          const r: any = await api.publish({ sourcedProductId: record.id, shopId: shops[0].id, title: record.title, price: record.sourcePrice, sku: '' })
          message.success(r.message || '刊登成功'); load()
        } catch (e: any) { message.error(e.message) }
      },
    })
  }

  const load = () => {
    setLoading(true)
    api.list('sourcedProducts').then((r) => setRows(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = keyword.trim()
    ? rows.filter((r) => [r.title, r.platform, r.sourceUrl].some((v) => String(v || '').toLowerCase().includes(keyword.toLowerCase())))
    : rows

  const collect = async () => {
    const v = await form.validateFields()
    const lines = String(v.links || '').split('\n').map((s) => s.trim()).filter(Boolean).map((line) => {
      const [url, title, price] = line.split('|').map((s) => s.trim())
      return { url, title, price: price ? Number(price) : 0 }
    }).filter((x) => x.url)
    if (!lines.length) { message.warning('请至少粘贴一个商品链接'); return }
    try {
      const r: any = await api.collect({ platform: v.platform, lines })
      message.success(r.message || '采集完成')
      setCollectOpen(false); form.resetFields(); load()
    } catch (e: any) { message.error(e.message) }
  }

  const remove = async (id: string) => {
    try { await api.remove('sourcedProducts', id); message.success('已删除'); load() }
    catch (e: any) { message.error(e.message) }
  }

  const columns = [
    { title: '采集标题', dataIndex: 'title', key: 'title', width: 220, ellipsis: true },
    { title: '来源平台', dataIndex: 'platform', key: 'platform', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '来源价格', dataIndex: 'sourcePrice', key: 'sourcePrice', align: 'right' as const, render: (v: number) => v ? `¥${v}` : '-' },
    {
      title: '链接', dataIndex: 'sourceUrl', key: 'sourceUrl', ellipsis: true,
      render: (v: string) => v ? <a href={v} target="_blank" rel="noreferrer" title={v}>打开来源</a> : '-',
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => <Tag color={v === '已刊登' ? 'success' : v === '已忽略' ? 'default' : 'orange'}>{v}</Tag>,
    },
    { title: '采集日期', dataIndex: 'collectedAt', key: 'collectedAt' },
    {
      title: '操作', key: 'action', width: 130,
      render: (_: any, r: any) => (
        <Space size={2}>
          {r.status !== '已刊登' && <Button type="link" size="small" icon={<SendOutlined />} onClick={() => publish(r)}>刊登</Button>}
          <Popconfirm title="确认删除？" onConfirm={() => remove(r.id)} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">商品采集箱</h1>
        <p className="page-desc">粘贴真实商品链接批量采集到采集箱，公告牌式管理待刊登商品（不自动生成虚构商品）</p>
      </div>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input prefix={<SearchOutlined />} placeholder="搜索标题/平台" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCollectOpen(true)}>批量采集</Button>
      </div>
      <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />

      <Modal open={collectOpen} title="批量采集商品" onOk={collect} onCancel={() => setCollectOpen(false)} okText="开始采集" cancelText="取消" width={560}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} initialValues={{ platform: 'Shopee' }}>
          <Form.Item name="platform" label="来源平台">
            <Select options={['Shopee', 'Lazada', 'Amazon', 'TikTok Shop', 'Temu', 'AliExpress', '其他'].map((v) => ({ label: v, value: v }))} />
          </Form.Item>
          <Form.Item name="links" label="商品链接（每行一个）" rules={[{ required: true, message: '请粘贴商品链接' }]} extra="可只填链接；如需指定标题或价格，一行写成：链接 | 标题 | 价格">
            <Input.TextArea rows={8} placeholder={'https://shopee.xxx/product/1\nhttps://lazada.xxx/product/2 | 自定义标题 | 99'} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
