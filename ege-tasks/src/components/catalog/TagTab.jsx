import { useEffect, useState } from 'react';
import { Card, Table, Space, Button, Modal, Form, Input, Tag, Tooltip, App } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SwapOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/pocketbase';

export default function TagTab({ tagRows, tasksSnapshot, onOpenTasks, onMerge, onReload }) {
  const { reloadData } = useReferenceData();
  const { canEdit, canDelete } = useAuth();
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form] = Form.useForm();

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(tagRows.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [tagRows.length, pageSize, currentPage]);

  const openModal = (tag = null) => {
    setEditing(tag);
    setModalOpen(true);
    form.setFieldsValue({
      title: tag?.title || '',
      color: tag?.color || '#1890ff',
    });
  };

  const save = async (values) => {
    try {
      if (editing) {
        await api.updateTag(editing.id, values);
        message.success('Тег обновлён');
      } else {
        await api.createTag(values);
        message.success('Тег создан');
      }
      setModalOpen(false);
      setEditing(null);
      reloadData();
    } catch (error) {
      message.error('Ошибка при сохранении тега');
    }
  };

  const remove = (tag) => {
    Modal.confirm({
      title: 'Удалить тег?',
      content: `Тег "${tag.title}" будет удалён. Задачи потеряют этот тег.`,
      okType: 'danger',
      onOk: async () => {
        try {
          const related = tasksSnapshot.filter(t => {
            if (Array.isArray(t.tags)) return t.tags.includes(tag.id);
            return t.tags === tag.id;
          });
          for (const task of related) {
            const next = Array.isArray(task.tags) ? task.tags.filter(id => id !== tag.id) : [];
            await api.updateTask(task.id, { tags: next });
          }
          await api.deleteTag(tag.id);
          message.success('Тег удалён');
          reloadData();
          onReload();
        } catch (error) {
          message.error('Ошибка при удалении тега');
        }
      },
    });
  };

  return (
    <>
      <Card
        title="Теги"
        extra={canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Добавить тег</Button>}
      >
        <Table
          size="small"
          dataSource={tagRows}
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
            {
              title: 'Тег',
              dataIndex: 'title',
              sorter: (a, b) => (a.title || '').localeCompare(b.title || ''),
              render: (value, record) => <Tag color={record.color}>{value}</Tag>,
            },
            { title: 'Кол-во', dataIndex: 'count', width: 90, sorter: (a, b) => a.count - b.count },
            {
              title: 'Действия',
              width: 260,
              render: (_, record) => (
                <Space>
                  <Tooltip title="Открыть задачи">
                    <Button size="small" icon={<FolderOpenOutlined />} onClick={() => onOpenTasks({ tags: [record.key] })} />
                  </Tooltip>
                  {canEdit && <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record.raw)} />}
                  {canEdit && <Button size="small" icon={<SwapOutlined />} onClick={() => onMerge('tag', record.raw)} />}
                  {canDelete && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(record.raw)} />}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? 'Редактировать тег' : 'Создать тег'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="color" label="Цвет">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
