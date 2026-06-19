import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Segmented, Space, Spin, Typography } from 'antd';
import { TeamOutlined, CloseOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';

const { Text } = Typography;

// Статусы посещаемости. Порядок = порядок в Segmented.
export const ATT_STATUSES = [
  { value: 'present', label: 'Был', color: '#16a34a' },
  { value: 'late', label: 'Опоздал', color: '#d97706' },
  { value: 'excused', label: 'Уваж.', color: '#2563eb' },
  { value: 'absent', label: 'Нет', color: '#dc2626' },
];
const SEG_OPTIONS = ATT_STATUSES.map((s) => ({ value: s.value, label: s.label }));

// Ростер посещаемости урока. Ученики берутся из группы урока, состояние хранится
// в lesson_attendance по (урок, ученик). Создаётся лениво — только при отметке.
export default function AttendanceRoster({ lessonId, groupId, canEdit }) {
  const { message } = App.useApp();
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({}); // studentId -> status
  const [loading, setLoading] = useState(false);
  const [savingIds, setSavingIds] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    if (!lessonId || !groupId) { setStudents([]); setMarks({}); return undefined; }
    setLoading(true);
    Promise.all([api.getStudentsByGroup(groupId), api.getLessonAttendance(lessonId)])
      .then(([st, att]) => {
        if (cancelled) return;
        setStudents(st);
        const m = {};
        att.forEach((r) => { if (r.student && r.status) m[r.student] = r.status; });
        setMarks(m);
      })
      .catch(() => { if (!cancelled) message.error('Не удалось загрузить посещаемость'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lessonId, groupId, message]);

  const setOne = useCallback(async (studentId, status) => {
    const prev = marks[studentId];
    setMarks((m) => ({ ...m, [studentId]: status || undefined }));
    setSavingIds((s) => new Set(s).add(studentId));
    try {
      await api.setAttendance(lessonId, studentId, status || '');
    } catch {
      setMarks((m) => ({ ...m, [studentId]: prev })); // откат
      message.error('Не удалось сохранить отметку');
    } finally {
      setSavingIds((s) => { const n = new Set(s); n.delete(studentId); return n; });
    }
  }, [lessonId, marks, message]);

  const markAllPresent = useCallback(async () => {
    const targets = students.filter((s) => marks[s.id] !== 'present');
    if (!targets.length) return;
    setMarks((m) => { const n = { ...m }; targets.forEach((s) => { n[s.id] = 'present'; }); return n; });
    try {
      await Promise.all(targets.map((s) => api.setAttendance(lessonId, s.id, 'present')));
    } catch {
      message.error('Часть отметок не сохранилась');
    }
  }, [students, marks, lessonId, message]);

  const summary = useMemo(() => {
    let present = 0; let late = 0; let absent = 0; let excused = 0; let marked = 0;
    students.forEach((s) => {
      const st = marks[s.id];
      if (!st) return;
      marked += 1;
      if (st === 'present') present += 1;
      else if (st === 'late') late += 1;
      else if (st === 'absent') absent += 1;
      else if (st === 'excused') excused += 1;
    });
    return { present, late, absent, excused, marked, total: students.length };
  }, [students, marks]);

  if (!groupId) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        Укажите группу урока, чтобы отметить посещаемость.
      </Text>
    );
  }

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          <TeamOutlined /> Посещаемость
          {summary.total > 0 && (
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
              был {summary.present + summary.late} из {summary.total}
            </Text>
          )}
        </Text>
        {canEdit && students.length > 0 && (
          <Button size="small" type="text" onClick={markAllPresent}>Все были</Button>
        )}
      </Space>

      {loading ? (
        <div style={{ padding: '8px 0' }}><Spin size="small" /></div>
      ) : students.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>В группе нет учеников.</Text>
      ) : (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {students.map((s) => {
            const st = marks[s.id];
            return (
              <Space key={s.id} style={{ width: '100%', justifyContent: 'space-between' }} size={8}>
                <Text style={{ flex: 1, minWidth: 0 }} ellipsis>{s.name || s.username}</Text>
                <Space size={2}>
                  <Segmented
                    size="small"
                    disabled={!canEdit || savingIds.has(s.id)}
                    value={st || ''}
                    options={SEG_OPTIONS}
                    onChange={(v) => setOne(s.id, v)}
                  />
                  {canEdit && st && (
                    <Button
                      size="small" type="text" icon={<CloseOutlined />}
                      disabled={savingIds.has(s.id)}
                      onClick={() => setOne(s.id, '')}
                      title="Снять отметку"
                    />
                  )}
                </Space>
              </Space>
            );
          })}
        </Space>
      )}
    </div>
  );
}
