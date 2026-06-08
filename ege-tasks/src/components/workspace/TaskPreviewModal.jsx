import { useEffect, useState } from 'react';
import { Divider, Empty, Modal, Spin, Tag, Typography } from 'antd';
import { api } from '../../shared/services/pocketbase';
import MathRenderer from '../MathRenderer';

const { Text } = Typography;

// Лёгкий просмотр задачи Лемме (условие + ответ + решение) прямо в модалке разбора.
// Картинки у импортированных задач уже локальные (born-local) → MathRenderer рисует.
export default function TaskPreviewModal({ taskId, open, onClose }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !taskId) { setTask(null); return; }
    setLoading(true);
    api.getTask(taskId)
      .then(setTask)
      .catch(() => setTask(null))
      .finally(() => setLoading(false));
  }, [open, taskId]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      title={task ? `Задача в Лемме${task.code ? ` · ${task.code}` : ''}` : 'Задача в Лемме'}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
      ) : !task ? (
        <Empty description="Не удалось загрузить задачу" />
      ) : (
        <div className="task-preview">
          {task.sdamgia_id && <Tag color="blue" style={{ marginBottom: 8 }}>решу id {task.sdamgia_id}</Tag>}
          <MathRenderer text={task.statement_md} />
          {task.answer && (
            <div style={{ marginTop: 12 }}>
              <Text strong>Ответ:</Text> <MathRenderer text={task.answer} />
            </div>
          )}
          {task.solution_md && (
            <>
              <Divider orientation="left" style={{ margin: '12px 0' }}>Решение</Divider>
              <MathRenderer text={task.solution_md} />
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
