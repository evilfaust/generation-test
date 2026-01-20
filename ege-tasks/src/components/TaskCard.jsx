import { useState } from 'react';
import { Card, Tag, Space, Typography, Divider, Image, Button, Select, message, Badge } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  FileTextOutlined,
  CalendarOutlined,
  EditOutlined,
} from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import TaskEditModal from './TaskEditModal';
import { api } from '../services/pocketbase';

const { Text, Paragraph } = Typography;
const { Option } = Select;

const TaskCard = ({ task, onUpdate }) => {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [changingDifficulty, setChangingDifficulty] = useState(false);

  const getDifficultyColor = (difficulty) => {
    const colors = {
      '1': '#52c41a',
      '2': '#1890ff',
      '3': '#fa8c16',
      '4': '#f5222d',
      '5': '#722ed1',
    };
    return colors[difficulty] || '#d9d9d9';
  };

  const getDifficultyLabel = (difficulty) => {
    const labels = {
      '1': 'Базовый',
      '2': 'Средний',
      '3': 'Повышенный',
      '4': 'Высокий',
      '5': 'Олимпиадный',
    };
    return labels[difficulty] || 'Неизвестно';
  };

  const handleDifficultyChange = async (newDifficulty) => {
    setChangingDifficulty(true);
    try {
      await api.updateTask(task.id, { difficulty: newDifficulty });
      message.success('Уровень сложности изменён');
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating difficulty:', error);
      message.error('Ошибка при изменении уровня');
    } finally {
      setChangingDifficulty(false);
    }
  };

  const handleSave = async (taskId, values) => {
    try {
      await api.updateTask(taskId, values);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      throw error;
    }
  };

  return (
    <>
      <Card
        size="small"
        hoverable
        style={{ height: '100%' }}
        title={
          <Space>
            <Text strong>{task.code}</Text>
            {task.expand?.topic && (
              <Tag color="blue">№{task.expand.topic.ege_number}</Tag>
            )}
          </Space>
        }
        extra={
          <Space size="small">
            <Badge 
              color={getDifficultyColor(task.difficulty)} 
              text={
                <Select
                  value={task.difficulty}
                  onChange={handleDifficultyChange}
                  loading={changingDifficulty}
                  size="small"
                  style={{ width: 105 }}
                  onClick={(e) => e.stopPropagation()}
                  bordered={false}
                  dropdownMatchSelectWidth={140}
                  suffixIcon={null}
                >
                  <Option value="1">
                    <Space size={4}>
                      <Badge color={getDifficultyColor('1')} />
                      <Text style={{ fontSize: 12 }}>1 - Базовый</Text>
                    </Space>
                  </Option>
                  <Option value="2">
                    <Space size={4}>
                      <Badge color={getDifficultyColor('2')} />
                      <Text style={{ fontSize: 12 }}>2 - Средний</Text>
                    </Space>
                  </Option>
                  <Option value="3">
                    <Space size={4}>
                      <Badge color={getDifficultyColor('3')} />
                      <Text style={{ fontSize: 12 }}>3 - Повышенный</Text>
                    </Space>
                  </Option>
                  <Option value="4">
                    <Space size={4}>
                      <Badge color={getDifficultyColor('4')} />
                      <Text style={{ fontSize: 12 }}>4 - Высокий</Text>
                    </Space>
                  </Option>
                  <Option value="5">
                    <Space size={4}>
                      <Badge color={getDifficultyColor('5')} />
                      <Text style={{ fontSize: 12 }}>5 - Олимпиадный</Text>
                    </Space>
                  </Option>
                </Select>
              }
            />
            <Button 
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setEditModalVisible(true)}
              title="Редактировать задачу"
            />
          </Space>
        }
      >
        {/* Условие задачи */}
        <Paragraph style={{ fontSize: 14, marginBottom: 12 }}>
          <MathRenderer text={task.statement_md} />
        </Paragraph>

        {/* Изображение если есть */}
        {task.has_image && task.image && (
          <div style={{ marginBottom: 12 }}>
            <Image
              src={api.getImageUrl(task, task.image)}
              alt="Task image"
              style={{ maxWidth: '100%' }}
            />
          </div>
        )}

        <Divider style={{ margin: '12px 0' }} />

        {/* Ответ */}
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Space align="start">
            {task.answer ? (
              <>
                <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 4 }} />
                <div>
                  <Text strong>Ответ: </Text>
                  <span style={{ 
                    background: '#f5f5f5', 
                    padding: '2px 8px', 
                    borderRadius: 4,
                    fontFamily: 'monospace'
                  }}>
                    <MathRenderer text={task.answer} />
                  </span>
                </div>
              </>
            ) : (
              <>
                <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                <Text type="secondary">Ответ не указан</Text>
              </>
            )}
          </Space>

          {/* Решение */}
          <Space>
            {task.solution_md ? (
              <>
                <FileTextOutlined style={{ color: '#52c41a' }} />
                <Text type="success">Есть решение</Text>
              </>
            ) : (
              <>
                <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                <Text type="secondary">Нет решения</Text>
              </>
            )}
          </Space>

          {/* Метаданные */}
          <div style={{ marginTop: 8 }}>
            <Space wrap size={4}>
              {task.source && (
                <Tag icon={<FileTextOutlined />}>{task.source}</Tag>
              )}
              {task.year && (
                <Tag icon={<CalendarOutlined />}>{task.year}</Tag>
              )}
            </Space>
          </div>

          {/* Теги */}
          {task.expand?.tags && task.expand.tags.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Space wrap size={4}>
                {task.expand.tags.map(tag => (
                  <Tag key={tag.id} color={tag.color}>
                    {tag.title}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </Space>
      </Card>

      <TaskEditModal
        task={task}
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSave}
      />
    </>
  );
};

export default TaskCard;

