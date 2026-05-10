import { useRef, useCallback, useMemo } from 'react';
import {
  Button, Input, InputNumber, Typography, Space, Tooltip,
  Popconfirm, Alert, Divider, Tag,
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

// ── Паттерн печати как в QRWorksheetGenerator ─────────────────────────────
function doPrint() {
  const style = document.createElement('style');
  style.id = 'cw-print-page-style';
  style.textContent = '@page { size: A4 portrait; margin: 0; }';
  document.head.appendChild(style);
  window.print();
  setTimeout(() => {
    const s = document.getElementById('cw-print-page-style');
    if (s) document.head.removeChild(s);
  }, 1000);
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
    <div className={`cwg-word-card${isUnplaced ? ' is-unplaced' : ''}`}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, paddingTop:1 }}>
        <span className="cwg-num-badge">{word.number}</span>
        <Text style={{ fontSize:10, color:'#64748b', textAlign:'center', lineHeight:1.1 }}>картинок</Text>
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
          onChange={e => onUpdate({ text: e.target.value.toUpperCase().replace(/[^A-ZА-ЯЁ]/g,'') })}
          placeholder="СЛОВО"
          style={{ fontWeight:700, letterSpacing:1.5 }}
          maxLength={20}
        />
        <div className="cwg-word-row">
          <Text style={{ fontSize:12, color:'#64748b' }}>Номер и количество:</Text>
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
          <Text style={{ fontSize:11, color:'#dc2626' }}>
            Нет общих букв с другими словами
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
    <div className="cwg-theme-list">
      {Object.entries(THEMES).map(([key, t]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`cwg-theme-btn${value === key ? ' active' : ''}`}
        >
          <span className="cwg-theme-swatch" style={{ background: t.bg }} />
          {t.name}
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

  const unplacedSet = new Set(unplacedWords);
  const placedCount = layout ? layout.placed.filter(p => !p.unplaced).length : 0;
  const imageCount = words.reduce((sum, w) => sum + (w.imageDataUrl ? Number(w.number || 1) : 0), 0);
  const duplicateNumbers = useMemo(() => {
    const seen = new Map();
    for (const w of words) {
      if (!w.number) continue;
      seen.set(w.number, (seen.get(w.number) || 0) + 1);
    }
    return [...seen.entries()].filter(([, count]) => count > 1).map(([num]) => num);
  }, [words]);

  const handlePrint = () => doPrint();

  return (
    <div className="cwg-page">
      <div className="cwg-topbar">
        <div className="cwg-title-block">
          <span className="cwg-eyebrow">Геймификация</span>
          <Title level={3} style={{ margin:0 }}>Генератор кроссвордов</Title>
          <Text className="cwg-subtitle">
            Соберите слова и картинки. На листе ученик считает одинаковые изображения и вписывает слово под соответствующим номером.
          </Text>
        </div>
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
          <div className="cwg-stats">
            <div className="cwg-stat"><strong>{words.length}</strong><span>слов</span></div>
            <div className="cwg-stat"><strong>{placedCount}</strong><span>в сетке</span></div>
            <div className="cwg-stat"><strong>{imageCount}</strong><span>картинок</span></div>
          </div>

          <div className="cwg-section">
            <div>
              <Text className="cwg-label">Заголовок листа</Text>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Кроссворд"
                maxLength={50}
                size="large"
              />
            </div>
          </div>

          <div className="cwg-section">
            <Text className="cwg-label">Акцент предпросмотра</Text>
            <ThemeSelector value={theme} onChange={setTheme} />
          </div>

          <Divider style={{ margin:'0' }} />

          <div className="cwg-section">
            <div className="cwg-section-head">
              <div>
                <Text strong>Слова</Text>
                <Text type="secondary" style={{ display:'block', fontSize:12 }}>
                  Номер слова равен количеству его картинок на листе.
                </Text>
              </div>
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
                message="Начните с 3-6 слов"
                description="Лучше брать слова с общими буквами. Картинки можно загрузить сразу или позже."
                style={{ fontSize:12 }}
              />
            )}

            {duplicateNumbers.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message={`Повторяются номера: ${duplicateNumbers.join(', ')}`}
                description="Для печати лучше сделать количество картинок уникальным, иначе в сетке будут одинаковые номера."
                style={{ fontSize:12 }}
              />
            )}

            <div className="cwg-word-list">
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

        {/* ── Preview (scaled, screen only) ── */}
        <div className="cwg-preview-col">
          <div className="cwg-preview-head">
            <span>Предпросмотр печати ({Math.round(SCALE * 100)}%)</span>
            <Tag color={showAnswers ? 'blue' : 'default'}>
              {showAnswers ? 'Ответы включены' : 'Лист ученика'}
            </Tag>
          </div>
          <div
            className="cwg-print-wrapper"
            style={{ width: PREVIEW_W, height: Math.round(1123 * SCALE) }}
          >
            <div style={{ transform:`scale(${SCALE})`, transformOrigin:'top left' }}>
              <CrosswordPrintLayout
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

      {/* Печатный layout — всегда в DOM, как в QRWorksheetGenerator */}
      <CrosswordPrintLayout
        className="cw-print-root"
        words={words}
        layout={layout}
        theme={theme}
        title={title}
        showAnswers={showAnswers}
      />
    </div>
  );
}
