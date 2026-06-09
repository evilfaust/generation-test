import { useCallback, useEffect, useRef, useState } from 'react';
import { App, Button, Card, Divider, Modal, Popconfirm, Select, Tag, Tooltip, Typography } from 'antd';
import {
  ClearOutlined,
  DeleteOutlined,
  EditOutlined,
  FileImageOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  SaveOutlined,
  ScissorOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import GeoGebraApplet from '../GeoGebraApplet';
import CropModal from '../shared/CropModal';
import SvgEditor from './SvgEditor';

// ── Удаление фона: flood-fill от 4 углов с зоной защиты ─────────────────────
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
  const DARK_MIN_DIFF = 20;
  const PROTECT_R    = 4;
  const BG_TOLERANCE = 30;
  const dataUrl = await toDataUrl(src);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = id;
      const n = width * height;
      const dark = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const p = i * 4;
        if (255-data[p]>=DARK_MIN_DIFF || 255-data[p+1]>=DARK_MIN_DIFF || 255-data[p+2]>=DARK_MIN_DIFF) dark[i]=1;
      }
      const protect = new Uint8Array(n);
      const dist = new Int16Array(n).fill(-1);
      const queue = [];
      for (let i = 0; i < n; i++) { if (dark[i]) { protect[i]=1; dist[i]=0; queue.push(i); } }
      let head = 0;
      while (head < queue.length) {
        const idx = queue[head++]; const d = dist[idx];
        if (d >= PROTECT_R) continue;
        const x = idx % width, y = (idx/width)|0;
        for (const ni of [idx-1,idx+1,idx-width,idx+width]) {
          if (ni<0||ni>=n) continue;
          const nx=ni%width;
          if (Math.abs(nx - x) > 1) continue; // не переходить через край
          if (dist[ni]===-1) { dist[ni]=d+1; protect[ni]=1; queue.push(ni); }
        }
      }
      const corners = [[0,0],[width-1,0],[0,height-1],[width-1,height-1]];
      let bgR=0,bgG=0,bgB=0;
      for (const [cx,cy] of corners) { const p=(cy*width+cx)*4; bgR+=data[p]; bgG+=data[p+1]; bgB+=data[p+2]; }
      bgR=bgR/4|0; bgG=bgG/4|0; bgB=bgB/4|0;
      const visited = new Uint8Array(n);
      const stack = [...corners];
      while (stack.length) {
        const [x,y] = stack.pop();
        if (x<0||x>=width||y<0||y>=height) continue;
        const idx=y*width+x;
        if (visited[idx]) continue;
        visited[idx]=1;
        const pi=idx*4;
        const diff=Math.abs(data[pi]-bgR)+Math.abs(data[pi+1]-bgG)+Math.abs(data[pi+2]-bgB);
        if (diff>BG_TOLERANCE*3) continue;
        if (!protect[idx]) data[pi+3]=0;
        stack.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);
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
  { value: 'graphing', label: 'Графики' },
  { value: 'classic', label: 'Классик' },
  { value: '3d', label: '3D' },
];

