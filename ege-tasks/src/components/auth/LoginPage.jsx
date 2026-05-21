/**
 * LoginPage — страница входа для учителей.
 *
 * URL: /login
 * После успешного логина перенаправляет на /app/tasks (или на сохранённый
 * "from" path, если пользователь пришёл с какой-то страницы через ProtectedRoute).
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Form, Input, Button, Checkbox, Alert, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const from = location.state?.from?.pathname || '/app/tasks';

  const handleSubmit = async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await login(values.username.trim(), values.password, !!values.remember);
      navigate(from, { replace: true });
    } catch (e) {
      setError(
        e?.status === 400
          ? 'Неверное имя пользователя или пароль'
          : `Ошибка входа: ${e?.message || 'неизвестно'}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%)',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src="/lemma-logo-new.png"
            alt="Lemma"
            style={{ height: 64, width: 'auto', borderRadius: 8 }}
          />
          <Title level={3} style={{ marginTop: 16, marginBottom: 4 }}>
            Вход в Lemma
          </Title>
          <Text type="secondary">Платформа для учителей математики</Text>
        </div>

        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ remember: true }}
          autoComplete="on"
        >
          <Form.Item
            label="Имя пользователя"
            name="username"
            rules={[{ required: true, message: 'Введите имя пользователя' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="username"
              autoFocus
              size="large"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            label="Пароль"
            name="password"
            rules={[{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="••••••••"
              size="large"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 16 }}>
            <Checkbox>Запомнить меня</Checkbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={submitting}
              block
            >
              Войти
            </Button>
          </Form.Item>
        </Form>

        <Text
          type="secondary"
          style={{ display: 'block', textAlign: 'center', marginTop: 16, fontSize: 12 }}
        >
          Забыли пароль? Обратитесь к администратору.
        </Text>
      </Card>
    </div>
  );
}
