import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal, Form, Input, Select, Switch, Tabs, Button, Space, Upload, message,
  Divider, Typography, Alert,
} from 'antd';
import {
  UploadOutlined, DeleteOutlined, ScissorOutlined,
  CameraOutlined, DownloadOutlined,
} from '@ant-design/icons';
import CropModal from '../shared/CropModal';
import { api } from '../../services/pocketbase';
import MathRenderer from '../../shared/components/MathRenderer';
import GeoGebraApplet from '../GeoGebraApplet';
import { dataUrlToFile } from '../../utils/cropImage';

const { Text } = Typography;
const { TextArea } = Input;

const TYPE_OPTIONS = [
  { value: 'theorem',          label: 'Теорема' },
  { value: 'definition',       label: 'Определение' },
  { value: 'formula',          label: 'Формула' },
  { value: 'axiom',            label: 'Аксиома' },
  { value: 'property',         label: 'Свойство' },
  { value: 'criterion',        label: 'Признак' },
  { value: 'corollary',        label: 'Следствие' },
  { value: 'geometry_formula', label: 'Геом. формула' },
];

async function remoteToDataUrl(url) {
  const blob = await fetch(url).then(r => r.blob());
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(blob);
  });
}

// Оборачивает GeoGebra getBase64(callback) в Promise
function getGgbBase64(api) {
  return new Promise(resolve => api.getBase64(resolve));
}

