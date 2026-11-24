import React, { useEffect, useState } from 'react'
import { Tabs, Table, Tag, Button, Space, message, Alert, Modal, Form, Input, Checkbox, Row, Col, Card, Statistic } from 'antd'
import { SafetyCertificateOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../api'
import CrudPage, { Field } from './CrudPage'

const allMenus = [
  { key: '/', label: '经营总览' },
  { key: '/command-center', label: '经营驾驶舱' },
  { key: '/products', label: '商品管理' },
  { key: '/inventory', label: '库存管理' },
  { key: '/sales', label: '销售订单' },
  { key: '/purchase', label: '采购订单' },
  { key: '/shipments', label: '打单发货' },
  { key: '/labels', label: '箱唛面单' },
  { key: '/stock-flow', label: '入库盘点退货' },
  { key: '/warehouse-fx', label: '拣货汇率' },
  { key: '/warehouse-intel', label: '库位预测' },
  { key: '/customers', label: '客户管理' },
  { key: '/crm', label: '客户跟进' },
  { key: '/after-sales', label: '售后服务' },
  { key: '/messages', label: '客户消息' },
  { key: '/finance', label: '财务报表' },
  { key: '/payments', label: '收付款' },
  { key: '/profit', label: '利润核算' },
  { key: '/gl', label: '会计总账' },
  { key: '/reconciliation', label: '结算对账' },
  { key: '/compliance', label: '发票审计' },
  { key: '/intelligence', label: '智能决策' },
  { key: '/workflow', label: '审批报销' },
  { key: '/performance', label: 'KPI预警' },
  { key: '/automation', label: '自动化规则' },
]

const roleCols = [
  { title: '角色标识', dataIndex: 'key', key: 'key', width: 130, render: (v: string) => <Tag color="blue">{v}</Tag> },
  { title: '角色名称', dataIndex: 'name', key: 'name', width: 130 },
  { title: '说明', dataIndex: 'desc', key: 'desc', ellipsis: true },
  { title: '可访问菜单', dataIndex: 'menus', key: 'menus', width: 100, align: 'right' as const, render: (v: string[]) => (v || []).length + ' 个' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag> },
]

function RoleManage() {
  const [roles, setRoles] = useState<any[]>([])
  const [open, setOpen] = useState<any>(null)
  const [form] = Form.useForm()
  const load = () => api.list('roles').then((r) => setRoles(r.data)).catch((e) => message.error(e.message))
  useEffect(() => { load() }, [])

  const init = async () => {
    try { const r: any = await api.rbacInitRoles(); message.success(r.message); load() } catch (e: any) { message.error(e.message) }
  }
  const edit = (role: any) => { setOpen(role); form.resetFields(); form.setFieldsValue({ name: role.name, desc: role.desc, menus: role.menus || [] }) }
  const save = async () => {
    const v = await form.validateFields()
    try {
      await api.update('roles', open.id, { name: v.name, desc: v.desc, menus: v.menus })
      message.success('权限已保存'); setOpen(null); load()
    } catch (e: any) { message.error(e.message) }
  }

  return (
    <div>
      <Alert type="info" showIcon message="角色权限说明" description="每个角色配置可访问的菜单。给用户分配角色后，登录后只看到有权限的菜单。管理员始终拥有全部权限。" style={{ marginBottom: 16 }} />
      <div className="table-toolbar">
        <div className="table-toolbar-left"><span style={{ color: '#888' }}>系统预设 4 类角色，可自定义菜单范围</span></div>
        <Button icon={<SafetyCertificateOutlined />} onClick={init}>初始化预设角色</Button>
      </div>
      <Table
        columns={[...roleCols, { title: '操作', key: 'action', width: 90, render: (_: any, r: any) => <Button type="link" size="small" onClick={() => edit(r)}>配置权限</Button> }]}
        dataSource={roles} rowKey="id" size="middle" pagination={false}
        expandable={{ expandedRowRender: (r: any) => <div style={{ paddingLeft: 40 }}>{(r.menus || []).map((m: string) => <Tag key={m}>{allMenus.find((x) => x.key === m)?.label || m}</Tag>)}</div> }}
      />
      <Modal open={!!open} title={`配置权限 · ${open?.name || ''}`} onOk={save} onCancel={() => setOpen(null)} okText="保存" cancelText="取消" width={640}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="角色名称"><Input /></Form.Item>
          <Form.Item name="desc" label="说明"><Input /></Form.Item>
          <Form.Item name="menus" label="可访问菜单">
            <Checkbox.Group options={allMenus.map((m) => ({ label: m.label, value: m.key }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// 账号绑定角色（列表显示 roleKey）
const userFields: Field[] = [
  { name: 'username', label: '账号', required: true },
  { name: 'password', label: '密码', required: true },
  { name: 'name', label: '姓名' },
  { name: 'role', label: '账号类型', type: 'select', options: [{ label: '管理员', value: 'admin' }, { label: '客户', value: 'customer' }] },
  { name: 'roleKey', label: '角色标识', placeholder: '如 operator / warehouse / finance / service / admin' },
  { name: 'customerId', label: '关联客户ID（客户账号用）' },
  { name: 'status', label: '状态', type: 'select', options: [{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }] },
]
const userCols = [
  { title: '账号', dataIndex: 'username', key: 'username' },
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '类型', dataIndex: 'role', key: 'role', render: (v: string) => <Tag color={v === 'admin' ? 'blue' : 'default'}>{v === 'admin' ? '管理员' : '客户'}</Tag> },
  { title: '角色', dataIndex: 'roleKey', key: 'roleKey', render: (v: string) => v ? <Tag color="purple">{v}</Tag> : '-' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag> },
]

export default function Rbac() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">RBAC 角色权限</h1>
        <p className="page-desc">按角色配置菜单权限，不同岗位各看各的</p>
      </div>
      <Tabs items={[
        { key: 'roles', label: '角色管理', children: <RoleManage /> },
        { key: 'users', label: '账号角色绑定', children: <CrudPage collection="users" title="账号管理" desc="在「角色标识」填角色 key 绑定权限" fields={userFields} columns={userCols} /> },
      ]} />
    </div>
  )
}
