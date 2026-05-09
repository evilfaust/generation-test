import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Popconfirm,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { api } from '../shared/services/pocketbase';
import { normalizeLayout, safeParseLayout } from './GeometryTaskPreview';
import { ggbXmlToSvg } from '../utils/ggbToSvg';
import TabCondition from './geometry/TabCondition';
import TabDrawing from './geometry/TabDrawing';
import TabLayout from './geometry/TabLayout';
import TabSolution from './geometry/TabSolution';

const { Title } = Typography;

const isImageDrawing = (value = '') => value.startsWith('data:image/');

const getGeoGebraBase64 = (ggbApi) => new Promise((resolve) => {
  if (!ggbApi || typeof ggbApi.getBase64 !== 'function') {
    resolve('');
    return;
  }
  try {
    ggbApi.getBase64((value) => resolve(value || ''));
  } catch {
    resolve('');
  }
});

/**
 * Редактор геометрической задачи.
 *
 * Props:
 *   task       — объект задачи для редактирования (null = создание новой)
 *   onSaved    — callback после успешного сохранения
 *   onCancel   — callback для кнопки «Назад»
 *   totalTasks — общее кол-во задач (для генерации кода)
 */
export default function GeometryTaskEditor({ task, onSaved, onCancel, totalTasks = 0 }) {
  const [form] = Form.useForm();
  const isCreate = !task;

  // ── Состояние чертежа ─────────────────────────────────────────────────────
  const ggbApiRef = useRef(null);
  const legacyImage = task?.geogebra_image_base64 || task?.geogebra_base64 || '';
  const initialLegacyImage = isImageDrawing(legacyImage) ? legacyImage : '';
  const [ggbBase64, setGgbBase64] = useState(initialLegacyImage ? '' : (task?.geogebra_base64 || ''));
  const [ggbImageBase64, setGgbImageBase64] = useState(initialLegacyImage || '');
  const [ggbSaved, setGgbSaved] = useState(!!(task?.drawing_image || task?.geogebra_base64 || task?.geogebra_image_base64));
  const existingDrawingUrl = api.getGeometryImageUrl(task);
  const [savingDrawing, setSavingDrawing] = useState(false);
  const [appName, setAppName] = useState(task?.geogebra_appname || 'geometry');
  const [drawingView, setDrawingView] = useState(task?.drawing_view ?? 'image');
  const [drawingSvg, setDrawingSvg] = useState(task?.drawing_svg || '');
  const [convertingSvg, setConvertingSvg] = useState(false);
  const [savingSvg, setSavingSvg] = useState(false);

  // ── Состояние макета ─────────────────────────────────────────────────────
  const [layoutPrint, setLayoutPrint] = useState(() => {
    const persisted = safeParseLayout(task?.preview_layout)?.print ?? null;
    return normalizeLayout(persisted, 'print');
  });

  // ── Предпросмотры текстов ─────────────────────────────────────────────────
  const [previewStatement, setPreviewStatement] = useState(task?.statement_md || '');
  const [previewSolution, setPreviewSolution] = useState(task?.solution_md || '');

  // ── Состояние сохранения/удаления ─────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Темы и подтемы из справочника ────────────────────────────────────────
  const [geoTopics, setGeoTopics] = useState([]);
  const [geoSubtopics, setGeoSubtopics] = useState([]);
  const [selectedTopicId, setSelectedTopicId] = useState(task?.topic || null);

  useEffect(() => {
    Promise.all([api.getGeometryTopics(), api.getGeometrySubtopics()])
      .then(([topics, subtopics]) => {
        setGeoTopics(topics);
        setGeoSubtopics(subtopics);
      })
      .catch(() => {});
  }, []);

  // ── GeoGebra операции ───────────────────────────────────────────────────
  const handleSaveDrawing = useCallback(() => {
    if (!ggbApiRef.current) {
      message.warning('GeoGebra ещё не загружена');
      return;
    }
    setSavingDrawing(true);
    ggbApiRef.current.getBase64(async (base64) => {
      setGgbBase64(base64 || '');
      try {
        const pngBase64 = ggbApiRef.current.getPNGBase64(2, false, 300);
        if (pngBase64) {
          const imageData = pngBase64.startsWith('data:image/')
            ? pngBase64
            : `data:image/png;base64,${pngBase64}`;
          setGgbImageBase64(imageData);
        }
      } catch {
        // ignore
      }
      setGgbSaved(true);
      setSavingDrawing(false);
      message.success('Чертёж сохранён (GeoGebra + PNG)');
    });
  }, []);

  const handleClearDrawing = useCallback(() => {
    setGgbBase64('');
    setGgbImageBase64('');
    setGgbSaved(false);
    if (ggbApiRef.current) ggbApiRef.current.reset();
  }, []);

  const handleSaveDrawingAsImage = useCallback(() => {
    if (!ggbApiRef.current || typeof ggbApiRef.current.getPNGBase64 !== 'function') {
      message.warning('GeoGebra ещё не загружена');
      return;
    }
    setSavingDrawing(true);
    try {
      const pngBase64 = ggbApiRef.current.getPNGBase64(2, false, 300);
      if (!pngBase64) throw new Error('GeoGebra не вернула изображение');
      const imageData = pngBase64.startsWith('data:image/')
        ? pngBase64
        : `data:image/png;base64,${pngBase64}`;
      setGgbImageBase64(imageData);
      setGgbSaved(true);
      message.success('PNG обновлён');
    } catch (error) {
      message.error(`Не удалось сохранить PNG: ${error?.message || 'неизвестная ошибка'}`);
    } finally {
      setSavingDrawing(false);
    }
  }, []);

  const handleCropApplied = useCallback((croppedDataUrl) => {
    setGgbImageBase64(croppedDataUrl);
    setDrawingView('image');
    setGgbSaved(true);
  }, []);

  const handleConvertToSvg = useCallback(() => {
    if (!ggbApiRef.current) {
      message.warning('GeoGebra ещё не загружена');
      return;
    }
    setConvertingSvg(true);
    try {
      const xml = ggbApiRef.current.getXML();
      const svg = ggbXmlToSvg(xml);
      setDrawingSvg(svg);
      message.success('SVG сконвертирован — нажмите «Сохранить SVG» или сохраните задачу целиком');
    } catch (err) {
      message.error(`Ошибка конвертации SVG: ${err?.message || 'неизвестная ошибка'}`);
    } finally {
      setConvertingSvg(false);
    }
  }, []);

  const handleSaveSvg = useCallback(async () => {
    if (!drawingSvg || !task?.id) return;
    setSavingSvg(true);
    try {
      await api.updateGeometryTask(task.id, { drawing_svg: drawingSvg, drawing_view: 'svg' });
      setDrawingView('svg');
      message.success('SVG сохранён, режим отображения переключён на SVG');
    } catch (err) {
      console.error('SVG save error:', err);
      console.error('SVG save error data:', JSON.stringify(err?.data));
      const details = err?.data
        ? Object.entries(err.data).map(([k, v]) => `${k}: ${v?.message || JSON.stringify(v)}`).join('; ')
        : err?.message || 'неизвестная ошибка';
      message.error(`Ошибка сохранения SVG: ${details}`);
    } finally {
      setSavingSvg(false);
    }
  }, [drawingSvg, task?.id]);

  // ── Управление макетом ────────────────────────────────────────────────────
  const handleEditorLayoutChange = useCallback((layerName, patch) => {
    setLayoutPrint((prev) => normalizeLayout({
      ...prev,
      [layerName]: { ...prev[layerName], ...patch },
    }, 'print'));
  }, []);

  const handleEditorLayoutReset = useCallback(() => {
    setLayoutPrint(normalizeLayout(null, 'print'));
  }, []);

  // ── Генерация кода ────────────────────────────────────────────────────────
  const generateCode = () => {
    const n = String(totalTasks + 1).padStart(3, '0');
    return `GEO-${n}`;
  };

  // ── Сохранение задачи ─────────────────────────────────────────────────────
  const handleSave = async () => {
    let values;
    let payload = null;
    try {
      values = await form.validateFields();
    } catch {
      message.error('Заполните обязательные поля');
      return;
    }

    setSaving(true);
    try {
      const normalizedCode = (values.code || '').trim();
      if (!normalizedCode) {
        message.error('Укажите код задачи');
        return;
      }

      let drawingImageFile = null;
      if (ggbImageBase64) {
        try {
          const raw = ggbImageBase64.replace(/^data:image\/\w+;base64,/, '');
          const binary = atob(raw);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          drawingImageFile = new File([bytes], 'drawing.png', { type: 'image/png' });
        } catch {
          // при ошибке конвертации — не обновляем файл
        }
      }

      const liveGgbBase64 = await getGeoGebraBase64(ggbApiRef.current);
      const finalGgbBase64 = liveGgbBase64 || ggbBase64 || '';
      if (finalGgbBase64 !== ggbBase64) setGgbBase64(finalGgbBase64);

      payload = {
        code: normalizedCode,
        title: values.title || '',
        task_type: task?.task_type || '',
        topic: values.topic || null,
        subtopic: values.subtopic || null,
        difficulty: values.difficulty || null,
        statement_md: values.statement_md || '',
        answer: values.answer || '',
        solution_md: values.solution_md || '',
        geogebra_base64: finalGgbBase64,
        geogebra_appname: appName,
        drawing_view: drawingView,
        drawing_svg: drawingSvg || '',
        source: values.source || '',
        year: values.year || null,
        preview_layout: {
          ...(safeParseLayout(task?.preview_layout) || {}),
          print: layoutPrint,
        },
      };

      if (drawingImageFile) payload.geogebra_image_base64 = drawingImageFile;

      if (isCreate) {
        await api.createGeometryTask(payload);
      } else {
        await api.updateGeometryTask(task.id, payload);
      }

      message.success(isCreate ? 'Задача создана' : 'Задача сохранена');
      onSaved();
    } catch (error) {
      console.error('Save error details:', error?.data);
      console.dir(error?.data, { depth: 6 });
      console.error('Save payload was:', payload);
      const details = error?.data
        ? Object.entries(error.data)
            .map(([k, v]) => `${k}: ${v?.message || v?.code || JSON.stringify(v)}`)
            .join('; ')
        : error?.message || 'неизвестная ошибка';
      message.error(`Ошибка сохранения: ${details}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Удаление задачи ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteGeometryTask(task.id);
      message.success('Задача удалена');
      onSaved();
    } catch {
      message.error('Ошибка при удалении задачи');
    } finally {
      setDeleting(false);
    }
  };

  // ── Начальные значения формы ──────────────────────────────────────────────
  const initialValues = {
    code: task?.code || generateCode(),
    title: task?.title || '',
    topic: task?.topic || null,
    subtopic: task?.subtopic || null,
    difficulty: task?.difficulty || undefined,
    statement_md: task?.statement_md || '',
    answer: task?.answer || '',
    solution_md: task?.solution_md || '',
    source: task?.source || '',
    year: task?.year || undefined,
  };

  // ── Вкладки ───────────────────────────────────────────────────────────────
  const tabItems = [
    {
      key: 'condition',
      label: 'Условие',
      forceRender: true,
      children: <TabCondition
        form={form}
        initialValues={initialValues}
        previewStatement={previewStatement}
        onStatementChange={setPreviewStatement}
        geoTopics={geoTopics}
        geoSubtopics={geoSubtopics}
        selectedTopicId={selectedTopicId}
        onTopicChange={(id) => {
          setSelectedTopicId(id);
          form.setFieldValue('subtopic', null);
        }}
      />,
    },
    {
      key: 'drawing',
      forceRender: true,
      label: (
        <span>
          Чертёж{' '}
          {ggbSaved && <Tag color="blue" style={{ marginLeft: 4, fontSize: 11 }}>✓</Tag>}
        </span>
      ),
      children: <TabDrawing
        appName={appName}
        onAppNameChange={(v) => { setAppName(v); setGgbSaved(false); }}
        initialBase64={ggbBase64}
        imageBase64={ggbImageBase64 || existingDrawingUrl}
        onApiReady={(apiObj) => { ggbApiRef.current = apiObj; }}
        ggbSaved={ggbSaved}
        drawingView={drawingView}
        onDrawingViewChange={setDrawingView}
        savingDrawing={savingDrawing}
        onSaveDrawing={handleSaveDrawing}
        onSaveDrawingAsImage={handleSaveDrawingAsImage}
        onCropApplied={handleCropApplied}
        onClearDrawing={handleClearDrawing}
        drawingSvg={drawingSvg}
        convertingSvg={convertingSvg}
        savingSvg={savingSvg}
        onConvertToSvg={handleConvertToSvg}
        onSaveSvg={task?.id ? handleSaveSvg : null}
        onGetXml={() => ggbApiRef.current?.getXML?.() ?? ''}
        onSvgChange={setDrawingSvg}
      />,
    },
    {
      key: 'layout',
      forceRender: true,
      label: 'Макет',
      children: <TabLayout
        task={task}
        previewStatement={previewStatement}
        ggbImageBase64={ggbImageBase64}
        layout={layoutPrint}
        onLayoutChange={handleEditorLayoutChange}
        onReset={handleEditorLayoutReset}
      />,
    },
    {
      key: 'solution',
      forceRender: true,
      label: 'Решение',
      children: <TabSolution
        form={form}
        initialValues={initialValues}
        previewSolution={previewSolution}
        onSolutionChange={setPreviewSolution}
      />,
    },
  ];

  // ── Рендер ────────────────────────────────────────────────────────────────
  return (
    <Space direction="vertical" size={0} style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onCancel}>
            Назад к задачам
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {isCreate ? 'Новая геометрическая задача' : `Редактирование: ${task.code}`}
          </Title>
        </Space>

        <Space>
          {!isCreate && (
            <Popconfirm
              title="Удалить задачу?"
              description="Это действие необратимо."
              okText="Удалить"
              cancelText="Отмена"
              okButtonProps={{ danger: true }}
              onConfirm={handleDelete}
            >
              <Button danger icon={<DeleteOutlined />} loading={deleting}>
                Удалить
              </Button>
            </Popconfirm>
          )}
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            {isCreate ? 'Создать задачу' : 'Сохранить'}
          </Button>
        </Space>
      </div>

      {!isCreate && (
        <Alert
          type="info"
          showIcon
          message="Изменения будут применены немедленно. Чертёж нужно сохранить отдельно кнопкой «Сохранить чертёж»."
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} layout="vertical" initialValues={initialValues}>
        <Tabs items={tabItems} type="card" />
      </Form>
    </Space>
  );
}
