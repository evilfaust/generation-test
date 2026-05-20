import { useCallback, useRef, useState } from 'react';
import { Button, Space, message } from 'antd';
import { CameraOutlined, ClearOutlined, ScissorOutlined } from '@ant-design/icons';
import GeoGebraApplet from './GeoGebraApplet';
import CropModal from './shared/CropModal';

/**
 * Панель рисования чертежей в GeoGebra с экспортом в PNG.
 *
 * Не сохраняет состояние GeoGebra — только результат (PNG).
 * Drag-to-resize встроен в GeoGebraApplet.
 *
 * Props:
 *   imageDataUrl  — текущий PNG (data:image/...) или null
 *   onImageChange — callback(dataUrl | null)
 *   initialHeight — начальная высота апплета (default: 420)
 */
export default function GeoGebraDrawingPanel({
  imageDataUrl = null,
  onImageChange,
  initialHeight = 420,
}) {
  const ggbApiRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  const handleApiReady = useCallback((api) => {
    ggbApiRef.current = api;
  }, []);

  const handleSavePng = useCallback(() => {
    const api = ggbApiRef.current;
    if (!api || typeof api.getPNGBase64 !== 'function') {
      message.warning('GeoGebra ещё не загружена');
      return;
    }

    setSaving(true);
    try {
      const pngBase64 = api.getPNGBase64(2, false, 300);
      if (pngBase64) {
        const dataUrl = pngBase64.startsWith('data:image/')
          ? pngBase64
          : `data:image/png;base64,${pngBase64}`;
        onImageChange(dataUrl);
        message.success('PNG сохранён');
      } else {
        message.warning('Не удалось получить PNG. Нарисуйте что-нибудь.');
      }
    } catch {
      message.error('Ошибка экспорта PNG');
    } finally {
      setSaving(false);
    }
  }, [onImageChange]);

  const handleOpenCrop = useCallback(() => {
    if (!imageDataUrl) {
      message.warning('Сначала сохраните PNG');
      return;
    }
    setCropModalOpen(true);
  }, [imageDataUrl]);

  const handleCropped = useCallback((croppedDataUrl) => {
    onImageChange(croppedDataUrl);
    setCropModalOpen(false);
  }, [onImageChange]);

  const handleClear = useCallback(() => {
    onImageChange(null);
  }, [onImageChange]);

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <GeoGebraApplet
        appName="geometry"
        readOnly={false}
        onApiReady={handleApiReady}
        height={initialHeight}
      />

      <Space wrap>
        <Button icon={<CameraOutlined />} onClick={handleSavePng} loading={saving} type="primary">
          Сохранить PNG
        </Button>
        <Button icon={<ScissorOutlined />} onClick={handleOpenCrop} disabled={!imageDataUrl}>
          Обрезать
        </Button>
        <Button icon={<ClearOutlined />} onClick={handleClear} disabled={!imageDataUrl} danger>
          Очистить
        </Button>
      </Space>

      {imageDataUrl && (
        <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, padding: 8, textAlign: 'center' }}>
          <img
            src={imageDataUrl}
            alt="Чертёж"
            style={{ maxWidth: '100%', maxHeight: 200, display: 'block', margin: '0 auto' }}
          />
        </div>
      )}

      <CropModal
        open={cropModalOpen}
        onCancel={() => setCropModalOpen(false)}
        onCropped={handleCropped}
        imageUrl={imageDataUrl}
        title="Обрезка PNG"
        emptyMessage="Сначала сохраните PNG из GeoGebra"
        messageApi={message}
      />
    </Space>
  );
}