const DIVIDER = <Divider type="vertical" style={{ height: 20, margin: '0 2px' }} />;

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
  drawingSvg,
  convertingSvg,
  savingSvg,
  onConvertToSvg,
  onSaveSvg,
  onGetXml,
  onSvgChange,
}) {
  const { message } = App.useApp();
  const drawingContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 900,
  );
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);

  // ── SVG-редактор ──────────────────────────────────────────────────────────
  const [svgEditorOpen, setSvgEditorOpen] = useState(false);
  const [editorXml, setEditorXml] = useState('');

  const handleOpenSvgEditor = useCallback(() => {
    const xml = onGetXml?.() ?? '';
    if (!xml) {
      message.warning('GeoGebra ещё не загружена. Откройте вкладку «Чертёж» и подождите загрузки апплета.');
      return;
    }
    setEditorXml(xml);
    setSvgEditorOpen(true);
  }, [onGetXml, message]);

  const handleSvgEditorSave = useCallback((newSvg) => {
    onSvgChange?.(newSvg);
    setSvgEditorOpen(false);
    message.success('SVG обновлён — нажмите «Сохр. SVG» или сохраните задачу целиком');
  }, [onSvgChange, message]);

  const handleSvgEditorCancel = useCallback(() => setSvgEditorOpen(false), []);

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    const onFullscreenChange = () => {
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
        await drawingContainerRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      message.warning('Не удалось переключить полноэкранный режим.');
    }
  }, [message]);

  const appletHeight = isFullscreen ? Math.max(680, viewportHeight - 96) : 680;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { message.error('Выберите файл изображения'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { onCropApplied(ev.target.result); message.success('Изображение загружено'); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleOpenCrop = () => {
    if (!imageBase64) { message.warning('Сначала сохраните PNG'); return; }
    setCropModalOpen(true);
  };

  const handleRemoveBg = useCallback(async () => {
    if (!imageBase64) { message.warning('Сначала сохраните PNG'); return; }
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
  }, [imageBase64, onCropApplied, message]);

  return (
    <div style={{ paddingTop: 12 }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* ── Компактная панель инструментов ───────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '6px 10px',
          background: '#fafafa',
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        {/* Режим + Показывать */}
        <Tooltip title="Режим GeoGebra">
          <Select
            size="small"
            value={appName}
            onChange={onAppNameChange}
            options={APPNAME_OPTIONS}
            style={{ width: 120 }}
          />
        </Tooltip>
        <Tooltip title="Что показывать в задаче">
          <Select
            size="small"
            value={drawingView}
            onChange={onDrawingViewChange}
            style={{ width: 120 }}
            options={[
              { value: 'image',    label: 'PNG' },
              { value: 'geogebra', label: 'GeoGebra' },
              { value: 'svg',      label: 'SVG', disabled: !drawingSvg },
            ]}
          />
        </Tooltip>

        {DIVIDER}

        {/* Сохранение */}
        <Button size="small" type="primary" icon={<SaveOutlined />} loading={savingDrawing} onClick={onSaveDrawing}>
          Сохранить
        </Button>
        <Tooltip title="Сохранить только PNG">
          <Button size="small" icon={<FileImageOutlined />} loading={savingDrawing} onClick={onSaveDrawingAsImage} />
        </Tooltip>
        <Tooltip title="Загрузить из файла">
          <Button size="small" icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()} />
        </Tooltip>

        {DIVIDER}

        {/* Редактирование PNG */}
        <Tooltip title="Обрезать PNG">
          <Button size="small" icon={<ScissorOutlined />} onClick={handleOpenCrop} disabled={!imageBase64} />
        </Tooltip>
        <Tooltip title="Убрать белый фон">
          <Button size="small" icon={<ClearOutlined />} loading={removingBg} disabled={!imageBase64} onClick={handleRemoveBg} />
        </Tooltip>
        <Tooltip title={isFullscreen ? 'Свернуть' : 'На весь экран'}>
          <Button
            size="small"
            icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            onClick={toggleFullscreen}
          />
        </Tooltip>

        {DIVIDER}

        {/* SVG */}
        <Button size="small" loading={convertingSvg} disabled={!onConvertToSvg} onClick={onConvertToSvg}>
          → SVG
        </Button>
        {drawingSvg && onSaveSvg && (
          <Button size="small" type="primary" ghost loading={savingSvg} onClick={onSaveSvg}>
            Сохр. SVG
          </Button>
        )}
        {drawingSvg && onSvgChange && (
          <Tooltip title="Редактировать SVG">
            <Button size="small" icon={<EditOutlined />} onClick={handleOpenSvgEditor} />
          </Tooltip>
        )}

        {DIVIDER}

        {/* Очистить */}
        <Popconfirm
          title="Очистить чертёж?"
          okText="Да"
          cancelText="Нет"
          okButtonProps={{ danger: true, size: 'small' }}
          onConfirm={onClearDrawing}
        >
          <Button size="small" danger icon={<DeleteOutlined />}>Очистить</Button>
        </Popconfirm>

        {/* Статус */}
        <Tag
          color={ggbSaved ? 'success' : 'warning'}
          style={{ margin: '0 0 0 auto', lineHeight: '20px' }}
        >
          {ggbSaved ? '✓ Сохранён' : 'Не сохранён'}
        </Tag>
      </div>

      {/* ── Превью PNG и SVG рядом ───────────────────────────────────────── */}
      {(imageBase64 || drawingSvg) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: (imageBase64 && drawingSvg) ? '1fr 1fr' : '1fr',
            gap: 12,
            marginBottom: 12,
          }}
        >
          {imageBase64 && (
            <Card
              size="small"
              title={<Text type="secondary" style={{ fontSize: 12 }}>PNG-чертёж</Text>}
              styles={{ body: { padding: 8 } }}
            >
              <img
                src={imageBase64}
                alt="PNG"
                style={{ width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block' }}
              />
            </Card>
          )}
          {drawingSvg && (
            <Card
              size="small"
              title={<Text type="secondary" style={{ fontSize: 12 }}>SVG-чертёж</Text>}
              styles={{ body: { padding: 8, display: 'flex', justifyContent: 'center' } }}
            >
              <div
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: drawingSvg }}
                style={{ lineHeight: 0, maxHeight: 200, overflow: 'hidden' }}
              />
            </Card>
          )}
        </div>
      )}

      {/* ── GeoGebra апплет ──────────────────────────────────────────────── */}
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
        onCropped={(url) => { onCropApplied(url); setCropModalOpen(false); }}
        imageUrl={imageBase64}
        title="Обрезка PNG"
        emptyMessage="Сначала сохраните PNG из GeoGebra"
        messageApi={message}
      />

      {/* SVG-редактор */}
      <Modal
        open={svgEditorOpen}
        onCancel={handleSvgEditorCancel}
        title="Редактор SVG-чертежа"
        footer={null}
        width={680}
        destroyOnHidden
        styles={{ body: { maxHeight: '75vh', overflowY: 'auto', padding: 16 } }}
      >
        {svgEditorOpen && editorXml && drawingSvg && (
          <SvgEditor
            xmlString={editorXml}
            svgString={drawingSvg}
            onSave={handleSvgEditorSave}
            onCancel={handleSvgEditorCancel}
          />
        )}
      </Modal>
    </div>
  );
}
