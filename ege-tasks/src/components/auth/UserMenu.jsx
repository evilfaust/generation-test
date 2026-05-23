/**
 * UserMenu — блок текущего пользователя в шапке.
 * Показывает аватарку + имя + dropdown с действиями (мой профиль, выйти).
 */
import { useState } from 'react';
import { Dropdown, Avatar, Space, Typography } from 'antd';
import {
  UserOutlined, LogoutOutlined, CrownOutlined, EditOutlined, EyeOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/pocketbase';
import ProfileModal from './ProfileModal';

const { Text } = Typography;

const ROLE_META = {
  superadmin: { label: 'Суперадмин', icon: <CrownOutlined />, color: '#faad14' },
  editor:     { label: 'Редактор',   icon: <EditOutlined />,  color: '#1677ff' },
  viewer:     { label: 'Зритель',    icon: <EyeOutlined />,   color: '#8c8c8c' },
};

export default function UserMenu({ compact = false }) {
  const { teacher, role, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  if (!teacher) return null;

  const meta = ROLE_META[role] || ROLE_META.viewer;
  const avatarUrl = api.getTeacherAvatarUrl(teacher, 'small');

  const items = [
    {
      key: 'role',
      label: (
        <Space size={6}>
          <span style={{ color: meta.color }}>{meta.icon}</span>
          <Text type="secondary">{meta.label}</Text>
        </Space>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'profile',
      label: 'Мой профиль',
      icon: <IdcardOutlined />,
      onClick: () => setProfileOpen(true),
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: 'Выйти',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: () => {
        logout();
        navigate('/login', { replace: true });
      },
    },
  ];

  return (
    <>
      <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
        <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}>
          <Avatar
            size="small"
            src={avatarUrl}
            icon={!avatarUrl ? <UserOutlined /> : null}
            style={!avatarUrl ? { background: meta.color } : undefined}
          />
          {!compact && (
            <Text style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {teacher.name || teacher.username}
            </Text>
          )}
        </Space>
      </Dropdown>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
