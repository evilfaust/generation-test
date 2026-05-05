import { useRef, useCallback } from 'react';
import {
  Button, Input, InputNumber, Typography, Space, Tooltip,
  Popconfirm, Alert, Switch, Divider,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, PrinterOutlined,
  EyeOutlined, EyeInvisibleOutlined, UploadOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import useCrossword, { THEMES } from '../hooks/useCrossword';
import CrosswordPrintLayout from './crossword/CrosswordPrintLayout';
import './CrosswordGenerator.css';

const { Text, Title } = Typography;

// ── Background removal via canvas flood-fill from corners ──────────────────
async function removeBackground(dataUrl, tolerance = 35) {
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

      // Sample bg color from all 4 corners, average them
      const corners = [[0,0],[width-1,0],[0,height-1],[width-1,height-1]];
      let bgR=0, bgG=0, bgB=0;
      for (const [cx,cy] of corners) {
        const i=(cy*width+cx)*4;
        bgR+=data[i]; bgG+=data[i+1]; bgB+=data[i+2];
      }
      bgR=bgR/4|0; bgG=bgG/4|0; bgB=bgB/4|0;

      const visited = new Uint8Array(width * height);
      const stack = [...corners];
      while (stack.length) {
        const [x, y] = stack.pop();
        if (x<0||x>=width||y<0||y>=height) continue;
        const idx = y*width+x;
        if (visited[idx]) continue;
        visited[idx] = 1;
        const pi = idx*4;
        const diff = Math.abs(data[pi]-bgR)+Math.abs(data[pi+1]-bgG)+Math.abs(data[pi+2]-bgB);
        if (diff > tolerance*3) continue;
        data[pi+3] = 0;
        stack.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);
      }
      ctx.putImageData(id, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Resize image to max 160×160 for compact storage
async function resizeImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 160;
      const scale = Math.min(1, MAX / img.width, MAX / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// ── Word card ───────────────────────────────────────────────────────────────
function WordCard({ word, onUpdate, onRemove, isUnplaced }) {
  const fileRef = useRef();

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file);
    if (dataUrl) onUpdate({ imageDataUrl: dataUrl });
    e.target.value = '';
  }, [onUpdate]);

  const handleRemoveBg = useCallback(async () => {
    if (!word.imageDataUrl) return;
    const result = await removeBackground(word.imageDataUrl);
    onUpdate({ imageDataUrl: result });
  }, [word.imageDataUrl, onUpdate]);

  return (
    <div className="cwg-word-card" style={isUnplaced ? { borderColor: '#ff4d4f' } : {}}>
      {/* Number badge */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, paddingTop:2 }}>
        <span className="cwg-num-badge">{word.number}</span>
        <Text style={{ fontSize:10, color:'#aaa' }}>×{word.number}</Text>
      </div>

      {/* Image upload box */}
      <div
        className="cwg-word-img-box"
        onClick={() => fileRef.current?.click()}
        title="Загрузить картинку"
      >
        {word.imageDataUrl
          ? <img src={word.imageDataUrl} alt="word" />
          : <UploadOutlined style={{ fontSize:22, color:'#bbb' }} />
        }
        <div className="cwg-word-img-overlay">
          <UploadOutlined />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display:'none' }}
          onChange={handleFile}
        />
      </div>

      {/* Fields */}
      <div className="cwg-word-fields">
        <Input
          value={word.text}
          onChange={e => onUpdate({ text: e.target.value.toUpperCase().replace(/[^A-Z]/g,'') })}
          placeholder="WORD"
          style={{ fontWeight:700, letterSpacing:2, textTransform:'uppercase' }}
          maxLength={20}
        />
        <div className="cwg-word-row">
          <Text style={{ fontSize:12, color:'#888' }}>Число картинок:</Text>
          <InputNumber
            min={1} max={20}
            value={word.number}
            onChange={v => onUpdate({ number: v })}
            size="small"
            style={{ width:60 }}
          />
          {word.imageDataUrl && (
            <Tooltip title="Убрать фон">
              <Button size="small" onClick={handleRemoveBg} style={{ fontSize:11 }}>
                Убрать фон
              </Button>
            </Tooltip>
          )}
        </div>
        {isUnplaced && (
          <Text className="cwg-unplaced-tag">
            ⚠ Не удалось разместить — нет общих букв
          </Text>
        )}
      </div>

      {/* Remove */}
      <Popconfirm title="Удалить слово?" onConfirm={onRemove} okText="Да" cancelText="Нет">
        <Button type="text" icon={<DeleteOutlined />} danger size="small" />
      </Popconfirm>
    </div>
  );
}

