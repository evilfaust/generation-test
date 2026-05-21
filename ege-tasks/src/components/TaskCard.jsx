import { useState } from 'react';
import { Card, Tag, Space, Typography, Divider, Image, Button, Select, Badge, Checkbox, App } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  FileTextOutlined,
  CalendarOutlined,
  EditOutlined,
} from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import TaskEditModal from './TaskEditModal';
import { api } from '../services/pocketbase';
import { useAuth } from '../contexts/AuthContext';

const { Text, Paragraph } = Typography;
const { Option } = Select;

const TaskCard = ({ task, allTags, allSources, allYears, allSubtopics, allTopics, onUpdate, selected = false, onSelect }) => {
  const { canEdit } = useAuth();
  const { message } = App.useApp();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [changingDifficulty, setChangingDifficulty] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const taskImageUrl = api.getTaskImageUrl(task);

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

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      await api.createTask({
        code: `${task.code}-copy`,
        topic: task.topic,
        subtopic: task.subtopic || [],
        tags: task.tags || [],
        difficulty: task.difficulty,
        statement_md: task.statement_md,
        answer: task.answer,
        solution_md: task.solution_md,
        explanation_md: task.explanation_md,
        source: task.source,
        year: task.year,
        has_image: false,
      });
      message.success(`Дубликат создан: ${task.code}-copy`);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error duplicating task:', error);
      message.error('Ошибка при дублировании задачи');
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async (taskId) => {
    await api.deleteTask(taskId);
    if (onUpdate) {
      onUpdate();
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
            <Checkbox
              checked={selected}
              onChange={(e) => onSelect?.(task.id, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
            <Text strong>{task.code}</Text>
            {task.expand?.topic && (
              <Tag color="blue">
                {task.expand.topic.ege_number ? `№${task.expand.topic.ege_number}` : task.expand.topic.title}
              </Tag>
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
                  variant="borderless"
                  popupMatchSelectWidth={140}
                  suffixIcon={null}
                  disabled={!canEdit}
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
            {canEdit && (
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                loading={duplicating}
                onClick={(e) => { e.stopPropagation(); handleDuplicate(); }}
                title="Создать дубликат"
              />
            )}
            {canEdit && (
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => setEditModalVisible(true)}
                title="Редактировать задачу"
              />
            )}
          </Space>
        }
      >
        {/* Условие задачи */}
        <Paragraph className="task-statement" style={{ fontSize: 14, marginBottom: 12 }}>
          <MathRenderer text={task.statement_md} />
        </Paragraph>

        {/* Изображение если есть */}
        {task.has_image && taskImageUrl && (
          <div className="task-card-image" style={{ marginBottom: 12 }}>
            <Image
              src={taskImageUrl}
              alt="Task image"
              preview={false}
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
        onDelete={handleDelete}
        allTags={allTags || []}
        allSources={allSources || []}
        allYears={allYears || []}
        allSubtopics={allSubtopics || []}
        allTopics={allTopics || []}
      />
    </>
  );
};

export default TaskCard;
