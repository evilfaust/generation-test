import { useMemo, useState, useEffect } from 'react';
import { Modal, InputNumber, Switch, Space, Typography, Tag, Checkbox } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

const { Text } = Typography;

// Пн-первый порядок; d = dayjs.day() (0=Вс..6=Сб).
const WEEKDAYS = [
  { d: 1, label: 'Пн' }, { d: 2, label: 'Вт' }, { d: 3, label: 'Ср' },
  { d: 4, label: 'Чт' }, { d: 5, label: 'Пт' }, { d: 6, label: 'Сб' }, { d: 0, label: 'Вс' },
];

// Определяем «числовой хвост» темы для автонумерации: «Занятие 1» → префикс/номер.
function parseTitleNumber(title) {
  const m = (title || '').match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10), suffix: m[3] };
}

// Планирование серии занятий: повторяем базовый урок по выбранным дням недели.
// Ученикам курса вся серия сразу видна в расписании (витрина создаётся для каждого).
export default function RepeatLessonModal({ open, base, groups = [], saving, onConfirm, onCancel }) {
  const baseDay = base?.date_plan ? dayjs(base.date_plan) : dayjs();
  const titleNum = parseTitleNumber(base?.title);

  const [weekdays, setWeekdays] = useState([]);
  const [count, setCount] = useState(9);
  const [numbering, setNumbering] = useState(true);
  const [copyMaterials, setCopyMaterials] = useState(false);

  useEffect(() => {
    if (open) {
      setWeekdays([baseDay.day()]);
      setCount(9);
      setNumbering(!!titleNum);
      setCopyMaterials(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, base?.id]);

  const groupName = useMemo(
    () => groups.find((g) => g.id === base?.group)?.name || '',
    [groups, base],
  );

  // Вычисляем даты серии: после базовой, по выбранным дням недели, еженедельно.
  const occurrences = useMemo(() => {
    if (!weekdays.length || !count) return [];
    const h = baseDay.hour(); const m = baseDay.minute();
    const out = [];
    let cursor = baseDay.add(1, 'day');
    let guard = 0;
    while (out.length < count && guard < 1500) {
      if (weekdays.includes(cursor.day())) {
        out.push(cursor.hour(h).minute(m).second(0).millisecond(0));
      }
      cursor = cursor.add(1, 'day');
      guard += 1;
    }
    return out;
  }, [weekdays, count, baseDay]);

  const titleFor = (k) => {
    if (numbering && titleNum) return `${titleNum.prefix}${titleNum.num + k}${titleNum.suffix}`;
    return base?.title || 'Занятие';
  };

  const toggleWeekday = (d) => {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const handleOk = () => {
    const payloads = occurrences.map((d, i) => ({
      title: titleFor(i + 1),
      group: base?.group || '',
      date_plan: d.toISOString(),
      status: 'planned',
      time_slot: base?.time_slot || '',
      conference_url: base?.conference_url || '',
      materials: copyMaterials ? (Array.isArray(base?.materials) ? base.materials : []) : [],
    }));
    onConfirm(payloads);
  };

  return (
    <Modal
      open={open}
      title={<><CalendarOutlined /> Повторить занятие серией</>}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={saving}
      okText={occurrences.length ? `Создать ${occurrences.length} занятий` : 'Создать'}
      okButtonProps={{ disabled: !occurrences.length }}
      cancelText="Отмена"
      width={520}
      destroyOnHidden
    >
      <div style={{ marginTop: 8 }}>
        <Text type="secondary">
          Базовое занятие: <b>{base?.title}</b>{groupName ? ` · ${groupName}` : ''} ·{' '}
          {baseDay.locale('ru').format('dd, D MMM HH:mm')}
        </Text>

        <div style={{ marginTop: 16 }}>
          <Text strong>Дни недели</Text>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {WEEKDAYS.map((w) => {
              const on = weekdays.includes(w.d);
              return (
                <button
                  key={w.d}
                  type="button"
                  onClick={() => toggleWeekday(w.d)}
                  style={{
                    width: 44, height: 36, borderRadius: 8, cursor: 'pointer',
                    border: on ? '1px solid #722ed1' : '1px solid #d9d9d9',
                    background: on ? 'rgba(114,46,209,0.10)' : '#fff',
                    color: on ? '#722ed1' : '#555', fontWeight: on ? 600 : 400,
                  }}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </div>

        <Space size="large" style={{ marginTop: 16, width: '100%', flexWrap: 'wrap' }}>
          <div>
            <Text strong>Сколько ещё занятий</Text>
            <div style={{ marginTop: 6 }}>
              <InputNumber min={1} max={60} value={count} onChange={(v) => setCount(v || 1)} style={{ width: 120 }} />
            </div>
          </div>
          <div>
            <Space direction="vertical" size={6} style={{ marginTop: 4 }}>
              <Space>
                <Switch size="small" checked={numbering} onChange={setNumbering} disabled={!titleNum} />
                <Text>Нумеровать занятия{titleNum ? '' : ' (нет числа в теме)'}</Text>
              </Space>
              <Checkbox checked={copyMaterials} onChange={(e) => setCopyMaterials(e.target.checked)}>
                Копировать материалы базового занятия
              </Checkbox>
            </Space>
          </div>
        </Space>

        <div style={{ marginTop: 16 }}>
          <Text strong>Будет создано: {occurrences.length}</Text>
          {occurrences.length > 0 && (
            <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 8 }}>
              {occurrences.map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px', fontSize: 13 }}>
                  <span>{d.locale('ru').format('dd, D MMM YYYY · HH:mm')}</span>
                  <Tag style={{ margin: 0 }}>{titleFor(i + 1)}</Tag>
                </div>
              ))}
            </div>
          )}
          {!occurrences.length && <div><Text type="secondary">Выберите хотя бы один день недели.</Text></div>}
        </div>
      </div>
    </Modal>
  );
}
