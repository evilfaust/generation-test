import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal, Form, Input, Select, Switch, Tabs, Button, Space, Upload, message,
  Divider, Typography,
} from 'antd';
import { UploadOutlined, DeleteOutlined, CameraOutlined, ScissorOutlined } from '@ant-design/icons';
import CropModal from '../shared/CropModal';
import { api } from '../../services/pocketbase';
import MathRenderer from '../../shared/components/MathRenderer';
import GeoGebraDrawingPanel from '../GeoGebraDrawingPanel';
import { dataUrlToFile } from '../../utils/cropImage';

const { Text } = Typography;
const { TextArea } = Input;

const TYPE_OPTIONS = [
  { value: 'theorem', label: 'Теорема' },
  { value: 'definition', label: 'Определение' },
  { value: 'formula', label: 'Формула' },
  { value: 'axiom', label: 'Аксиома' },
  { value: 'property', label: 'Свойство' },
  { value: 'criterion', label: 'Признак' },
  { value: 'corollary', label: 'Следствие' },
];

export default function TDFItemModal({ open, item, setId, onClose, onSaved, nextOrder }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [isSectionHeader, setIsSectionHeader] = useState(false);
  const [drawingDataUrl, setDrawingDataUrl] = useState(null); // preview PNG
  const [drawingFile, setDrawingFile] = useState(null); // File to upload
  const [drawingSource, setDrawingSource] = useState('none'); // 'none' | 'upload' | 'geogebra'
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('fields');

  // Preview state for formulation / short_notation
  const [formulationPreview, setFormulationPreview] = useState('');
  const [notationPreview, setNotationPreview] = useState('');

  const isEdit = !!item;

  useEffect(() => {
    if (!open) return;
    if (item) {
      const isHeader = !!item.is_section_header;
      setIsSectionHeader(isHeader);
      form.setFieldsValue({
        is_section_header: isHeader,
        section_title: item.section_title || '',
        type: item.type || undefined,
        name: item.name || '',
        formulation_md: item.formulation_md || '',
        short_notation_md: item.short_notation_md || '',
      });
      setFormulationPreview(item.formulation_md || '');
      setNotationPreview(item.short_notation_md || '');

      // Drawing — конвертируем remote URL в data URL, чтобы canvas не был "tainted" при кадрировании
      if (item.drawing_image) {
        const url = api.getTdfItemDrawingUrl(item);
        fetch(url)
          .then(r => r.blob())
          .then(blob => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(blob);
          }))
          .then(dataUrl => {
            setDrawingDataUrl(dataUrl);
            setDrawingSource('upload');
          })
          .catch(() => {
            // Fallback: set remote URL (crop won't work but preview will)
            setDrawingDataUrl(url);
            setDrawingSource('upload');
          });
      } else {
        setDrawingDataUrl(null);
        setDrawingSource('none');
      }
    } else {
      setIsSectionHeader(false);
      form.resetFields();
      setFormulationPreview('');
      setNotationPreview('');
      setDrawingDataUrl(null);
      setDrawingFile(null);
      setDrawingSource('none');
    }
    setActiveTab('fields');
  }, [open, item]);

  const handleUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setDrawingDataUrl(e.target.result);
      setDrawingFile(file);
      setDrawingSource('upload');
    };
    reader.readAsDataURL(file);
    return false; // prevent auto upload
  };

  const handleGeoGebraImage = (dataUrl) => {
    if (!dataUrl) return;
    setDrawingDataUrl(dataUrl);
    setDrawingSource('geogebra');
    // Convert to File for upload
    dataUrlToFile(dataUrl, 'drawing.png').then(f => setDrawingFile(f));
  };

  const handleRemoveDrawing = () => {
    setDrawingDataUrl(null);
    setDrawingFile(null);
    setDrawingSource('none');
  };

  const handleCropped = async (croppedDataUrl) => {
    setDrawingDataUrl(croppedDataUrl);
    const f = await dataUrlToFile(croppedDataUrl, 'drawing.png');
    setDrawingFile(f);
    setCropModalOpen(false);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      console.log('[TDFItemModal] validateFields values:', JSON.stringify(values));
      setSaving(true);

      const formData = new FormData();
      const fields = {
        tdf_set: setId,
        is_section_header: !!values.is_section_header,
        order: item?.order ?? nextOrder,
      };

      if (values.is_section_header) {
        fields.section_title = values.section_title || '';
      } else {
        fields.type = values.type || '';
        fields.name = values.name || '';
        fields.formulation_md = values.formulation_md || '';
        fields.short_notation_md = values.short_notation_md || '';
      }

      Object.entries(fields).forEach(([k, v]) => formData.append(k, v));

      // Handle drawing
      let fileToUpload = drawingFile;
      if (!fileToUpload && drawingDataUrl && drawingSource === 'geogebra') {
        // dataUrlToFile может ещё не завершиться — конвертируем здесь
        fileToUpload = await dataUrlToFile(drawingDataUrl, 'drawing.png');
      }
      if (fileToUpload) {
        formData.append('drawing_image', fileToUpload);
      } else if (!drawingDataUrl && item?.drawing_image) {
        // Пользователь удалил изображение
        formData.append('drawing_image', '');
      }

      let saved;
      if (isEdit) {
        saved = await api.updateTdfItem(item.id, formData);
      } else {
        saved = await api.createTdfItem(formData);
      }

      message.success(isEdit ? 'Пункт обновлён' : 'Пункт добавлен');
      onSaved(saved, !isEdit);
    } catch (err) {
      console.error('[TDFItemModal] save error:', err, 'errorFields:', err?.errorFields);
      if (err?.errorFields) return;
      console.error(err);
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

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
            <Form.Item name="section_title" label="Название раздела" rules={[{ required: true, message: 'Введите название' }]}>
              <Input placeholder="Например: Признаки параллельности двух прямых" />
            </Form.Item>
          ) : (
            <>
              <Form.Item name="type" label="Тип">
                <Select options={TYPE_OPTIONS} placeholder="Выберите тип" allowClear />
              </Form.Item>
              <Form.Item name="name" label="Название / тема">
                <Input placeholder="Например: Признак 1 (накрест лежащие углы)" />
              </Form.Item>
              <Form.Item name="formulation_md" label="Формулировка">
                <TextArea
                  rows={6}
                  placeholder="Полная формулировка теоремы/определения. Поддерживается LaTeX: $x^2$"
                  onChange={e => setFormulationPreview(e.target.value)}
                />
              </Form.Item>
              <Form.Item name="short_notation_md" label="Краткая запись">
                <TextArea
                  rows={2}
                  placeholder="Символьная запись. Например: $\angle 1 = \angle 2 \Rightarrow a \parallel b$"
                  onChange={e => setNotationPreview(e.target.value)}
                />
              </Form.Item>
            </>
          )}
        </>
      ),
    },
    {
      key: 'drawing',
      label: 'Чертёж',
      disabled: isSectionHeader,
      forceRender: true,
      children: (
        <div>
          {/* Текущий чертёж */}
          {drawingDataUrl && (
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <img
                src={drawingDataUrl}
                alt="чертёж"
                style={{ maxWidth: '100%', maxHeight: 200, border: '1px solid #f0f0f0', borderRadius: 4 }}
              />
              <div style={{ marginTop: 8 }}>
                <Space>
                  <Button icon={<ScissorOutlined />} onClick={() => setCropModalOpen(true)}>
                    Кадрировать
                  </Button>
                  <Button danger icon={<DeleteOutlined />} onClick={handleRemoveDrawing}>
                    Удалить чертёж
                  </Button>
                </Space>
              </div>
            </div>
          )}

          {/* Загрузка файла */}
          <Divider orientation="left">Загрузить изображение</Divider>
          <Upload
            accept="image/png,image/jpeg,image/webp"
            beforeUpload={handleUpload}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />}>Выбрать файл (PNG/JPG)</Button>
          </Upload>

          {/* GeoGebra */}
          <Divider orientation="left">Нарисовать в GeoGebra</Divider>
          <GeoGebraDrawingPanel
            imageDataUrl={drawingSource === 'geogebra' ? drawingDataUrl : null}
            onImageChange={handleGeoGebraImage}
            height={520}
          />

          <CropModal
            open={cropModalOpen}
            onCancel={() => setCropModalOpen(false)}
            onCropped={handleCropped}
            imageUrl={drawingDataUrl}
            title="Кадрирование чертежа"
            emptyMessage="Нет изображения для кадрирования"
            messageApi={message}
          />
        </div>
      ),
    },
    {
      key: 'preview',
      label: 'Предпросмотр',
      disabled: isSectionHeader,
      children: (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {['Формулировка', 'Чертёж', 'Краткая запись'].map(h => (
                  <th key={h} style={{ border: '1px solid #d9d9d9', padding: '6px 10px', fontWeight: 600 }}>
                    {h}
                  </th>
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
        </div>
      ),
    },
  ];

  return (
    <Modal
      title={
        isEdit
          ? (isSectionHeader ? 'Редактировать раздел' : 'Редактировать пункт ТДФ')
          : (isSectionHeader ? 'Новый раздел' : 'Новый пункт ТДФ')
      }
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
