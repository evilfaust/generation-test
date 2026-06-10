import { useState, useEffect, useCallback } from 'react';
import { Button, Tag, Space, Modal, Spin, Empty, Typography, Tooltip, App } from 'antd';
import { PaperClipOutlined, CloseOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';

const { Text } = Typography;

function fmtLessonLabel(lesson) {
  const date = lesson.date_plan ? dayjs(lesson.date_plan).format('DD.MM') : '—';
  const group = lesson.expand?.group?.name;
  return `${date}${group ? ` · ${group}` : ''}${lesson.title ? ` · ${lesson.title}` : ''}`;
}

/**
 * Связка «работа ↔ уроки»: показывает уроки календаря, к которым прикреплена
 * работа (lessons.materials = [{type:'work', id, title}]), позволяет прикрепить
 * к уроку и открепить. Обратная сторона мульти-селекта работ в LessonModal.
 *
 * @param {string} workId
 * @param {string} workTitle
 */
export default function WorkLessonLinks({ workId, workTitle }) {
  const { message } = App.useApp();
  const { canEdit } = useAuth();
  const [linked, setLinked] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const loadLinked = useCallback(async () => {
    if (!workId) return;
    setLoading(true);
    try {
      const lessons = await api.getLessonsByMaterialId(workId);
      // ~ ищет подстроку в json — отфильтруем точное совпадение по id записи
      setLinked(lessons.filter(l =>
        (Array.isArray(l.materials) ? l.materials : []).some(m => m.id === workId)
      ));
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => { loadLinked(); }, [loadLinked]);

  const openPicker = async () => {
    setPickerOpen(true);
    setCandidatesLoading(true);
    try {
      const from = dayjs().subtract(7, 'day').startOf('day').toISOString();
      const to = dayjs().add(60, 'day').endOf('day').toISOString();
      const lessons = await api.getLessons({ from, to });
      const linkedIds = new Set(linked.map(l => l.id));
      setCandidates(lessons.filter(l => !linkedIds.has(l.id)));
    } finally {
      setCandidatesLoading(false);
    }
  };

  const attach = async (lesson) => {
    setBusyId(lesson.id);
    try {
      const materials = Array.isArray(lesson.materials) ? lesson.materials : [];
      await api.updateLesson(lesson.id, {
        materials: [...materials, { type: 'work', id: workId, title: workTitle || '' }],
      });
      message.success(`Работа прикреплена к уроку ${fmtLessonLabel(lesson)}`);
      setPickerOpen(false);
      await loadLinked();
    } catch {
      message.error('Не удалось прикрепить работу к уроку');
    } finally {
      setBusyId(null);
    }
  };

  const detach = async (lesson) => {
    setBusyId(lesson.id);
    try {
      const materials = (Array.isArray(lesson.materials) ? lesson.materials : [])
        .filter(m => m.id !== workId);
      await api.updateLesson(lesson.id, { materials });
      message.success('Работа откреплена от урока');
      await loadLinked();
    } catch {
      message.error('Не удалось открепить работу');
    } finally {
      setBusyId(null);
    }
  };

  if (!workId) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      <Text type="secondary" style={{ fontSize: 13 }}>
        <PaperClipOutlined /> Уроки:
      </Text>
      {loading && <Spin size="small" />}
      {!loading && linked.length === 0 && (
        <Text type="secondary" style={{ fontSize: 13 }}>не прикреплена</Text>
      )}
      {!loading && linked.map(lesson => (
        <Tag
          key={lesson.id}
          color="blue"
          style={{ margin: 0 }}
          closable={canEdit}
          closeIcon={<CloseOutlined />}
          onClose={(e) => { e.preventDefault(); detach(lesson); }}
        >
          {fmtLessonLabel(lesson)}
        </Tag>
      ))}
      {canEdit && (
        <Tooltip title="Прикрепить работу к уроку календаря">
          <Button size="small" icon={<CalendarOutlined />} onClick={openPicker}>
            Прикрепить к уроку
          </Button>
        </Tooltip>
      )}

      <Modal
        title="Прикрепить к уроку"
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        footer={[<Button key="close" onClick={() => setPickerOpen(false)}>Закрыть</Button>]}
        width={520}
      >
        {candidatesLoading && <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>}
        {!candidatesLoading && candidates.length === 0 && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет уроков в ближайшие 2 месяца (создайте урок в календаре)" />
        )}
        {!candidatesLoading && candidates.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
            {candidates.map(lesson => (
              <div
                key={lesson.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 10px', border: '1px solid #f0f0f0', borderRadius: 6, background: '#fafafa',
                }}
              >
                <span style={{ flex: 1, fontSize: 13 }}>{fmtLessonLabel(lesson)}</span>
                <Button size="small" type="primary" ghost loading={busyId === lesson.id} onClick={() => attach(lesson)}>
                  Прикрепить
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
