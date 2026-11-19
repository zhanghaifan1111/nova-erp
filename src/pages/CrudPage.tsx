import React, { useEffect, useState } from 'react'
import { Button, Input, Table, Space, Popconfirm, message, Tag } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../api'
import EditModal from './EditModal'

export type Field = {
  name: string
  label: string
  type?: 'text' | 'number' | 'select'
  options?: { label: string; value: string }[]
  required?: boolean
  span?: number
}

type Props = {
  collection: string
  title: string
  desc: string
  fields: Field[]
  columns: any[]
  extraActions?: (record: any, reload: () => void) => React.ReactNode
}

export default function CrudPage({ collection, title, desc, fields, columns, extraActions }: Props) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const load = () => {
    setLoading(true)
    api.list(collection).then((r) => setRows(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [collection])

  const filtered = keyword.trim()
    ? rows.filter((r) => Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(keyword.toLowerCase())))
    : rows

  const handleDelete = async (id: string) => {
    await api.remove(collection, id)
    message.success('删除成功')
    load()
  }

  const finalColumns = [
    ...columns,
    {
      title: '操作', key: 'action', fixed: 'right' as const, width: extraActions ? 190 : 130,
      render: (_: any, record: any) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(record); setModalOpen(true) }}>编辑</Button>
          {extraActions?.(record, load)}
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-desc">{desc}</p>
      </div>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true) }}>
          新增{title.replace('管理', '')}
        </Button>
      </div>

      <Table
        columns={finalColumns}
        dataSource={filtered}
        rowKey="id"
        loading={loading}
        size="middle"
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
      />

      <EditModal
        open={modalOpen}
        fields={fields}
        initialValues={editing}
        title={`${editing ? '编辑' : '新增'}${title.replace('管理', '')}`}
        onCancel={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); load() }}
        save={(values) => editing ? api.update(collection, editing.id, values) : api.create(collection, values)}
      />
    </div>
  )
}
