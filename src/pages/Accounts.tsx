import React, { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Input, Modal, Form, Select, Popconfirm, message, InputNumber } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../api'
import { useAuth } from '../auth'

export default function Accounts() {
  const { user: me } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'password'; record?: any } | null>(null)
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    api.listUsers().then((r) => setRows(r.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = keyword.trim()
    ? rows.filter((r) => [r.username, r.name, r.role].some((v) => String(v || '').toLowerCase().includes(keyword.toLowerCase())))
    : rows

  const openModal = (mode: 'create' | 'edit' | 'password', record?: any) => {
    setModal({ mode, record })
    form.resetFields()
    if (mode === 'edit' && record) form.setFieldsValue({ name: record.name, role: record.role, status: record.status })
    if (mode === 'password' && record) form.setFieldsValue({})
  }

  const submit = async () => {
    const values = await form.validateFields()
    try {
      if (modal!.mode === 'create') {
        await api.createUser(values)
        message.success('账号创建成功')
      } else if (modal!.mode === 'edit') {
        await api.updateUser(modal!.record.id, values)
        message.success('更新成功')
      } else {
        if (!values.password || values.password.length < 6) { message.warning('密码至少 6 位'); return }
        await api.updateUser(modal!.record.id, { password: values.password })
        message.success('密码已重置')
      }
      setModal(null); load()
    } catch (e: any) { message.error(e.message || '操作失败') }
  }

  const remove = async (id: string) => {
    try { await api.removeUser(id); message.success('删除成功'); load() }
    catch (e: any) { message.error(e.message) }
  }

  const columns = [
    { title: '账号', dataIndex: 'username', key: 'username', width: 150 },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    {
      title: '角色', dataIndex: 'role', key: 'role', width: 110,
      render: (v: string) => <Tag color={v === 'admin' ? 'purple' : 'blue'}>{v === 'admin' ? '管理员' : '客户账号'}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag>,
    },
    { title: '创建日期', dataIndex: 'createdAt', key: 'createdAt', width: 120 },
    {
      title: '操作', key: 'action', width: 240,
      render: (_: any, r: any) => (
        <Space size={2}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal('edit', r)}>编辑</Button>
          <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => openModal('password', r)}>重置密码</Button>
          {r.id !== me?.id && (
            <Popconfirm title="确认删除此账号？" onConfirm={() => remove(r.id)} okText="删除" cancelText="取消">
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const modalTitles = { create: '新增账号', edit: '编辑账号', password: '重置密码' }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">账号管理</h1>
        <p className="page-desc">管理系统登录账号、角色与权限</p>
      </div>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input prefix={<SearchOutlined />} placeholder="搜索账号/姓名" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('create')}>新增账号</Button>
      </div>
      <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />

      <Modal open={!!modal} title={modal ? modalTitles[modal.mode] : ''} onOk={submit} onCancel={() => setModal(null)} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {modal?.mode === 'create' && (
            <>
              <Form.Item name="username" label="登录账号" rules={[{ required: true, message: '请输入账号' }]}><Input placeholder="英文/数字，唯一" /></Form.Item>
              <Form.Item name="password" label="初始密码" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少 6 位' }]}><Input.Password placeholder="至少 6 位" /></Form.Item>
              <Form.Item name="name" label="姓名/备注"><Input placeholder="如：张三" /></Form.Item>
              <Form.Item name="role" label="角色" initialValue="admin">
                <Select options={[{ label: '管理员（全部权限）', value: 'admin' }, { label: '客户账号（只读 + 绑定客户）', value: 'customer' }]} />
              </Form.Item>
              <Form.Item name="status" label="状态" initialValue="启用"><Select options={[{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }]} /></Form.Item>
              <div style={{ color: '#888', fontSize: 12 }}>提示：客户账号需在「客户账号管理」里绑定具体客户，登录后只能查看该客户的订单。</div>
            </>
          )}
          {modal?.mode === 'edit' && (
            <>
              <Form.Item name="name" label="姓名/备注"><Input /></Form.Item>
              <Form.Item name="role" label="角色"><Select options={[{ label: '管理员', value: 'admin' }, { label: '客户账号', value: 'customer' }]} /></Form.Item>
              <Form.Item name="status" label="状态"><Select options={[{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }]} /></Form.Item>
            </>
          )}
          {modal?.mode === 'password' && (
            <Form.Item name="password" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '至少 6 位' }]}>
              <Input.Password placeholder="至少 6 位" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
