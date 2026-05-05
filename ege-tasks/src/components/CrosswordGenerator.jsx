import { useRef, useCallback } from 'react';
import {
  Button, Input, InputNumber, Typography, Space, Tooltip,
  Popconfirm, Alert, Divider,
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

// ── Background removal (flood-fill from corners) ───────────────────────────
async function removeBackground(dataUrl, tolerance = 35) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = id;
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

async function resizeImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 200;
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

// ── Safe CSS-inject print (no window.open → no crash) ─────────────────────
function doPrint(el) {
  const clone = el.cloneNode(true);
  clone.id = '__cw_print__';
  clone.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;';
  document.body.appendChild(clone);
  const style = document.createElement('style');
  style.id = '__cw_print_style__';
  style.textContent = `
    @media print {
      @page { size: A4 portrait; margin: 0; }
      body > *:not(#__cw_print__) { display: none !important; }
      #__cw_print__ { display: block !important; position: fixed !important; top: 0; left: 0; }
    }
  `;
  document.head.appendChild(style);
  window.print();
  document.body.removeChild(clone);
  document.head.removeChild(style);
}

// ── Word card ──────────────────────────────────────────────────────────────
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
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, paddingTop:2 }}>
        <span className="cwg-num-badge">{word.number}</span>
        <Text style={{ fontSize:10, color:'#aaa' }}>×{word.number}</Text>
      </div>

      <div
        className="cwg-word-img-box"
        onClick={() => fileRef.current?.click()}
        title="Загрузить картинку"
      >
        {word.imageDataUrl
          ? <img src={word.imageDataUrl} alt="word" />
          : <UploadOutlined style={{ fontSize:22, color:'#bbb' }} />
        }
        <div className="cwg-word-img-overlay"><UploadOutlined /></div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display:'none' }}
          onChange={handleFile}
        />
      </div>

      <div className="cwg-word-fields">
        <Input
          value={word.text}
          onChange={e => onUpdate({ text: e.target.value.toUpperCase().replace(/[^A-Z]/g,'') })}
          placeholder="WORD"
          style={{ fontWeight:700, letterSpacing:2 }}
          maxLength={20}
        />
        <div className="cwg-word-row">
          <Text style={{ fontSize:12, color:'#888' }}>Картинок:</Text>
          <InputNumber
            min={1} max={20}
            value={word.number}
            onChange={v => onUpdate({ number: v })}
            size="small"
            style={{ width:60 }}
          />
          {word.imageDataUrl && (
            <Tooltip title="Убрать однотонный фон">
              <Button size="small" onClick={handleRemoveBg} style={{ fontSize:11 }}>
                Убрать фон
              </Button>
            </Tooltip>
          )}
        </div>
        {isUnplaced && (
          <Text style={{ fontSize:11, color:'#ff4d4f' }}>
            ⚠ Нет общих букв с другими словами
          </Text>
        )}
      </div>

      <Popconfirm title="Удалить слово?" onConfirm={onRemove} okText="Да" cancelText="Нет">
        <Button type="text" icon={<DeleteOutlined />} danger size="small" />
      </Popconfirm>
    </div>
  );
}

// ── Theme selector ─────────────────────────────────────────────────────────
function ThemeSelector({ value, onChange }) {
  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
      {Object.entries(THEMES).map(([key, t]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            background: t.bg,
            border: value === key ? '3px solid #fff' : '3px solid transparent',
            outline: value === key ? '2px solid #1677ff' : 'none',
            outlineOffset: 1,
            borderRadius: 10,
            padding: '7px 14px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
            transition: 'transform 0.12s, box-shadow 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform='scale(1.06)'; e.currentTarget.style.boxShadow='0 5px 16px rgba(0,0,0,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 3px 10px rgba(0,0,0,0.2)'; }}
        >
          {t.symbol} {t.name}
        </button>
      ))}
    </div>
  );
}

// ── Scale preview to fit sidebar ───────────────────────────────────────────
const PREVIEW_W = 430;
const PRINT_W   = 794;
const SCALE     = PREVIEW_W / PRINT_W;

// ── Main component ─────────────────────────────────────────────────────────
export default function CrosswordGenerator() {
  const {
    words, theme, title, showAnswers, layout, unplacedWords,
    setTheme, setTitle, setShowAnswers,
    addWord, updateWord, removeWord, clearAll,
  } = useCrossword();

  const printRef = useRef();
  const unplacedSet = new Set(unplacedWords);

  const handlePrint = () => {
    if (printRef.current) doPrint(printRef.current);
  };

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <Title level={4} style={{ margin:0 }}>Генератор кроссвордов</Title>
        <Space>
          <Button
            icon={showAnswers ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setShowAnswers(v => !v)}
          >
            {showAnswers ? 'Скрыть ответы' : 'Показать ответы'}
          </Button>
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
        {/* ── Editor panel ── */}
        <div className="cwg-panel">
          <div>
            <Text strong style={{ display:'block', marginBottom:4 }}>Заголовок листа</Text>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Crossword"
              maxLength={50}
            />
          </div>

          <div>
            <Text strong style={{ display:'block', marginBottom:8 }}>Тема оформления</Text>
            <ThemeSelector value={theme} onChange={setTheme} />
          </div>

          <Divider style={{ margin:'4px 0' }} />

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Text strong>Слова ({words.length})</Text>
            <Space size={4}>
              <Button size="small" icon={<PlusOutlined />} onClick={addWord} type="primary">
                Добавить
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
              message="Как это работает"
              description="Добавьте слова на английском + картинку для каждого. Число = сколько раз картинка будет разбросана по листу. Ученик считает и вписывает слово."
              style={{ fontSize:12 }}
            />
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:'58vh', overflowY:'auto' }}>
            {words.map(w => (
              <WordCard
                key={w.id}
                word={w}
                onUpdate={ch => updateWord(w.id, ch)}
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
              description="Нет общих букв с другими словами. Измените написание или добавьте слово с общей буквой."
            />
          )}
        </div>

        {/* ── Preview ── */}
        <div className="cwg-preview-col">
          <Text type="secondary" style={{ alignSelf:'flex-start', marginBottom:4 }}>
            Предпросмотр ({Math.round(SCALE * 100)}%)
          </Text>
          <div
            className="cwg-print-wrapper"
            style={{ width: PREVIEW_W, height: Math.round(1123 * SCALE) }}
          >
            <div style={{ transform:`scale(${SCALE})`, transformOrigin:'top left' }}>
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
