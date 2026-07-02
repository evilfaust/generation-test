import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal, Upload, Select, Input, Button, Table, Tag, Alert, Space, Spin,
  Typography, App,
} from 'antd';
import {
  CameraOutlined, CheckCircleFilled, CloseCircleFilled, MinusCircleOutlined,
  ThunderboltOutlined, SaveOutlined, RedoOutlined,
} from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { checkAnswer } from '../../utils/answerChecker';
import MathRenderer from '../MathRenderer';

const { Text } = Typography;

// Сжатие фото на клиенте: длинная сторона ≤ maxDim, JPEG. Сервер картинку
// не обрабатывает — что ушло, то и попадает в модель и в attempts.blank_photo.
async function compressImage(file, maxDim = 1600, quality = 0.82) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Fallback для старых браузеров
    bitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bitmap.width, h = bitmap.height;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const mime = head.match(/data:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Задачи варианта в том порядке, в котором их видит ученик (= порядок в КИМ).
function orderedTasks(variant) {
  let list = variant?.expand?.tasks || [];
  if (variant?.order && Array.isArray(variant.order)) {
    const orderMap = {};
    variant.order.forEach((taskId, idx) => { orderMap[taskId] = idx; });
    list = [...list].sort((a, b) =>
      (orderMap[a.id] ?? 999) - (orderMap[b.id] ?? 999));
  }
  return list;
}

const NEW_SESSION = '__new__';

/**
 * Проверка бумажных бланков ответов №1: фото → распознавание (pdf-service
 * /scan-blank, vision-LLM) → таблица верификации → запись как попытка
 * (attempts.source='scan'), неотличимая для статистики от ученической.
 */
const ScanBlankModal = ({ open, work, onClose, onRecorded }) => {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);

  const [variantId, setVariantId] = useState(null);
  const [sessionId, setSessionId] = useState(NEW_SESSION);
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState('');

  const [photo, setPhoto] = useState(null);       // dataURL сжатого фото
  const [scanning, setScanning] = useState(false);
  const [scanMeta, setScanMeta] = useState(null); // { replacements, uncertain }
  const [answers, setAnswers] = useState(null);   // { [номер]: строка } — после распознавания, редактируемые
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const variant = useMemo(
    () => variants.find(v => v.id === variantId) || null,
    [variants, variantId]
  );
  const tasks = useMemo(() => orderedTasks(variant), [variant]);

  // Справочники — при открытии
  useEffect(() => {
    if (!open || !work?.id) return;
    setLoading(true);
    Promise.all([
      api.getVariantsByWork(work.id),
      api.getSessionsByWork(work.id),
      api.getStudents(),
    ]).then(([vars, sess, studs]) => {
      setVariants(vars);
      setVariantId(vars[0]?.id || null);
      setSessions(sess);
      setSessionId(sess[0]?.id || NEW_SESSION);
      setStudents(studs.filter(s => s.name));
    }).catch(() => {
      message.error('Не удалось загрузить работу');
    }).finally(() => setLoading(false));
  }, [open, work?.id, message]);

  const resetScan = useCallback(() => {
    setPhoto(null);
    setAnswers(null);
    setScanMeta(null);
  }, []);

  const handleClose = () => {
    resetScan();
    setStudentId(null);
    setStudentName('');
    setSavedCount(0);
    onClose?.();
  };

  const handlePhoto = async (file) => {
    try {
      const dataUrl = await compressImage(file);
      setPhoto(dataUrl);
      setAnswers(null);
      setScanMeta(null);
    } catch {
      message.error('Не удалось прочитать изображение');
    }
    return false; // не грузить через Upload
  };

  const handleScan = async () => {
    if (!photo) return;
    setScanning(true);
    try {
      const res = await api.scanBlank({ imageBase64: photo, tasksCount: tasks.length });
      const next = {};
      tasks.forEach((t, i) => {
        const n = i + 1;
        next[n] = res.fields?.[n] ?? res.fields?.[String(n)] ?? '';
      });
      setAnswers(next);
      setScanMeta({
        replacements: res.replacements || [],
        uncertain: (res.uncertain || []).map(Number),
      });
    } catch (err) {
      message.error(err.message || 'Ошибка распознавания');
    }
    setScanning(false);
  };

  // Живой пересчёт правильности по мере правок учителя
  const rows = useMemo(() => {
    if (!answers) return [];
    return tasks.map((task, i) => {
      const n = i + 1;
      const raw = answers[n] || '';
      const { isCorrect, normalized } = raw
        ? checkAnswer(raw, task.answer)
        : { isCorrect: false, normalized: NaN };
      return {
        key: n, n, task, raw, isCorrect, normalized,
        empty: !raw,
        uncertain: scanMeta?.uncertain?.includes(n),
        replaced: scanMeta?.replacements?.some(r => Number(r.task) === n),
      };
    });
  }, [answers, tasks, scanMeta]);

  const score = rows.filter(r => r.isCorrect).length;

  const handleSave = async () => {
    if (!studentName.trim()) {
      message.warning('Укажите ученика или впишите ФИО');
      return;
    }
    setSaving(true);
    try {
      // 1. Сессия: существующая или новая «бумажная» выдача
      let sid = sessionId;
      if (sid === NEW_SESSION) {
        const created = await api.createSession({
          work: work.id,
          is_open: false,
          achievements_enabled: false,
          student_title: `${work.title || 'Работа'} (бумажные бланки)`,
        });
        sid = created.id;
        setSessions(prev => [created, ...prev]);
        setSessionId(created.id);
      }

      // 2. Попытка — как в ученическом флоу, но source='scan'
      const attempt = await api.createAttempt({
        session: sid,
        ...(studentId ? { student: studentId } : {}),
        student_name: studentName.trim(),
        device_id: 'paper-scan',
        variant: variantId,
        status: 'submitted',
        score,
        total: tasks.length,
        submitted_at: new Date().toISOString(),
        source: 'scan',
      });

      // 3. Ответы
      await api.batchCreateAttemptAnswers(rows.map(r => ({
        attempt: attempt.id,
        task: r.task.id,
        answer_raw: r.raw,
        answer_normalized: isNaN(r.normalized) ? 0 : r.normalized,
        is_correct: r.isCorrect,
      })));

      // 4. Фото бланка — для спорных случаев (не блокирует запись)
      try {
        const fd = new FormData();
        fd.append('blank_photo', dataUrlToBlob(photo), `blank_${attempt.id}.jpg`);
        await api.updateAttempt(attempt.id, fd);
      } catch (e) {
        console.warn('[scan-blank] фото не сохранилось:', e?.message);
      }

      message.success(`${studentName.trim()}: ${score} из ${tasks.length} — записано`);
      setSavedCount(c => c + 1);
      // Готов к следующему бланку: та же работа/вариант/сессия
      resetScan();
      setStudentId(null);
      setStudentName('');
      onRecorded?.();
    } catch (err) {
      console.error('Error saving scanned attempt:', err);
      message.error('Не удалось записать результат: ' + (err?.message || ''));
    }
    setSaving(false);
  };

  const columns = [
    { title: '№', dataIndex: 'n', width: 46, align: 'center' },
    {
      title: 'Распознано (можно править)',
      dataIndex: 'raw',
      render: (_, r) => (
        <Input
          size="small"
          value={r.raw}
          status={r.uncertain && !r.isCorrect ? 'warning' : undefined}
          onChange={e => setAnswers(prev => ({ ...prev, [r.n]: e.target.value }))}
          style={{ maxWidth: 140, fontFamily: 'monospace' }}
        />
      ),
    },
    {
      title: 'Эталон',
      width: 160,
      render: (_, r) => <MathRenderer text={r.task.answer || '—'} />,
    },
    {
      title: '',
      width: 90,
      align: 'center',
      render: (_, r) => (
        <Space size={4}>
          {r.empty
            ? <MinusCircleOutlined style={{ color: 'var(--ink-4, #999)' }} />
            : r.isCorrect
              ? <CheckCircleFilled style={{ color: '#52c41a' }} />
              : <CloseCircleFilled style={{ color: '#ff4d4f' }} />}
          {r.replaced && <Tag color="blue" style={{ margin: 0 }}>замена</Tag>}
          {r.uncertain && <Tag color="orange" style={{ margin: 0 }}>?</Tag>}
        </Space>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={<span><CameraOutlined /> Проверка бланков — {work?.title || 'работа'}</span>}
      width={780}
      footer={null}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : !variants.length ? (
        <Alert type="warning" message="В работе нет вариантов" />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {savedCount > 0 && (
            <Alert type="success" showIcon message={`Записано бланков: ${savedCount}. Можно сканировать следующий.`} />
          )}

          {/* Шаг 1: кто и что */}
          <Space wrap>
            <Select
              style={{ minWidth: 150 }}
              value={variantId}
              onChange={v => { setVariantId(v); resetScan(); }}
              options={variants.map((v, i) => ({
                value: v.id,
                label: `Вариант ${v.number || i + 1} (${(v.expand?.tasks || []).length} зад.)`,
              }))}
            />
            <Select
              style={{ minWidth: 230 }}
              showSearch
              allowClear
              placeholder="Ученик из списка"
              optionFilterProp="label"
              value={studentId}
              onChange={(id) => {
                setStudentId(id || null);
                const s = students.find(x => x.id === id);
                if (s) setStudentName(s.name);
              }}
              options={students.map(s => ({
                value: s.id,
                label: s.student_class ? `${s.name} (${s.student_class})` : s.name,
              }))}
            />
            <Input
              style={{ width: 200 }}
              placeholder="или впишите ФИО"
              value={studentName}
              onChange={e => setStudentName(e.target.value)}
            />
            <Select
              style={{ minWidth: 210 }}
              value={sessionId}
              onChange={setSessionId}
              options={[
                ...sessions.map((s, i) => ({
                  value: s.id,
                  label: `Выдача ${sessions.length - i} — ${new Date(s.created).toLocaleDateString('ru-RU')}`,
                })),
                { value: NEW_SESSION, label: '➕ Новая выдача (бумага)' },
              ]}
            />
          </Space>

          {/* Шаг 2: фото */}
          {!photo ? (
            <Upload.Dragger
              accept="image/*"
              showUploadList={false}
              beforeUpload={handlePhoto}
            >
              <p style={{ fontSize: 32, margin: 0 }}><CameraOutlined /></p>
              <p>Сфотографируйте или перетащите фото заполненного бланка ответов №1</p>
              <p style={{ color: 'var(--ink-3, #888)', fontSize: 12 }}>
                Бланк целиком, при хорошем свете, без сильного наклона
              </p>
            </Upload.Dragger>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <img
                src={photo}
                alt="бланк"
                style={{ width: 180, borderRadius: 8, border: '1px solid var(--line-2, #eee)' }}
              />
              <Space direction="vertical">
                {!answers && (
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    loading={scanning}
                    onClick={handleScan}
                  >
                    {scanning ? 'Распознаю…' : 'Распознать ответы'}
                  </Button>
                )}
                <Button icon={<RedoOutlined />} onClick={resetScan} disabled={scanning}>
                  Другое фото
                </Button>
                {scanning && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Обычно 5–10 секунд
                  </Text>
                )}
              </Space>
            </div>
          )}

          {/* Шаг 3: верификация */}
          {answers && (
            <>
              {scanMeta?.uncertain?.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  message={`Модель не уверена в полях: ${scanMeta.uncertain.join(', ')} — проверьте их по фото`}
                />
              )}
              <Table
                size="small"
                pagination={false}
                columns={columns}
                dataSource={rows}
                rowClassName={r => (r.uncertain ? 'ant-table-row-warning' : '')}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>
                  Результат: {score} из {tasks.length}
                </Text>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={handleSave}
                >
                  Записать результат
                </Button>
              </div>
            </>
          )}
        </Space>
      )}
    </Modal>
  );
};

export default ScanBlankModal;
