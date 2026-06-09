/**
 * StorageConnect — форма подключения к файловому хранилищу (pb-files / files.l.oipav.ru).
 * Переиспользуется в «Библиотеке» (MaterialsLibrary) и в пикере (MaterialPickerModal).
 * Вход — логин в auth-коллекцию `users` (токен 60 дней, SDK сам продлевает).
 */
import { useState } from 'react';
import { Card, Button, Input, Form, Typography, Space, message } from 'antd';
import { CloudServerOutlined } from '@ant-design/icons';
import { materialsApi, FILES_BASE_URL } from '../../shared/services/pb/filesClient';

const { Title, Text } = Typography;

export default function ConnectForm({ onConnected, compact = false }) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const onFinish = async ({ email, password }) => {
    setLoading(true);
    try {
      await materialsApi.connect(email.trim(), password);
      message.success('Хранилище подключено');
      onConnected?.();
    } catch (e) {
      message.error(e?.message || 'Не удалось подключиться (проверьте пароль хранилища)');
    } finally {
      setLoading(false);
    }
  };

  const inner = (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space>
        <CloudServerOutlined style={{ fontSize: 22 }} />
        <Title level={compact ? 5 : 4} style={{ margin: 0 }}>Подключить файловое хранилище</Title>
      </Space>
      <Text type="secondary">
        Файлы хранятся на вашей малине ({FILES_BASE_URL.replace(/^https?:\/\//, '')}).
        Вход отдельным паролем хранилища — токен запоминается надолго.
      </Text>
      <Form form={form} layout="vertical" onFinish={onFinish}
        initialValues={{ email: materialsApi.lastEmail() }}>
        <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Введите email' }]}>
          <Input autoComplete="username" placeholder="oleg.faust@gmail.com" />
        </Form.Item>
        <Form.Item name="password" label="Пароль хранилища" rules={[{ required: true, message: 'Введите пароль' }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>Подключить</Button>
      </Form>
    </Space>
  );

  if (compact) return inner;
  return <Card style={{ maxWidth: 460, margin: '40px auto' }}>{inner}</Card>;
}
