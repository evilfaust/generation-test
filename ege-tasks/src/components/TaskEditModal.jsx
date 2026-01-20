import { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, message, Button, Space } from 'antd';
import { EditOutlined, SaveOutlined } from '@ant-design/icons';
import MathRenderer from './MathRenderer';

const { Option } = Select;
const { TextArea } = Input;

const TaskEditModal = ({ task, visible, onClose, onSave }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [previewStatement, setPreviewStatement] = useState('');
  const [previewAnswer, setPreviewAnswer] = useState('');

  useEffect(() => {
    if (task && visible) {
      form.setFieldsValue({
        difficulty: task.difficulty,
        answer: task.answer || '',
        statement_md: task.statement_md || '',
        solution_md: task.solution_md || '',
      });
      setPreviewStatement(task.statement_md || '');
      setPreviewAnswer(task.answer || '');
    }
  }, [task, visible, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      await onSave(task.id, values);
      
      message.success('Задача успешно обновлена');
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      message.error('Ошибка при сохранении задачи');
    } finally {
      setLoading(false);
    }
  };

  const handleStatementChange = (e) => {
    setPreviewStatement(e.target.value);
  };

  const handleAnswerChange = (e) => {
    setPreviewAnswer(e.target.value);
  };

  return (
    <Modal
      title={
        <Space>
          <EditOutlined />
          <span>Редактирование задачи {task?.code}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Отмена
        </Button>,
        <Button 
          key="save" 
          type="primary" 
          icon={<SaveOutlined />}
          loading={loading}
          onClick={handleSave}
        >
          Сохранить
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
      >
        {/* Уровень сложности */}
        <Form.Item
          name="difficulty"
          label="Уровень сложности"
          rules={[{ required: true, message: 'Выберите уровень сложности' }]}
        >
          <Select>
            <Option value="1">1 - Базовый</Option>
            <Option value="2">2 - Средний</Option>
            <Option value="3">3 - Повышенный</Option>
            <Option value="4">4 - Высокий</Option>
            <Option value="5">5 - Олимпиадный</Option>
          </Select>
        </Form.Item>

        {/* Текст задания */}
        <Form.Item
          name="statement_md"
          label="Текст задания (поддерживает LaTeX: $x^2$)"
        >
          <TextArea 
            rows={4}
            placeholder="Введите текст задания..."
            onChange={handleStatementChange}
          />
        </Form.Item>

        {/* Предпросмотр задания */}
        {previewStatement && (
          <div style={{ 
            marginBottom: 16, 
            padding: 12, 
            background: '#f5f5f5',
            borderRadius: 4,
            border: '1px solid #d9d9d9'
          }}>
            <div style={{ 
              fontSize: 12, 
              color: '#666', 
              marginBottom: 8,
              fontWeight: 'bold'
            }}>
              Предпросмотр задания:
            </div>
            <MathRenderer text={previewStatement} />
          </div>
        )}

        {/* Ответ */}
        <Form.Item
          name="answer"
          label="Ответ (поддерживает LaTeX)"
        >
          <Input 
            placeholder="Введите ответ..."
            onChange={handleAnswerChange}
          />
        </Form.Item>

        {/* Предпросмотр ответа */}
        {previewAnswer && (
          <div style={{ 
            marginBottom: 16, 
            padding: 12, 
            background: '#e6f7ff',
            borderRadius: 4,
            border: '1px solid #91d5ff'
          }}>
            <div style={{ 
              fontSize: 12, 
              color: '#666', 
              marginBottom: 8,
              fontWeight: 'bold'
            }}>
              Предпросмотр ответа:
            </div>
            <MathRenderer text={previewAnswer} />
          </div>
        )}

        {/* Решение */}
        <Form.Item
          name="solution_md"
          label="Решение (опционально, поддерживает LaTeX)"
        >
          <TextArea 
            rows={4}
            placeholder="Введите решение задачи..."
          />
        </Form.Item>

        {/* Подсказка по LaTeX */}
        <div style={{ 
          fontSize: 12, 
          color: '#666',
          background: '#fff7e6',
          padding: 8,
          borderRadius: 4,
          border: '1px solid #ffd591'
        }}>
          <strong>Примеры LaTeX:</strong><br />
          • Степени: <code>x^2</code>, <code>a^{10}</code><br />
          • Дроби: <code>\frac{'{'}a{'}'}{'{'} b{'}'}</code><br />
          • Корни: <code>\sqrt{'{'}x{'}'}</code>, <code>\sqrt[3]{'{'}x{'}'}</code><br />
          • Знаки: <code>\cdot</code> (умножение), <code>\leq</code>, <code>\geq</code><br />
          • Скобки: <code>\left( ... \right)</code>
        </div>
      </Form>
    </Modal>
  );
};

export default TaskEditModal;