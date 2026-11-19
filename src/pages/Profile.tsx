import React, { useState } from 'react'
import { Card, Form, Input, Button, message, Typography } from 'antd'
import { KeyOutlined } from '@ant-design/icons'
import { api } from '../api'

const { Text } = Typography

export default function Profile() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const values = await form.validateFields()
    if (values.newPassword !== values.confirmPassword) { message.error('两次输入的新密码不一致'); return }
    setLoading(true)
    try {
      await api.changePassword(values.oldPassword, values.newPassword)
      message.success('密码修改成功，请牢记新密码')
      form.resetFields()
    } catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">账号设置</h1>
        <p className="page-desc">修改当前登录账号的密码</p>
      </div>
      <Card style={{ maxWidth: 520, borderRadius: 12 }}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password prefix={<KeyOutlined />} placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '至少 6 位' }]}>
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="确认新密码" rules={[{ required: true, message: '请再次输入新密码' }]}>
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>修改密码</Button>
        </Form>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 16 }}>
          为保障安全，请定期更换密码，且不要与其他系统使用相同密码。
        </Text>
      </Card>
    </div>
  )
}
