import { Badge, Button, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined, EditOutlined, EyeOutlined, HolderOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import MathRenderer from '../MathRenderer';

const { Text } = Typography;

export const DIFFICULTY_COLORS = { 1: '#52c41a', 2: '#faad14', 3: '#ff4d4f', 4: '#a8071a', 5: '#722ed1' };
export const DIFFICULTY_LABELS = { 1: 'Базовый', 2: 'Средний', 3: 'Повышенный', 4: 'Высокий', 5: 'Олимпиадный' };

// Колонки таблицы задач геометрии, вынесены из GeometryTaskList.jsx (god-компонент).
// Замыкания на state/обработчики передаются явным объектом deps.
export function buildGeometryColumns({
  setDraggingTaskId, setDropTargetTaskId,
  canEdit, canDelete,
  editorLoadingId, quickPreviewLoadingId, duplicatingId,
  openEdit, openQuickPreview, handleDuplicate, handleDelete,
}) {
  return [
    {
      title: '',
      key: 'drag',
      width: 42,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="Перетащите для смены порядка">
          <span
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.effectAllowed = 'move';
              setDraggingTaskId(record.id);
            }}
            onDragEnd={() => {
              setDraggingTaskId(null);
              setDropTargetTaskId(null);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'grab',
              color: '#8c8c8c',
              width: 18,
              height: 18,
            }}
          >
            <HolderOutlined />
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Код',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      sorter: (a, b) => a.code.localeCompare(b.code),
      render: (code) => <Text code style={{ fontSize: 13 }}>{code}</Text>,
    },
    {
      title: 'Тема / Подтема',
      key: 'topic_subtopic',
      ellipsis: true,
      render: (_, record) => {
        const topic = record.expand?.topic?.title;
        const subtopic = record.expand?.subtopic?.title;
        if (!topic && !subtopic) return <Text type="secondary">—</Text>;
        return (
          <Space direction="vertical" size={0}>
            {topic && <Text style={{ fontSize: 12 }}>{topic}</Text>}
            {subtopic && <Text type="secondary" style={{ fontSize: 11 }}>{subtopic}</Text>}
          </Space>
        );
      },
    },
    {
      title: 'Сл.',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 60,
      align: 'center',
      sorter: (a, b) => (a.difficulty || 0) - (b.difficulty || 0),
      render: (d) =>
        d ? (
          <Tooltip title={DIFFICULTY_LABELS[d]}>
            <Badge
              count={d}
              style={{ backgroundColor: DIFFICULTY_COLORS[d] }}
            />
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Ответ',
      dataIndex: 'answer',
      key: 'answer',
      width: 120,
      render: (v) =>
        v ? (
          <MathRenderer text={String(v)} />
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Чертёж',
      key: 'has_drawing',
      width: 80,
      align: 'center',
      render: (_, record) => (
        api.getGeometryImageUrl(record)
          ? (
            <Tooltip title="PNG-картинка сохранена">
              <Tag color="gold" style={{ margin: 0 }}>IMG</Tag>
            </Tooltip>
          )
          : <Text type="secondary">—</Text>
      ),
    },
    {
      title: 'Превью',
      key: 'drawing_preview',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const imageUrl = api.getGeometryImageUrl(record);
        if (!imageUrl) return <Text type="secondary">—</Text>;

        return (
          <img
            src={imageUrl}
            alt={`Превью ${record.code || ''}`}
            style={{
              width: 72,
              height: 48,
              objectFit: 'contain',
              border: '1px solid #f0f0f0',
              borderRadius: 6,
              background: '#fff',
              display: 'block',
              margin: '0 auto',
            }}
          />
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 130,
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {canEdit && (
            <Tooltip title="Редактировать">
              <Button
                type="text"
                icon={<EditOutlined />}
                size="small"
                loading={editorLoadingId === record.id}
                disabled={editorLoadingId !== null && editorLoadingId !== record.id}
                onClick={() => openEdit(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="Просмотр">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              loading={quickPreviewLoadingId === record.id}
              onClick={() => openQuickPreview(record)}
            />
          </Tooltip>
          {canEdit && (
            <Tooltip title="Дублировать">
              <Button
                type="text"
                icon={<CopyOutlined />}
                size="small"
                loading={duplicatingId === record.id}
                disabled={duplicatingId !== null && duplicatingId !== record.id}
                onClick={() => handleDuplicate(record.id)}
              />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Удалить задачу?"
              description="Это действие необратимо."
              okText="Удалить"
              cancelText="Отмена"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(record.id)}
            >
              <Tooltip title="Удалить">
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];
}
