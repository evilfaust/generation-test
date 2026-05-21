import { useEffect, useState } from 'react';
import { Card, Table, Space, Button, Modal, Form, Input, InputNumber, Select, Tooltip, App } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SwapOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/pocketbase';

export default function SubtopicTab({ subtopicRows, tasksSnapshot, onOpenTasks, onMerge, onReload }) {
  const { topics, reloadData } = useReferenceData();
  const { canEdit, canDelete } = useAuth();
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form] = Form.useForm();

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(subtopicRows.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [subtopicRows.length, pageSize, currentPage]);

  const openModal = (subtopic = null) => {
    setEditing(subtopic);
    setModalOpen(true);
    form.setFieldsValue({
      name: subtopic?.name || subtopic?.title || '',
      topic: subtopic?.topic || null,
      order: subtopic?.order || null,
    });
  };

  const save = async (values) => {
    try {
      if (editing) {
        await api.updateSubtopic(editing.id, values);
        message.success('Подтема обновлена');
      } else {
        await api.createSubtopic(values);
        message.success('Подтема создана');
      }
      setModalOpen(false);
      setEditing(null);
      reloadData();
    } catch (error) {
      message.error('Ошибка при сохранении подтемы');
    }
  };

  const remove = (subtopic) => {
    Modal.confirm({
      title: 'Удалить подтему?',
      content: `Подтема "${subtopic.name || subtopic.title}" будет удалена. Задачи потеряют эту связь.`,
      okType: 'danger',
      onOk: async () => {
        try {
          const related = tasksSnapshot.filter(t => {
            if (Array.isArray(t.subtopic)) return t.subtopic.includes(subtopic.id);
            return t.subtopic === subtopic.id;
          });
          for (const task of related) {
            const next = Array.isArray(task.subtopic) ? task.subtopic.filter(id => id !== subtopic.id) : [];
            await api.updateTask(task.id, { subtopic: next });
          }
          await api.deleteSubtopic(subtopic.id);
          message.success('Подтема удалена');
          reloadData();
          onReload();
        } catch (error) {
          message.error('Ошибка при удалении подтемы');
        }
      },
    });
  };

  return (
    <>
      <Card
        title="Подтемы"
        extra={canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Добавить подтему</Button>}
      >
        <Table
          size="small"
          dataSource={subtopicRows}
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
            { title: 'Подтема', dataIndex: 'title', sorter: (a, b) => (a.title || '').localeCompare(b.title || '') },
            { title: 'Тема', dataIndex: 'topicTitle', sorter: (a, b) => (a.topicTitle || '').localeCompare(b.topicTitle || '') },
            { title: 'Порядок', dataIndex: 'order', width: 90, sorter: (a, b) => (a.order || 0) - (b.order || 0) },
            { title: 'Кол-во', dataIndex: 'count', width: 90, sorter: (a, b) => a.count - b.count },
            {
              title: 'Действия',
              width: 260,
              render: (_, record) => (
                <Space>
                  <Tooltip title="Открыть задачи">
                    <Button size="small" icon={<FolderOpenOutlined />} onClick={() => onOpenTasks({ subtopic: record.key, topic: record.topicId })} />
                  </Tooltip>
                  {canEdit && <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record.raw)} />}
                  {canEdit && <Button size="small" icon={<SwapOutlined />} onClick={() => onMerge('subtopic', record.raw)} />}
                  {canDelete && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(record.raw)} />}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? 'Редактировать подтему' : 'Создать подтему'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="topic" label="Тема" rules={[{ required: true, message: 'Выберите тему' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={topics.map(t => ({
                label: t.ege_number ? `№${t.ege_number} — ${t.title}` : t.title,
                value: t.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="order" label="Порядок">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