// ── Theme selector ──────────────────────────────────────────────────────────
function ThemeSelector({ value, onChange }) {
  return (
    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
      {Object.entries(THEMES).map(([key, t]) => (
        <button
          key={key}
          className={`cwg-theme-btn${value === key ? ' active' : ''}`}
          style={{ background: t.bg, borderColor: value===key ? t.border : 'transparent' }}
          onClick={() => onChange(key)}
        >
          {t.symbol} {t.name}
        </button>
      ))}
    </div>
  );
}

// ── Print helper ────────────────────────────────────────────────────────────
function printElement(el) {
  const w = window.open('', '_blank');
  w.document.write(`
    <html><head><style>
      @page { size: A4 portrait; margin: 0; }
      body { margin: 0; padding: 0; }
    </style></head>
    <body>${el.outerHTML}</body></html>
  `);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 400);
}

// ── Preview scale to fit screen ─────────────────────────────────────────────
const PREVIEW_WIDTH = 440;
const PRINT_WIDTH   = 794;
const PREVIEW_SCALE = PREVIEW_WIDTH / PRINT_WIDTH;

// ── Main component ──────────────────────────────────────────────────────────
export default function CrosswordGenerator() {
  const {
    words, theme, title, showAnswers, layout, unplacedWords,
    setTheme, setTitle, setShowAnswers,
    addWord, updateWord, removeWord, clearAll,
  } = useCrossword();

  const printRef = useRef();

  const handlePrint = () => {
    if (printRef.current) printElement(printRef.current);
  };

  const unplacedSet = new Set(unplacedWords);

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <Title level={4} style={{ margin:0 }}>Генератор кроссвордов</Title>
        <Space>
          <Tooltip title={showAnswers ? 'Скрыть ответы' : 'Показать ответы'}>
            <Button
              icon={showAnswers ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => setShowAnswers(v => !v)}
            >
              {showAnswers ? 'Скрыть ответы' : 'Показать ответы'}
            </Button>
          </Tooltip>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            disabled={!layout}
          >
            Печать
          </Button>
        </Space>
      </div>

      <div className="cwg-root">
        {/* ── Left panel: editor ── */}
        <div className="cwg-panel">

          {/* Title */}
          <div>
            <Text strong style={{ display:'block', marginBottom:4 }}>Заголовок</Text>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Crossword"
              maxLength={50}
            />
          </div>

          {/* Theme */}
          <div>
            <Text strong style={{ display:'block', marginBottom:6 }}>Тема оформления</Text>
            <ThemeSelector value={theme} onChange={setTheme} />
          </div>

          <Divider style={{ margin:'4px 0' }} />

          {/* Words */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Text strong>Слова ({words.length})</Text>
            <Space size={4}>
              <Button size="small" icon={<PlusOutlined />} onClick={addWord} type="primary">
                Добавить слово
              </Button>
              {words.length > 0 && (
                <Popconfirm title="Очистить все слова?" onConfirm={clearAll} okText="Да" cancelText="Нет">
                  <Button size="small" icon={<ClearOutlined />} danger />
                </Popconfirm>
              )}
            </Space>
          </div>

          {words.length === 0 && (
            <Alert
              type="info"
              showIcon
              message="Добавьте слова на английском языке"
              description="Для каждого слова загрузите картинку. Число на значке = сколько раз картинка встретится на листе — это подсказка ученику."
              style={{ fontSize:12 }}
            />
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:'60vh', overflowY:'auto' }}>
            {words.map((w) => (
              <WordCard
                key={w.id}
                word={w}
                onUpdate={(changes) => updateWord(w.id, changes)}
                onRemove={() => removeWord(w.id)}
                isUnplaced={unplacedSet.has(w.text.toUpperCase())}
              />
            ))}
          </div>

          {unplacedWords.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${unplacedWords.length} слов не размещено`}
              description="У этих слов нет общих букв с другими. Попробуйте изменить слова или порядок."
            />
          )}

          {/* Hint about numbering */}
          {words.length > 0 && (
            <Alert
              type="info"
              showIcon
              message="Как читать кроссворд"
              description="Цифра в клетке = сколько раз эта картинка на листе. Ученик считает картинки и пишет слово."
              style={{ fontSize:11 }}
            />
          )}
        </div>

        {/* ── Right: preview ── */}
        <div className="cwg-preview-col">
          <Text type="secondary" style={{ alignSelf:'flex-start' }}>
            Предпросмотр (масштаб {Math.round(PREVIEW_SCALE * 100)}%)
          </Text>
          <div
            className="cwg-print-wrapper"
            style={{
              width: PREVIEW_WIDTH,
              height: Math.round(1123 * PREVIEW_SCALE),
            }}
          >
            <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin:'top left' }}>
              <CrosswordPrintLayout
                ref={printRef}
                words={words}
                layout={layout}
                theme={theme}
                title={title}
                showAnswers={showAnswers}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
