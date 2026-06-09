/**
 * ProfileModal — окно "Мой профиль".
 *
 * Любой залогиненный учитель может редактировать своё имя, аватарку,
 * сменить пароль. Роль и allowed_sections менять нельзя — это привилегия
 * superadmin (через UserManager).
 *
 * Открывается из UserMenu по клику "Мой профиль".
 */
import { useState, useEffect } from 'react';
import {
  Modal, Form, Input, Upload, Button, Space, Avatar, message, Divider, Typography,
} from 'antd';
import { UserOutlined, UploadOutlined, KeyOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';

const { Text } = Typography;

export default function ProfileModal({ open, onClose }) {
  const { teacher } = useAuth();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);       // File | null | undefined
  const [avatarPreview, setAvatarPreview] = useState(null); // dataURL для превью
  const [removeAvatar, setRemoveAvatar] = useState(false);

  // Сбрасываем форму каждый раз при открытии.
  useEffect(() => {
    if (open && teacher) {
      form.setFieldsValue({
        username: teacher.username,
        name: teacher.name,
        password: '',
      });
      setAvatarFile(null);
      setAvatarPreview(null);
      setRemoveAvatar(false);
    }
  }, [open, teacher, form]);

  if (!teacher) return null;

  const currentAvatarUrl = api.getTeacherAvatarUrl(teacher, 'medium');
  const displayAvatarUrl = avatarPreview || (removeAvatar ? null : currentAvatarUrl);

  const handleBeforeUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('Можно загрузить только изображение');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error('Размер файла не должен превышать 2 МБ');
      return Upload.LIST_IGNORE;
    }
    setAvatarFile(file);
    setRemoveAvatar(false);
    const reader = new FileReader();
    reader.onload = (e) => setAvatarPreview(e.target.result);
    reader.readAsDataURL(file);
    return false; // не загружать автоматически — отправим при сабмите
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = { name: values.name };
      if (values.password) payload.password = values.password;
      if (avatarFile) {
        payload.avatar = avatarFile;
      } else if (removeAvatar) {
        payload.avatar = null;
      }

      await api.updateTeacher(teacher.id, payload);

      // Обновляем модель в authStore — иначе UserMenu покажет старую аватарку.
      // Используем authRefresh (получит свежий record + сохранит токен).
      await import('../../shared/services/pocketbase').then(({ default: pb }) =>
        pb.collection('teachers').authRefresh()
      );

      message.success('Профиль обновлён');
      onClose();
    } catch (e) {
      message.error(`Не удалось сохранить: ${e?.message || 'ошибка'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Мой профиль"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Сохранить"
      cancelText="Отмена"
      width={520}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Avatar
          size={96}
          src={displayAvatarUrl}
          icon={<UserOutlined />}
          style={{ background: displayAvatarUrl ? 'transparent' : '#1677ff' }}
        />
        <Space>
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={handleBeforeUpload}
          >
            <Button icon={<UploadOutlined />} size="small">
              {currentAvatarUrl || avatarPreview ? 'Заменить' : 'Загрузить'}
            </Button>
          </Upload>
          {(currentAvatarUrl || avatarPreview) && !removeAvatar && (
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              onClick={handleRemoveAvatar}
            >
              Удалить
            </Button>
          )}
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          JPG / PNG / WebP / SVG, до 2 МБ
        </Text>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
        <Form.Item label="Имя пользователя" name="username">
          <Input disabled />
        </Form.Item>

        <Form.Item
          label="Отображаемое имя"
          name="name"
          rules={[{ required: true, message: 'Введите имя' }, { min: 2 }]}
        >
          <Input />
        </Form.Item>

        <Divider style={{ margin: '12px 0' }} />

        <Form.Item
          label={<Space><KeyOutlined /> Новый пароль (оставьте пустым, чтобы не менять)</Space>}
          name="password"
          rules={[{ min: 8, message: 'Минимум 8 символов', validateTrigger: 'onBlur' }]}
        >
          <Input.Password placeholder="без изменений" autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
