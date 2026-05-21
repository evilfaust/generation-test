import { useEffect, useState } from 'react';
import { Card, Table, Space, Button, Modal, Input, Tooltip, App } from 'antd';
import { DeleteOutlined, EditOutlined, SwapOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/pocketbase';

export default function SourceTab({ sourceRows, tasksSnapshot, onOpenTasks, onMerge, onReload }) {
  const { reloadData } = useReferenceData();
  const { canEdit, canDelete } = useAuth();
  const { message } = App.useApp();
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameFrom, setRenameFrom] = useState(null);
  const [renameTo, setRenameTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(sourceRows.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [sourceRows.length, pageSize, currentPage]);

  const openRename = (source) => {
    setRenameFrom(source);
    setRenameTo(source || '');
    setRenameModalOpen(true);
  };

  const applyRename = async () => {
    if (!renameFrom || !renameTo) return;
    try {
      const related = tasksSnapshot.filter(t => t.source === renameFrom);
      for (const task of related) {
        await api.updateTask(task.id, { source: renameTo });
      }
      message.success('Источник обновлён');
      setRenameModalOpen(false);
      setRenameFrom(null);
      setRenameTo('');
      onReload();
      reloadData();
    } catch (error) {
      message.error('Ошибка при обновлении источника');
    }
  };

  const clear = (source) => {
    Modal.confirm({
      title: 'Удалить источник?',
      content: `У источника "${source}" будет очищено поле у связанных задач.`,
      okType: 'danger',
      onOk: async () => {
        try {
          const related = tasksSnapshot.filter(t => t.source === source);
          for (const task of related) {
            await api.updateTask(task.id, { source: null });
          }
          message.success('Источник удалён');
          onReload();
          reloadData();
        } catch (error) {
          message.error('Ошибка при удалении источника');
        }
      },
    });
  };

  return (
    <>
      <Card title="Источники">
        <Table
          size="small"
          dataSource={sourceRows}
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
            { title: 'Источник', dataIndex: 'source', sorter: (a, b) => (a.source || '').localeCompare(b.source || '') },
            { title: 'Кол-во', dataIndex: 'count', width: 90, sorter: (a, b) => a.count - b.count },
            {
              title: 'Действия',
              width: 260,
              render: (_, record) => (
                <Space>
                  <Tooltip title="Открыть задачи">
                    <Button size="small" icon={<FolderOpenOutlined />} onClick={() => onOpenTasks({ source: record.source })} />
                  </Tooltip>
                  {canEdit && <Button size="small" icon={<EditOutlined />} onClick={() => openRename(record.source)} />}
                  {canEdit && <Button size="small" icon={<SwapOutlined />} onClick={() => onMerge('source', record.source)} />}
                  {canDelete && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => clear(record.source)} />}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Переименовать источник"
        open={renameModalOpen}
        onCancel={() => setRenameModalOpen(false)}
        onOk={applyRename}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>Старое значение: <strong>{renameFrom}</strong></div>
          <Input value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
        </Space>
      </Modal>
    </>
  );
}
