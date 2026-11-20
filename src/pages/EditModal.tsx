import React, { useEffect } from 'react'
import { Modal, Form, Input, InputNumber, Select, message } from 'antd'
import type { Field } from './CrudPage'

type Props = {
  open: boolean
  title: string
  fields: Field[]
  initialValues: any
  onCancel: () => void
  onSaved: () => void
  save: (values: any) => Promise<any>
}

export default function EditModal({ open, title, fields, initialValues, onCancel, onSaved, save }: Props) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (open) {
      form.resetFields()
      if (initialValues) form.setFieldsValue(initialValues)
    }
  }, [open, initialValues, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      await save(values)
      message.success('保存成功')
      onSaved()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error('保存失败')
    }
  }

  return (
    <Modal open={open} title={title} onOk={handleOk} onCancel={onCancel} okText="保存" cancelText="取消" destroyOnClose width={640}>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          {fields.map((f) => (
            <Form.Item
              key={f.name}
              name={f.name}
              label={f.label}
              rules={f.required ? [{ required: true, message: `请输入${f.label}` }] : []}
              style={{ gridColumn: f.span === 2 ? '1 / -1' : 'auto' }}
            >
              {f.type === 'number' ? (
                <InputNumber style={{ width: '100%' }} min={0} precision={f.name.toLowerCase().includes('price') ? 2 : 0} />
              ) : f.type === 'select' ? (
                <Select options={f.options} placeholder={`请选择${f.label}`} />
              ) : (
                <Input placeholder={f.placeholder || `请输入${f.label}`} />
              )}
            </Form.Item>
          ))}
        </div>
      </Form>
    </Modal>
  )
}
