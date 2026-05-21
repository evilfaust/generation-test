import { useEffect, useState } from 'react';
import { Card, Table, Space, Button, Modal, Form, Input, InputNumber, Select, Tooltip, App } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SwapOutlined, FolderOpenOutlined } from '@ant-design/icons';

const EXAM_TYPE_OPTIONS = [
  { value: 'ege_base',    label: 'ЕГЭ базовый (11 кл.)' },
  { value: 'ege_profile', label: 'ЕГЭ профильный (11 кл.)' },
  { value: 'vpr',         label: 'ВПР' },
  { value: 'oral',        label: 'Устный счёт' },
  { value: 'trig',        label: 'Тригонометрия' },
  { value: 'mordkovich',  label: 'Мордкович' },
  { value: 'other',       label: 'Прочее' },
];
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/pocketbase';

export default function TopicTab({ topicRows, tasksSnapshot, onOpenTasks, onMerge, onReload }) {
  const { topics, reloadData } = useReferenceData();
  const { canEdit, canDelete } = useAuth();
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form] = Form.useForm();

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(topicRows.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [topicRows.length, pageSize, currentPage]);

  const openModal = (topic = null) => {
    setEditing(topic);
    setModalOpen(true);
    form.setFieldsValue({
      title:       topic?.title       || '',
      ege_number:  topic?.ege_number  || null,
      exam_type:   topic?.exam_type   || null,
      exam_part:   topic?.exam_part   || null,
      order:       topic?.order       || null,
      description: topic?.description || '',
    });
  };

  const save = async (values) => {
    try {
      if (editing) {
        await api.updateTopic(editing.id, values);
        message.success('Тема обновлена');
      } else {
        await api.createTopic(values);
        message.success('Тема создана');
      }
      setModalOpen(false);
      setEditing(null);
      reloadData();
    } catch (error) {
      message.error('Ошибка при сохранении темы');
    }
  };

  const remove = (topic) => {
    Modal.confirm({
      title: 'Удалить тему?',
      content: `Тема "${topic.title}" будет удалена. Связанные задачи останутся, но без темы.`,
      okType: 'danger',
      onOk: async () => {
        try {
          const related = tasksSnapshot.filter(t => t.topic === topic.id);
          for (const task of related) {
            await api.updateTask(task.id, { topic: null, subtopic: [] });
          }
          await api.deleteTopic(topic.id);
          message.success('Тема удалена');
          reloadData();
          onReload();
        } catch (error) {
          message.error('Ошибка при удалении темы');
        }
      },
    });
  };

  return (
    <>
      <Card
        title="Темы"
        extra={canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Добавить тему</Button>}
      >
        <Table
          size="small"
          dataSource={topicRows}
          pagination={{
            current: currentPage,
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
          columns={[
            { title: '№', dataIndex: 'ege', width: 60, sorter: (a, b) => (a.ege || 0) - (b.ege || 0) },
            { title: 'Тема', dataIndex: 'title', sorter: (a, b) => (a.title || '').localeCompare(b.title || '') },
            { title: 'Порядок', dataIndex: 'order', width: 90, sorter: (a, b) => (a.order || 0) - (b.order || 0) },
            { title: 'Кол-во', dataIndex: 'count', width: 90, sorter: (a, b) => a.count - b.count },
            {
              title: 'Действия',
              width: 260,
              render: (_, record) => (
                <Space>
                  <Tooltip title="Открыть задачи">
                    <Button size="small" icon={<FolderOpenOutlined />} onClick={() => onOpenTasks({ topic: record.key })} />
                  </Tooltip>
                  {canEdit && <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record.raw)} />}
                  {canEdit && <Button size="small" icon={<SwapOutlined />} onClick={() => onMerge('topic', record.raw)} />}
                  {canDelete && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(record.raw)} />}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? 'Редактировать тему' : 'Создать тему'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="exam_type" label="Контекст (тип экзамена)">
            <Select placeholder="Не указан" allowClear options={EXAM_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="ege_number" label="Номер задания в экзамене">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="exam_part" label="Часть экзамена (для профильного ЕГЭ: 1 или 2)">
            <InputNumber min={1} max={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="order" label="Порядок сортировки">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
