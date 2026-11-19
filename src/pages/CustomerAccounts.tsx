import React, { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Input, Modal, Form, Select, message, Popconfirm, Empty } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons'
import { api } from '../api'

export default function CustomerAccounts() {
  const [rows, setRows] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [modal, setModal] = useState<{ record?: any } | null>(null)
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    Promise.all([api.listCustomerAccounts(), api.list('customers')])
      .then(([a, c]) => { setRows(a.data); setCustomers(c.data) })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = keyword.trim()
    ? rows.filter((r) => [r.username, r.name, r.customer?.name, r.customer?.code].some((v) => String(v || '').toLowerCase().includes(keyword.toLowerCase())))
    : rows

  const boundIds = new Set(rows.filter((r) => r.id !== modal?.record?.id).map((r) => r.customerId).filter(Boolean))

  const openModal = (record?: any) => {
    setModal(record ? { record } : {})
    form.resetFields()
    if (record) form.setFieldsValue({ customerId: record.customerId, status: record.status })
  }

  const submit = async () => {
    const values = await form.validateFields()
    try {
      if (modal?.record) {
        await api.updateUser(modal.record.id, { role: 'customer', customerId: values.customerId, status: values.status })
        message.success('绑定已更新')
      } else {
        const cust = customers.find((c) => c.id === values.customerId)
        await api.createUser({
          username: values.username, password: values.password, name: cust?.name || values.username,
          role: 'customer', customerId: values.customerId, status: values.status || '启用',
        })
        message.success('客户账号创建成功')
      }
      setModal(null); load()
    } catch (e: any) { message.error(e.message || '操作失败') }
  }

  const remove = async (id: string) => {
    try { await api.removeUser(id); message.success('已删除'); load() }
    catch (e: any) { message.error(e.message) }
  }

  const columns = [
    { title: '登录账号', dataIndex: 'username', key: 'username', width: 140 },
    { title: '客户名称', key: 'cname', width: 160, render: (_: any, r: any) => r.customer ? <Space><TeamOutlined />{r.customer.name}</Space> : <Tag color="error">未绑定</Tag> },
    { title: '客户编号', key: 'ccode', render: (_: any, r: any) => r.customer?.code || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag> },
    {
      title: '操作', key: 'action', width: 150,
      render: (_: any, r: any) => (
        <Space size={2}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(r)}>绑定/编辑</Button>
          <Popconfirm title="确认删除此客户账号？" onConfirm={() => remove(r.id)} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">客户账号管理</h1>
        <p className="page-desc">为客户创建登录账号并绑定客户档案，客户登录后只能查看自己的订单数据</p>
      </div>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input prefix={<SearchOutlined />} placeholder="搜索账号/客户" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>新建客户账号</Button>
      </div>
      {filtered.length === 0 && !loading
        ? <div style={{ padding: 60 }}><Empty description="暂无客户账号，点右上角新建" /></div>
        : <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />}

      <Modal open={!!modal} title={modal?.record ? '编辑客户账号绑定' : '新建客户账号'} onOk={submit} onCancel={() => setModal(null)} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {!modal?.record && (
            <>
              <Form.Item name="username" label="登录账号" rules={[{ required: true, message: '请输入账号' }]}><Input placeholder="如：cus_xinghai" /></Form.Item>
              <Form.Item name="password" label="登录密码" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少 6 位' }]}><Input.Password placeholder="至少 6 位" /></Form.Item>
            </>
          )}
          <Form.Item name="customerId" label="绑定客户" rules={[{ required: true, message: '请选择客户' }]}>
            <Select showSearch optionFilterProp="label" placeholder="选择要绑定的客户"
              options={customers.filter((c) => !boundIds.has(c.id)).map((c) => ({ label: `${c.code} ${c.name}`, value: c.id }))} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="启用"><Select options={[{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }]} /></Form.Item>
          <div style={{ color: '#888', fontSize: 12 }}>客户登录后只能查看该客户的销售订单、客户资料与经营概览，无法访问商品成本、采购、财务等敏感模块。</div>
        </Form>
      </Modal>
    </div>
  )
}