export default function TDFItemModal({ open, item, setId, onClose, onSaved, nextOrder }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [isSectionHeader, setIsSectionHeader] = useState(false);
  const [itemType, setItemType] = useState(null);

  // Prep drawing
  const [drawingDataUrl, setDrawingDataUrl] = useState(null);
  const [drawingFile, setDrawingFile]       = useState(null);
  const [cropPrepOpen, setCropPrepOpen]     = useState(false);
  const ggbApiPrepRef = useRef(null);
  const [savingPrepPng, setSavingPrepPng]   = useState(false);

  // Control drawing
  const [ctrlDataUrl, setCtrlDataUrl]       = useState(null);
  const [ctrlFile, setCtrlFile]             = useState(null);
  const [cropCtrlOpen, setCropCtrlOpen]     = useState(false);
  const ggbApiCtrlRef = useRef(null);
  const [savingCtrlPng, setSavingCtrlPng]   = useState(false);
  const [loadingEtalon, setLoadingEtalon]   = useState(false);

  // GeoGebra initial state (только для монтирования)
  const [prepInitialBase64, setPrepInitialBase64] = useState('');
  const [ctrlInitialBase64, setCtrlInitialBase64] = useState('');

  // Preview
  const [formulationPreview, setFormulationPreview] = useState('');
  const [notationPreview, setNotationPreview]       = useState('');

  const [activeTab, setActiveTab] = useState('fields');
  const [drawingSubTab, setDrawingSubTab] = useState('prep');

  // onApiReady — стабильные колбэки для GeoGebraApplet (не пересоздаются)
  const onPrepApiReady = useCallback((a) => { ggbApiPrepRef.current = a; }, []);
  const onCtrlApiReady = useCallback((a) => { ggbApiCtrlRef.current = a; }, []);

  // Высота апплета — максимум доступного пространства модалки.
  // Фиксируется при монтировании, GeoGebra не reflowит при resize.
  const [appletHeight] = useState(() => {
    if (typeof window === 'undefined') return 520;
    return Math.max(440, window.innerHeight - 360);
  });

  const isEdit = !!item;
  const isGeoFormula = itemType === 'geometry_formula';

  useEffect(() => {
    if (!open) return;

    if (item) {
      const isHeader = !!item.is_section_header;
      const type = item.type || undefined;
      setIsSectionHeader(isHeader);
      setItemType(type);
      form.setFieldsValue({
        is_section_header:      isHeader,
        section_title:          item.section_title || '',
        type,
        name:                   item.name || '',
        formulation_md:         item.formulation_md || '',
        short_notation_md:      item.short_notation_md || '',
        formula_control_hidden: item.formula_control_hidden ?? true,
      });
      setFormulationPreview(item.formulation_md || '');
      setNotationPreview(item.short_notation_md || '');

      // GeoGebra initial state для апплетов
      setPrepInitialBase64(item.geogebra_base64 || '');
      setCtrlInitialBase64(item.geogebra_base64_control || '');

      // Prep PNG
      if (item.drawing_image) {
        remoteToDataUrl(api.getTdfItemDrawingUrl(item))
          .then(dataUrl => { setDrawingDataUrl(dataUrl); })
          .catch(() => setDrawingDataUrl(api.getTdfItemDrawingUrl(item)));
      } else {
        setDrawingDataUrl(null);
      }

      // Control PNG
      if (item.drawing_image_control) {
        remoteToDataUrl(api.getTdfItemControlDrawingUrl(item))
          .then(dataUrl => { setCtrlDataUrl(dataUrl); })
          .catch(() => setCtrlDataUrl(api.getTdfItemControlDrawingUrl(item)));
      } else {
        setCtrlDataUrl(null);
      }
    } else {
      setIsSectionHeader(false);
      setItemType(null);
      form.resetFields();
      form.setFieldValue('formula_control_hidden', true);
      setFormulationPreview('');
      setNotationPreview('');
      setDrawingDataUrl(null); setDrawingFile(null);
      setCtrlDataUrl(null);   setCtrlFile(null);
      setPrepInitialBase64('');
      setCtrlInitialBase64('');
    }
    setActiveTab('fields');
    setDrawingSubTab('prep');
  }, [open, item]);

  // ── Prep handlers ─────────────────────────────────────────────────────────
  const handleSavePrepPng = useCallback(async () => {
    const api = ggbApiPrepRef.current;
    if (!api?.getPNGBase64) { message.warning('GeoGebra ещё не загружена'); return; }
    setSavingPrepPng(true);
    try {
      const raw = api.getPNGBase64(2, false, 300);
      if (!raw) { message.warning('Нарисуйте что-нибудь в GeoGebra'); return; }
      const dataUrl = raw.startsWith('data:image/') ? raw : `data:image/png;base64,${raw}`;
      setDrawingDataUrl(dataUrl);
      setDrawingFile(await dataUrlToFile(dataUrl, 'drawing.png'));
      message.success('PNG подготовки сохранён');
    } catch { message.error('Ошибка экспорта PNG'); }
    finally { setSavingPrepPng(false); }
  }, []);

  const handleUploadPrep = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => { setDrawingDataUrl(e.target.result); setDrawingFile(file); };
    reader.readAsDataURL(file);
    return false;
  };
  const handleCroppedPrep = async (url) => {
    setDrawingDataUrl(url);
    setDrawingFile(await dataUrlToFile(url, 'drawing.png'));
    setCropPrepOpen(false);
  };

  // ── Control handlers ──────────────────────────────────────────────────────
  const handleLoadEtalon = useCallback(() => {
    const prepApi = ggbApiPrepRef.current;
    const ctrlApi = ggbApiCtrlRef.current;
    if (!prepApi?.getBase64) { message.warning('Сначала откройте вкладку Подготовка и дождитесь загрузки GeoGebra'); return; }
    if (!ctrlApi?.setBase64) { message.warning('GeoGebra на вкладке Контроль ещё не загружена'); return; }
    setLoadingEtalon(true);
    prepApi.getBase64((b64) => {
      if (!b64) { message.warning('Эталонный чертёж пуст — нарисуйте что-нибудь на вкладке Подготовка'); setLoadingEtalon(false); return; }
      ctrlApi.setBase64(b64);
      setLoadingEtalon(false);
      message.success('Эталонный чертёж загружен в GeoGebra контроля');
    });
  }, []);

  const handleSaveCtrlPng = useCallback(async () => {
    const api = ggbApiCtrlRef.current;
    if (!api?.getPNGBase64) { message.warning('GeoGebra ещё не загружена'); return; }
    setSavingCtrlPng(true);
    try {
      const raw = api.getPNGBase64(2, false, 300);
      if (!raw) { message.warning('Нарисуйте что-нибудь в GeoGebra'); return; }
      const dataUrl = raw.startsWith('data:image/') ? raw : `data:image/png;base64,${raw}`;
      setCtrlDataUrl(dataUrl);
      setCtrlFile(await dataUrlToFile(dataUrl, 'drawing_control.png'));
      message.success('PNG контроля сохранён');
    } catch { message.error('Ошибка экспорта PNG'); }
    finally { setSavingCtrlPng(false); }
  }, []);

  const handleUploadCtrl = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => { setCtrlDataUrl(e.target.result); setCtrlFile(file); };
    reader.readAsDataURL(file);
    return false;
  };
  const handleCroppedCtrl = async (url) => {
    setCtrlDataUrl(url);
    setCtrlFile(await dataUrlToFile(url, 'drawing_control.png'));
    setCropCtrlOpen(false);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const formData = new FormData();
      const fields = {
        tdf_set:           setId,
        is_section_header: !!values.is_section_header,
        order:             item?.order ?? nextOrder,
      };

      if (values.is_section_header) {
        fields.section_title = values.section_title || '';
      } else {
        fields.type              = values.type || '';
        fields.name              = values.name || '';
        fields.formulation_md    = values.formulation_md || '';
        fields.short_notation_md = values.short_notation_md || '';
        if (values.type === 'geometry_formula') {
          fields.formula_control_hidden = !!values.formula_control_hidden;
        }
      }

      Object.entries(fields).forEach(([k, v]) => formData.append(k, v));

      // Prep PNG
      if (drawingFile) {
        formData.append('drawing_image', drawingFile);
      } else if (!drawingDataUrl && item?.drawing_image) {
        formData.append('drawing_image', '');
      }

      // GeoGebra XML — сохраняем для обоих чертежей, чтобы их можно было
      // открыть и продолжить редактировать
      if (values.type === 'geometry_formula') {
        if (ggbApiPrepRef.current?.getBase64) {
          const b64 = await getGgbBase64(ggbApiPrepRef.current);
          if (b64) formData.append('geogebra_base64', b64);
        }
        if (ggbApiCtrlRef.current?.getBase64) {
          const b64 = await getGgbBase64(ggbApiCtrlRef.current);
          if (b64) formData.append('geogebra_base64_control', b64);
        }

        // Control PNG
        if (ctrlFile) {
          formData.append('drawing_image_control', ctrlFile);
        } else if (!ctrlDataUrl && item?.drawing_image_control) {
          formData.append('drawing_image_control', '');
        }
      }

      const saved = isEdit
        ? await api.updateTdfItem(item.id, formData)
        : await api.createTdfItem(formData);

      message.success(isEdit ? 'Пункт обновлён' : 'Пункт добавлен');
      onSaved(saved, !isEdit);
    } catch (err) {
      if (err?.errorFields) return;
      console.error('[TDFItemModal] save error:', err);
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  // ── Geometry formula drawing panel ────────────────────────────────────────
  const renderGeometryFormulaDrawing = () => {
    const prepSubTab = (
      <div>
        {/* PNG preview */}
        {drawingDataUrl && (
          <div style={{ marginBottom: 12, padding: 8, background: '#fafafa', borderRadius: 6, textAlign: 'center' }}>
            <img src={drawingDataUrl} alt="подготовка"
              style={{ maxWidth: '100%', maxHeight: 70, objectFit: 'contain' }} />
            <div style={{ marginTop: 8 }}>
              <Space size="small">
                <Button size="small" icon={<ScissorOutlined />} onClick={() => setCropPrepOpen(true)}>Кадрировать</Button>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => { setDrawingDataUrl(null); setDrawingFile(null); }}>
                  Удалить PNG
                </Button>
              </Space>
            </div>
          </div>
        )}

        {/* GeoGebra */}
        <GeoGebraApplet
          appName="geometry"
          readOnly={false}
          initialBase64={prepInitialBase64}
          onApiReady={onPrepApiReady}
          height={appletHeight}
        />

        <div style={{ marginTop: 10 }}>
          <Space wrap>
            <Button type="primary" icon={<CameraOutlined />} onClick={handleSavePrepPng} loading={savingPrepPng}>
              Сохранить PNG
            </Button>
            <Divider type="vertical" />
            <Upload accept="image/png,image/jpeg,image/webp" beforeUpload={handleUploadPrep} showUploadList={false}>
              <Button icon={<UploadOutlined />}>Загрузить PNG вручную</Button>
            </Upload>
          </Space>
        </div>

        <CropModal open={cropPrepOpen} onCancel={() => setCropPrepOpen(false)}
          onCropped={handleCroppedPrep} imageUrl={drawingDataUrl}
          title="Кадрирование (подготовка)" emptyMessage="Нет изображения" messageApi={message} />
      </div>
    );

    const ctrlSubTab = (
      <div>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Workflow контрольного чертежа"
          description={
            <>
              1. Нажмите <b>«Загрузить эталонный чертёж»</b> — копия из GeoGebra подготовки появится здесь.<br />
              2. Удалите нужные элементы (подписи, числа, буквы).<br />
              3. Нажмите <b>«Сохранить PNG»</b> — контрольный чертёж готов.
            </>
          }
        />

        <Button
          type="default"
          icon={<DownloadOutlined />}
          onClick={handleLoadEtalon}
          loading={loadingEtalon}
          style={{ marginBottom: 12 }}
        >
          Загрузить эталонный чертёж
        </Button>

        {/* PNG preview */}
        {ctrlDataUrl && (
          <div style={{ marginBottom: 12, padding: 8, background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 6, textAlign: 'center' }}>
            <img src={ctrlDataUrl} alt="контроль"
              style={{ maxWidth: '100%', maxHeight: 70, objectFit: 'contain' }} />
            <div style={{ marginTop: 8 }}>
              <Space size="small">
                <Button size="small" icon={<ScissorOutlined />} onClick={() => setCropCtrlOpen(true)}>Кадрировать</Button>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => { setCtrlDataUrl(null); setCtrlFile(null); }}>
                  Удалить PNG
                </Button>
              </Space>
            </div>
          </div>
        )}

        {/* GeoGebra */}
        <GeoGebraApplet
          appName="geometry"
          readOnly={false}
          initialBase64={ctrlInitialBase64}
          onApiReady={onCtrlApiReady}
          height={appletHeight}
        />

        <div style={{ marginTop: 10 }}>
          <Space wrap>
            <Button type="primary" icon={<CameraOutlined />} onClick={handleSaveCtrlPng} loading={savingCtrlPng}>
              Сохранить PNG
            </Button>
            <Divider type="vertical" />
            <Upload accept="image/png,image/jpeg,image/webp" beforeUpload={handleUploadCtrl} showUploadList={false}>
              <Button icon={<UploadOutlined />}>Загрузить PNG вручную</Button>
            </Upload>
          </Space>
        </div>

        <CropModal open={cropCtrlOpen} onCancel={() => setCropCtrlOpen(false)}
          onCropped={handleCroppedCtrl} imageUrl={ctrlDataUrl}
          title="Кадрирование (контроль)" emptyMessage="Нет изображения" messageApi={message} />
      </div>
    );

    return (
      <Tabs
        type="card"
        activeKey={drawingSubTab}
        onChange={setDrawingSubTab}
        destroyInactiveTabPane={false}
        items={[
          {
            key: 'prep',
            label: '🟢 Подготовка (полный чертёж)',
            forceRender: true,
            children: prepSubTab,
          },
          {
            key: 'ctrl',
            label: '🔴 Контроль (частичный чертёж)',
            forceRender: true,
            children: ctrlSubTab,
          },
        ]}
      />
    );
  };

  // ── Standard single drawing panel ─────────────────────────────────────────
  const renderSingleDrawingPanel = () => (
    <div>
      {drawingDataUrl && (
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <img src={drawingDataUrl} alt="чертёж"
            style={{ maxWidth: '100%', maxHeight: 80, border: '1px solid #f0f0f0', borderRadius: 4 }} />
          <div style={{ marginTop: 8 }}>
            <Space>
              <Button icon={<ScissorOutlined />} onClick={() => setCropPrepOpen(true)}>Кадрировать</Button>
              <Button danger icon={<DeleteOutlined />} onClick={() => { setDrawingDataUrl(null); setDrawingFile(null); }}>
                Удалить чертёж
              </Button>
            </Space>
          </div>
        </div>
      )}
      <Divider orientation="left">Загрузить изображение</Divider>
      <Upload accept="image/png,image/jpeg,image/webp" beforeUpload={handleUploadPrep} showUploadList={false}>
        <Button icon={<UploadOutlined />}>Выбрать файл (PNG/JPG)</Button>
      </Upload>
      <Divider orientation="left">Нарисовать в GeoGebra</Divider>
      <GeoGebraApplet
        appName="geometry"
        readOnly={false}
        initialBase64={prepInitialBase64}
        onApiReady={onPrepApiReady}
        height={appletHeight}
      />
      {ggbApiPrepRef.current && (
        <div style={{ marginTop: 8 }}>
          <Button icon={<CameraOutlined />} onClick={handleSavePrepPng} loading={savingPrepPng} type="primary">
            Сохранить PNG из GeoGebra
          </Button>
        </div>
      )}
      <CropModal open={cropPrepOpen} onCancel={() => setCropPrepOpen(false)}
        onCropped={handleCroppedPrep} imageUrl={drawingDataUrl}
        title="Кадрирование чертежа" emptyMessage="Нет изображения" messageApi={message} />
    </div>
  );

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabItems = [
    {
      key: 'fields',
      label: 'Поля',
      children: (
        <>
          <Form.Item name="is_section_header" valuePropName="checked" label="Тип строки">
            <Switch
              checked={isSectionHeader}
              onChange={setIsSectionHeader}
              checkedChildren="Заголовок раздела"
              unCheckedChildren="Пункт ТДФ"
            />
          </Form.Item>

          {isSectionHeader ? (
            <Form.Item name="section_title" label="Название раздела"
              rules={[{ required: true, message: 'Введите название' }]}>
              <Input placeholder="Например: Признаки параллельности двух прямых" />
            </Form.Item>
          ) : (
            <>
              <Form.Item name="type" label="Тип">
                <Select options={TYPE_OPTIONS} placeholder="Выберите тип" allowClear
                  onChange={val => setItemType(val)} />
              </Form.Item>
              <Form.Item name="name" label={isGeoFormula ? 'Название формулы' : 'Название / тема'}>
                <Input placeholder={isGeoFormula ? 'Например: Площадь трапеции' : 'Например: Признак 1 (накрест лежащие углы)'} />
              </Form.Item>
              {isGeoFormula ? (
                <>
                  <Form.Item name="short_notation_md" label="Формула (LaTeX)">
                    <TextArea rows={2} placeholder="Например: $S = \dfrac{(a+b)}{2} \cdot h$"
                      onChange={e => setNotationPreview(e.target.value)} />
                  </Form.Item>
                  <Form.Item name="formula_control_hidden" valuePropName="checked" label="Скрывать формулу в контроле">
                    <Switch checkedChildren="Скрыта" unCheckedChildren="Видна" />
                  </Form.Item>
                </>
              ) : (
                <>
                  <Form.Item name="formulation_md" label="Формулировка">
                    <TextArea rows={6}
                      placeholder="Полная формулировка теоремы/определения. Поддерживается LaTeX: $x^2$"
                      onChange={e => setFormulationPreview(e.target.value)} />
                  </Form.Item>
                  <Form.Item name="short_notation_md" label="Краткая запись">
                    <TextArea rows={2}
                      placeholder="Символьная запись. Например: $\angle 1 = \angle 2 \Rightarrow a \parallel b$"
                      onChange={e => setNotationPreview(e.target.value)} />
                  </Form.Item>
                </>
              )}
            </>
          )}
        </>
      ),
    },
    {
      key: 'drawing',
      label: isGeoFormula ? 'Чертежи' : 'Чертёж',
      disabled: isSectionHeader,
      forceRender: true,
      children: isGeoFormula ? renderGeometryFormulaDrawing() : renderSingleDrawingPanel(),
    },
    {
      key: 'preview',
      label: 'Предпросмотр',
      disabled: isSectionHeader,
      children: (
        <div style={{ overflowX: 'auto' }}>
          {isGeoFormula ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Подготовка (полный чертёж)', 'Формула', 'Контроль (частичный)'].map(h => (
                    <th key={h} style={{ border: '1px solid #d9d9d9', padding: '6px 10px', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #d9d9d9', padding: '8px 10px', textAlign: 'center' }}>
                    {drawingDataUrl
                      ? <img src={drawingDataUrl} alt="подготовка" style={{ maxWidth: 160, maxHeight: 120, objectFit: 'contain' }} />
                      : <Text type="secondary">—</Text>}
                  </td>
                  <td style={{ border: '1px solid #d9d9d9', padding: '8px 10px', verticalAlign: 'top' }}>
                    <MathRenderer content={notationPreview} />
                  </td>
                  <td style={{ border: '1px solid #d9d9d9', padding: '8px 10px', textAlign: 'center' }}>
                    {ctrlDataUrl
                      ? <img src={ctrlDataUrl} alt="контроль" style={{ maxWidth: 160, maxHeight: 120, objectFit: 'contain' }} />
                      : <Text type="secondary">—</Text>}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Формулировка', 'Чертёж', 'Краткая запись'].map(h => (
                    <th key={h} style={{ border: '1px solid #d9d9d9', padding: '6px 10px', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #d9d9d9', padding: '8px 10px', verticalAlign: 'top' }}>
                    <MathRenderer content={formulationPreview} />
                  </td>
                  <td style={{ border: '1px solid #d9d9d9', padding: '8px 10px', verticalAlign: 'top', textAlign: 'center' }}>
                    {drawingDataUrl
                      ? <img src={drawingDataUrl} alt="чертёж" style={{ maxWidth: 160, maxHeight: 120, objectFit: 'contain' }} />
                      : <Text type="secondary">—</Text>}
                  </td>
                  <td style={{ border: '1px solid #d9d9d9', padding: '8px 10px', verticalAlign: 'top' }}>
                    <MathRenderer content={notationPreview} />
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      ),
    },
  ];

  return (
    <Modal
      title={isEdit
        ? (isSectionHeader ? 'Редактировать раздел' : 'Редактировать пункт ТДФ')
        : (isSectionHeader ? 'Новый раздел' : 'Новый пункт ТДФ')}
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      okText="Сохранить"
      cancelText="Отмена"
      width="98vw"
      style={{ top: 8, maxWidth: 1600 }}
      styles={{ body: { height: 'calc(100vh - 130px)', overflowY: 'auto', padding: '12px 16px' } }}
    >
      <Form form={form} layout="vertical">
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} style={{ height: '100%' }} />
      </Form>
    </Modal>
  );
}
