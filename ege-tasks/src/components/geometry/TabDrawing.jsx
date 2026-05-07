import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Select, Space, Tag, Typography, message } from 'antd';
import {
  FullscreenExitOutlined,
  FullscreenOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import GeoGebraApplet from '../GeoGebraApplet';
import CropModal from '../shared/CropModal';

// ── Удаление фона: flood-fill от 4 углов с зоной защиты ─────────────────
//
// Алгоритм:
//  1. Находим все «тёмные» пиксели (линии, текст, точки).
//  2. BFS: расширяем зону защиты на PROTECT_R пикселей вокруг каждого тёмного.
//  3. Flood-fill от углов убирает белый фон, пропуская защищённые пиксели.
//
// Так даже при щедром tolerance белое внутри/рядом с рисунком не трогается.
//
// Важно: remote URL (PocketBase) → canvas tainted → getImageData бросит
// SecurityError. Поэтому сначала конвертируем в data URL через fetch.

async function toDataUrl(src) {
  if (String(src).startsWith('data:')) return src;
  const resp = await fetch(src);
  const blob = await resp.blob();
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = (e) => res(e.target.result);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });
}

async function removeWhiteBackground(src) {
  const DARK_MIN_DIFF = 20;  // пиксель «тёмный» если хотя бы один канал отличается от 255 на ≥20
  const PROTECT_R    = 4;    // пикселей защитной зоны вокруг тёмного контента
  const BG_TOLERANCE = 30;   // допуск flood-fill (щедрый — зона защиты нас страхует)

  const dataUrl = await toDataUrl(src);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = id;
      const n = width * height;

      // ── Шаг 1: помечаем тёмные пиксели ─────────────────────────────────
      const dark = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const p = i * 4;
        if (
          255 - data[p]     >= DARK_MIN_DIFF ||
          255 - data[p + 1] >= DARK_MIN_DIFF ||
          255 - data[p + 2] >= DARK_MIN_DIFF
        ) dark[i] = 1;
      }

      // ── Шаг 2: BFS — расширяем защитную зону на PROTECT_R пикселей ─────
      const protect = new Uint8Array(n);
      const dist    = new Int16Array(n).fill(-1);
      const queue   = [];
      for (let i = 0; i < n; i++) {
        if (dark[i]) { protect[i] = 1; dist[i] = 0; queue.push(i); }
      }
      let head = 0;
      while (head < queue.length) {
        const idx = queue[head++];
        const d = dist[idx];
        if (d >= PROTECT_R) continue;
        const x = idx % width, y = (idx / width) | 0;
        const nb = [];
        if (x > 0)         nb.push(idx - 1);
        if (x < width - 1) nb.push(idx + 1);
        if (y > 0)         nb.push(idx - width);
        if (y < height - 1) nb.push(idx + width);
        for (const ni of nb) {
          if (dist[ni] === -1) {
            dist[ni] = d + 1;
            protect[ni] = 1;
            queue.push(ni);
          }
        }
      }

      // ── Шаг 3: flood-fill от углов, пропуская защищённые пиксели ────────
      const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
      let bgR = 0, bgG = 0, bgB = 0;
      for (const [cx, cy] of corners) {
        const p = (cy * width + cx) * 4;
        bgR += data[p]; bgG += data[p + 1]; bgB += data[p + 2];
      }
      bgR = bgR / 4 | 0; bgG = bgG / 4 | 0; bgB = bgB / 4 | 0;

      const visited = new Uint8Array(n);
      const stack   = [...corners];
      while (stack.length) {
        const [x, y] = stack.pop();
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        const idx = y * width + x;
        if (visited[idx]) continue;
        visited[idx] = 1;
        const pi = idx * 4;
        const diff = Math.abs(data[pi] - bgR) + Math.abs(data[pi + 1] - bgG) + Math.abs(data[pi + 2] - bgB);
        if (diff > BG_TOLERANCE * 3) continue; // тёмный пиксель — стоп, не распространяться
        // Стираем ТОЛЬКО если не в защитной зоне; но распространяемся всегда
        if (!protect[idx]) data[pi + 3] = 0;
        stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
      }

      ctx.putImageData(id, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const { Text } = Typography;

const APPNAME_OPTIONS = [
  { value: 'geometry', label: 'Геометрия' },
  { value: 'graphing', label: 'Графики функций' },
  { value: 'classic', label: 'Классик (все инструменты)' },
  { value: '3d', label: '3D — стереометрия' },
];

export default function TabDrawing({
  appName,
  onAppNameChange,
  initialBase64,
  imageBase64,
  onApiReady,
  ggbSaved,
  drawingView,
  onDrawingViewChange,
  savingDrawing,
  onSaveDrawing,
  onSaveDrawingAsImage,
  onCropApplied,
  onClearDrawing,
}) {
  const drawingContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 900,
  );
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    const onFullscreenChange = () => {
      if (!drawingContainerRef.current) {
        setIsFullscreen(false);
        return;
      }
      setIsFullscreen(document.fullscreenElement === drawingContainerRef.current);
    };

    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (drawingContainerRef.current?.requestFullscreen) {
          await drawingContainerRef.current.requestFullscreen();
        }
        return;
      }
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      message.warning('Не удалось переключить полноэкранный режим.');
    }
  }, []);

  const appletHeight = isFullscreen
    ? Math.max(680, viewportHeight - 96)
    : 680;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      message.error('Пожалуйста, выберите файл изображения');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      onCropApplied(ev.target.result);
      message.success('Изображение загружено');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleOpenCrop = () => {
    if (!imageBase64) {
      message.warning('Сначала сохраните PNG');
      return;
    }
    setCropModalOpen(true);
  };

  const handleCropped = (croppedDataUrl) => {
    onCropApplied(croppedDataUrl);
    setCropModalOpen(false);
  };

  const handleRemoveBg = useCallback(async () => {
    if (!imageBase64) {
      message.warning('Сначала сохраните PNG');
      return;
    }
    setRemovingBg(true);
    try {
      const result = await removeWhiteBackground(imageBase64);
      onCropApplied(result);
      message.success('Фон удалён');
    } catch {
      message.error('Не удалось удалить фон');
    } finally {
      setRemovingBg(false);
    }
  }, [imageBase64, onCropApplied]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '16px 0' }}>
      {/* Панель управления */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Card size="small">
        <Space wrap>
          <div>
            <Text type="secondary" style={{ marginRight: 8 }}>Режим:</Text>
            <Select
              value={appName}
              onChange={onAppNameChange}
              options={APPNAME_OPTIONS}
              style={{ width: 220 }}
            />
          </div>

          <div>
            <Text type="secondary" style={{ marginRight: 8 }}>Показывать:</Text>
            <Select
              value={drawingView}
              onChange={onDrawingViewChange}
              style={{ width: 220 }}
              options={[
                { value: 'image', label: 'Картинку (PNG)' },
                { value: 'geogebra', label: 'GeoGebra объект' },
              ]}
            />
          </div>

          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={savingDrawing}
            onClick={onSaveDrawing}
          >
            Сохранить чертёж (GeoGebra + PNG)
          </Button>

          <Button
            loading={savingDrawing}
            onClick={onSaveDrawingAsImage}
          >
            Сохранить как картинку (PNG)
          </Button>

          <Button
            icon={<UploadOutlined />}
            onClick={() => fileInputRef.current?.click()}
          >
            Загрузить из файла
          </Button>

          <Button onClick={handleOpenCrop} disabled={!imageBase64}>
            Обрезать PNG
          </Button>

          <Button
            onClick={handleRemoveBg}
            disabled={!imageBase64}
            loading={removingBg}
          >
            Убрать фон
          </Button>

          <Button
            icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? 'Свернуть' : 'На весь экран'}
          </Button>

          <Button onClick={onClearDrawing} danger>
            Очистить
          </Button>

          {ggbSaved && (
            <Tag color="success" style={{ fontSize: 13, padding: '4px 10px' }}>
              ✓ Чертёж сохранён
            </Tag>
          )}
          {!ggbSaved && (
            <Tag color="warning" style={{ fontSize: 13, padding: '4px 10px' }}>
              Чертёж не сохранён
            </Tag>
          )}
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        message={
          <span>
            Нарисуйте чертёж в поле ниже. Можно сохранить в формате GeoGebra
            кнопкой <strong>«Сохранить чертёж (GeoGebra + PNG)»</strong> или обновить только картинку
            кнопкой <strong>«Сохранить как картинку (PNG)»</strong>.
            После этого можно обрезать лишние поля кнопкой <strong>«Обрезать PNG»</strong>,
            а белый фон убрать кнопкой <strong>«Убрать фон»</strong>.
          </span>
        }
      />

      {!!imageBase64 && (
        <Card
          size="small"
          title="Текущая сохранённая картинка (PNG)"
          styles={{ body: { padding: 12 } }}
        >
          <img
            src={imageBase64}
            alt="Чертёж"
            style={{ width: '100%', maxHeight: 320, objectFit: 'contain', display: 'block' }}
          />
        </Card>
      )}

      {/* GeoGebra апплет */}
      <div
        ref={drawingContainerRef}
        style={{
          width: '100%',
          background: '#fff',
          borderRadius: 10,
          padding: isFullscreen ? 10 : 0,
        }}
      >
        <GeoGebraApplet
          appName={appName}
          readOnly={false}
          initialBase64={initialBase64}
          onApiReady={onApiReady}
          height={appletHeight}
        />
      </div>

      <CropModal
        open={cropModalOpen}
        onCancel={() => setCropModalOpen(false)}
        onCropped={handleCropped}
        imageUrl={imageBase64}
        title="Обрезка PNG"
        emptyMessage="Сначала сохраните PNG из GeoGebra"
        messageApi={message}
      />
    </Space>
  );
}
