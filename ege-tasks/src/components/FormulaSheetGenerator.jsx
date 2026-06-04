import { useState, useEffect } from 'react';
import { printPaged } from '../utils/printPage';
import {
  Button, Input, InputNumber, Space, Tooltip, Select,
  Modal, List, Popconfirm, message, Radio,
} from 'antd';
const { TextArea } = Input;
import {
  PlusOutlined, DeleteOutlined, PrinterOutlined, FunctionOutlined,
  ArrowUpOutlined, ArrowDownOutlined, SaveOutlined, FolderOpenOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import katex from 'katex';
import { api } from '../services/pocketbase';
import FormulaSheetPrintLayout from './trig/FormulaSheetPrintLayout';
import {
  TrigGeneratorLayout,
  TrigSettingsSection,
  TrigActions,
} from './trig/TrigGeneratorLayout';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function MathInline({ latex }) {
  if (!latex) return <span style={{ color: '#bbb', fontStyle: 'italic' }}>…</span>;
  let html;
  try {
    html = katex.renderToString(latex, { throwOnError: false, displayMode: false, trust: true });
  } catch {
    html = latex;
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

const SUBJECT_OPTIONS = [
  { value: 'Тригонометрия', label: 'Тригонометрия' },
  { value: 'Алгебра', label: 'Алгебра' },
  { value: 'Геометрия', label: 'Геометрия' },
  { value: 'Математический анализ', label: 'Мат. анализ' },
];

const PRINT_MODE_OPTIONS = [
  { value: 'both',   label: 'Эталон + Проверка' },
  { value: 'etalon', label: 'Только эталон' },
  { value: 'blank',  label: 'Только проверка' },
];

const COPIES_OPTIONS = [
  { value: 1, label: '1 / лист' },
  { value: 2, label: '2 / лист' },
  { value: 4, label: '4 / лист' },
];

// ─── Редактор одной формулы ───────────────────────────────────────────────────
function FormulaEditor({ formula, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  return (
    <div style={{
      padding: '8px 0',
      borderBottom: '1px solid var(--rule-soft)',
    }}>
      {/* Строка 1: KaTeX-превью + кнопки справа */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{
          flex: 1,
          fontFamily: 'Times New Roman, serif',
          fontSize: 15,
          fontStyle: 'italic',
          padding: '5px 10px',
          background: 'var(--bg-sunken)',
          borderRadius: 6,
          minHeight: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <MathInline latex={formula.left} />
          <span style={{ fontStyle: 'normal', color: '#aaa', fontSize: 17 }}>=</span>
          <span style={{
            border: '1.5px solid #bbb',
            borderRadius: 3,
            padding: '1px 7px',
            background: '#fff',
            color: '#222',
          }}>
            <MathInline latex={formula.right} />
          </span>
        </div>

        {/* Кнопки — выровнены по правому краю превью */}
        <Space size={3} style={{ flexShrink: 0 }}>
          <Tooltip title="Вверх" placement="top">
            <Button size="small" icon={<ArrowUpOutlined />} disabled={isFirst} onClick={onMoveUp} />
          </Tooltip>
          <Tooltip title="Вниз" placement="top">
            <Button size="small" icon={<ArrowDownOutlined />} disabled={isLast} onClick={onMoveDown} />
          </Tooltip>
          <Tooltip title="Дублировать" placement="top">
            <Button
              size="small" icon={<CopyOutlined />}
              onClick={() => onChange({ ...formula, id: uid() }, 'duplicate')}
            />
          </Tooltip>
          <Popconfirm title="Удалить формулу?" onConfirm={onDelete} okText="Да" cancelText="Нет">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      </div>

      {/* Строка 2: поля ввода */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--ink-3)', lineHeight: 1 }}>Левая часть</span>
          <TextArea
            autoSize={{ minRows: 1, maxRows: 5 }}
            placeholder="sin^2 x + cos^2 x"
            value={formula.left}
            onChange={e => onChange({ ...formula, left: e.target.value })}
            style={{ fontFamily: 'monospace', fontSize: 13, resize: 'none' }}
          />
        </div>

        <span style={{ paddingTop: 20, color: '#ccc', fontSize: 18, flexShrink: 0 }}>=</span>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--ink-3)', lineHeight: 1 }}>Правая часть (ответ)</span>
          <TextArea
            autoSize={{ minRows: 1, maxRows: 5 }}
            placeholder="1"
            value={formula.right}
            onChange={e => onChange({ ...formula, right: e.target.value })}
            style={{ fontFamily: 'monospace', fontSize: 13, resize: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Редактор секции ──────────────────────────────────────────────────────────
function SectionEditor({ section, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const updateFormula = (idx, updated, action) => {
    const formulas = [...section.formulas];
    if (action === 'duplicate') formulas.splice(idx + 1, 0, updated);
    else formulas[idx] = updated;
    onChange({ ...section, formulas });
  };

  const deleteFormula = (idx) =>
    onChange({ ...section, formulas: section.formulas.filter((_, i) => i !== idx) });

  const moveFormula = (idx, dir) => {
    const formulas = [...section.formulas];
    const t = idx + dir;
    if (t < 0 || t >= formulas.length) return;
    [formulas[idx], formulas[t]] = [formulas[t], formulas[idx]];
    onChange({ ...section, formulas });
  };

  return (
    <div style={{ border: '1px solid var(--rule)', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
      {/* Заголовок */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', background: 'var(--bg-sunken)',
        borderBottom: '1px solid var(--rule)',
      }}>
        <Input
          value={section.title}
          onChange={e => onChange({ ...section, title: e.target.value })}
          placeholder="Название секции (необязательно)"
          style={{ flex: 1, fontWeight: 600, fontSize: 13 }}
          size="small"
        />
        <Space size={2}>
          <Tooltip title="Секцию вверх">
            <Button size="small" icon={<ArrowUpOutlined />} disabled={isFirst} onClick={onMoveUp} />
          </Tooltip>
          <Tooltip title="Секцию вниз">
            <Button size="small" icon={<ArrowDownOutlined />} disabled={isLast} onClick={onMoveDown} />
          </Tooltip>
          <Popconfirm title="Удалить секцию со всеми формулами?" onConfirm={onDelete} okText="Да" cancelText="Нет">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      </div>

      {/* Формулы */}
      <div style={{ padding: '4px 10px 6px' }}>
        {section.formulas.map((f, fi) => (
          <FormulaEditor
            key={f.id}
            formula={f}
            onChange={(updated, action) => updateFormula(fi, updated, action)}
            onDelete={() => deleteFormula(fi)}
            onMoveUp={() => moveFormula(fi, -1)}
            onMoveDown={() => moveFormula(fi, 1)}
            isFirst={fi === 0}
            isLast={fi === section.formulas.length - 1}
          />
        ))}
        <Button
          type="dashed" size="small" icon={<PlusOutlined />}
          onClick={() => onChange({ ...section, formulas: [...section.formulas, { id: uid(), left: '', right: '' }] })}
          style={{ marginTop: 6, width: '100%' }}
        >
          Добавить формулу
        </Button>
      </div>
    </div>
  );
}

// ─── Один экземпляр для экранного превью ─────────────────────────────────────
function PreviewCopy({ title, subtitle, sections, previewMode, twoColFormulas, style }) {
  let n = 1;
  return (
    <div style={{
      fontFamily: 'Times New Roman, serif',
      fontSize: 11,
      lineHeight: 1.35,
      padding: '6px 8px',
      background: '#fff',
      border: '1px solid var(--rule)',
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}>
      {/* Шапка */}
      <div style={{ flexShrink: 0, marginBottom: 4, paddingBottom: 3, borderBottom: '1px solid #555' }}>
        {title && (
          <div style={{ fontWeight: 700, fontStyle: 'italic', textAlign: 'center', fontSize: 12, lineHeight: 1.2 }}>
            {title}
          </div>
        )}
        {subtitle && (
          <div style={{ fontWeight: 600, fontStyle: 'italic', textAlign: 'center', fontSize: 11, lineHeight: 1.2, color: '#333' }}>
            {subtitle}
          </div>
        )}
        {previewMode === 'blank' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 10, color: '#555', alignItems: 'baseline' }}>
            <span style={{ flex: 1 }}>
              Имя:&nbsp;<span style={{ display: 'inline-block', minWidth: 40, borderBottom: '1px solid #000' }} />
            </span>
            <span>Класс:&nbsp;<span style={{ display: 'inline-block', width: 22, borderBottom: '1px solid #000' }} /></span>
            <span>Дата:&nbsp;<span style={{ display: 'inline-block', width: 22, borderBottom: '1px solid #000' }} /></span>
          </div>
        )}
      </div>

      {/* Формулы */}
      <div style={{ flex: 1, overflow: 'hidden', columnCount: twoColFormulas ? 2 : 1, columnGap: 12 }}>
        {sections.map((section, si) => (
          <div key={si} style={{ breakInside: 'avoid-column', marginBottom: 4 }}>
            {section.title && (
              <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 1, paddingBottom: 1, borderBottom: '1px solid #ddd' }}>
                {section.title}
              </div>
            )}
            {section.formulas.map((f, fi) => {
              const num = n++;
              const latex = previewMode === 'etalon'
                ? `${f.left} = \\boxed{${f.right}}`
                : `${f.left} =`;
              return (
                <div key={fi} style={{
                  display: 'flex', alignItems: 'baseline', gap: 3,
                  minHeight: 16, padding: '0.5px 0',
                  borderBottom: '0.5px dotted #eee',
                  breakInside: 'avoid',
                  fontSize: 11,
                }}>
                  <span style={{ fontWeight: 700, minWidth: 16, fontSize: 10, fontStyle: 'normal', flexShrink: 0 }}>
                    {num})
                  </span>
                  <span style={{ fontStyle: 'italic' }}>
                    <MathInline latex={latex} />
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Экранное превью страницы ────────────────────────────────────────────────
function ScreenPreview({ title, subtitle, sections, previewMode, copiesPerPage }) {
  if (!sections.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
        Добавьте секции и формулы слева
      </div>
    );
  }

  // Имитируем A4 пропорции: ширина фиксирована, высота вычисляется
  const pageW = 560;
  const pageH = Math.round(pageW * 297 / 210); // ≈ 792px

  const twoColFormulas = copiesPerPage === 1;
  const copies = Array.from({ length: copiesPerPage });

  // Стиль ячейки в зависимости от режима
  const copyStyle = (() => {
    const gap = 1; // px (имитация разделителя)
    if (copiesPerPage === 1) {
      return { width: '100%', height: '100%' };
    }
    if (copiesPerPage === 2) {
      return { width: `calc(50% - ${gap}px)`, height: '100%' };
    }
    // 4
    return { width: `calc(50% - ${gap}px)`, height: `calc(50% - ${gap}px)` };
  })();

  return (
    <div style={{
      width: pageW,
      height: pageH,
      maxWidth: '100%',
      background: '#f5f5f5',
      border: '1px solid var(--rule)',
      borderRadius: 6,
      overflow: 'hidden',
      padding: 8,   // имитация полей 5мм
      boxSizing: 'border-box',
      margin: '0 auto',
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexWrap: copiesPerPage === 4 ? 'wrap' : 'nowrap',
        gap: 2,
      }}>
        {copies.map((_, i) => (
          <PreviewCopy
            key={i}
            title={title}
            subtitle={subtitle}
            sections={sections}
            previewMode={previewMode}
            twoColFormulas={twoColFormulas}
            style={copyStyle}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Модал загрузки ───────────────────────────────────────────────────────────
function LoadModal({ open, onClose, onLoad }) {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    api.getFormulaSheets().then(data => {
      if (!cancelled) setSheets(data);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  return (
    <Modal title="Загрузить лист формул" open={open} onCancel={onClose} footer={null} width={520}>
      <List
        loading={loading}
        dataSource={sheets}
        locale={{ emptyText: 'Нет сохранённых листов' }}
        renderItem={item => (
          <List.Item
            actions={[
              <Button size="small" type="primary" onClick={() => { onLoad(item); onClose(); }}>
                Загрузить
              </Button>,
              <Popconfirm
                title="Удалить этот лист?"
                onConfirm={async () => {
                  await api.deleteFormulaSheet(item.id);
                  setSheets(prev => prev.filter(s => s.id !== item.id));
                }}
                okText="Да" cancelText="Нет"
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={item.title}
              description={[
                item.subtitle, item.subject,
                item.class_number ? `${item.class_number} кл.` : '',
              ].filter(Boolean).join(' · ')}
            />
          </List.Item>
        )}
      />
    </Modal>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function FormulaSheetGenerator() {
  const [title, setTitle] = useState('ТДФ по формулам тригонометрии');
  const [subtitle, setSubtitle] = useState('10 класс — база');
  const [subject, setSubject] = useState('Тригонометрия');
  const [classNumber, setClassNumber] = useState(10);
  const [sections, setSections] = useState([
    {
      id: uid(),
      title: 'Основные формулы',
      formulas: [
        { id: uid(), left: '\\sin^2 x + \\cos^2 x', right: '1' },
        { id: uid(), left: '1 - \\sin^2 x', right: '\\cos^2 x' },
        { id: uid(), left: '1 + \\tg^2 x', right: '\\dfrac{1}{\\cos^2 x}' },
        { id: uid(), left: '\\sin 2x', right: '2\\sin x \\cos x' },
        { id: uid(), left: '\\cos 2x', right: '\\cos^2 x - \\sin^2 x' },
      ],
    },
  ]);
  const [printMode, setPrintMode] = useState('both');
  const [copiesPerPage, setCopiesPerPage] = useState(2);
  const [previewMode, setPreviewMode] = useState('etalon');
  const [savedId, setSavedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);

  const updateSection = (idx, updated) =>
    setSections(prev => prev.map((s, i) => i === idx ? updated : s));
  const deleteSection = (idx) =>
    setSections(prev => prev.filter((_, i) => i !== idx));
  const moveSection = (idx, dir) =>
    setSections(prev => {
      const arr = [...prev];
      const t = idx + dir;
      if (t < 0 || t >= arr.length) return arr;
      [arr[idx], arr[t]] = [arr[t], arr[idx]];
      return arr;
    });
  const addSection = () =>
    setSections(prev => [...prev, { id: uid(), title: '', formulas: [{ id: uid(), left: '', right: '' }] }]);

  const handleSave = async () => {
    if (!title.trim()) { message.warning('Укажите название листа'); return; }
    setSaving(true);
    try {
      const payload = { title, subtitle, subject, class_number: classNumber || null, sections: JSON.stringify(sections) };
      if (savedId) {
        await api.updateFormulaSheet(savedId, payload);
      } else {
        const result = await api.createFormulaSheet(payload);
        setSavedId(result.id);
      }
      message.success('Сохранено');
    } catch { message.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const handleLoad = (item) => {
    setTitle(item.title || '');
    setSubtitle(item.subtitle || '');
    setSubject(item.subject || '');
    setClassNumber(item.class_number || null);
    const sec = typeof item.sections === 'string' ? JSON.parse(item.sections) : item.sections;
    setSections(sec || []);
    setSavedId(item.id);
  };

  const handlePrint = () => printPaged({ margin: '5mm' });

  const totalFormulas = sections.reduce((s, sec) => s + sec.formulas.length, 0);
  const hasContent = totalFormulas > 0;

  return (
    <>
      <TrigGeneratorLayout
        icon={<FunctionOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Название листа"
        leftWidth="1fr"
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10, overflowY: 'auto' }}>

            <TrigSettingsSection label="Параметры">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 3 }}>Подзаголовок</div>
                  <Input
                    size="small" value={subtitle}
                    onChange={e => setSubtitle(e.target.value)}
                    placeholder="10 класс — база"
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 3 }}>Предмет</div>
                    <Select
                      size="small" style={{ width: '100%' }}
                      value={subject} onChange={setSubject}
                      options={SUBJECT_OPTIONS} allowClear placeholder="Предмет"
                    />
                  </div>
                  <div style={{ width: 70 }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 3 }}>Класс</div>
                    <InputNumber
                      size="small" style={{ width: '100%' }}
                      min={1} max={12} value={classNumber}
                      onChange={setClassNumber} placeholder="10"
                    />
                  </div>
                </div>
              </div>
            </TrigSettingsSection>

            <TrigSettingsSection label="Печать">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>Что печатать</div>
                  <Radio.Group
                    size="small" value={printMode}
                    onChange={e => setPrintMode(e.target.value)}
                    options={PRINT_MODE_OPTIONS}
                    optionType="button" buttonStyle="solid"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>Копий на листе A4</div>
                  <Radio.Group
                    size="small" value={copiesPerPage}
                    onChange={e => setCopiesPerPage(e.target.value)}
                    options={COPIES_OPTIONS}
                    optionType="button" buttonStyle="solid"
                  />
                </div>
              </div>
            </TrigSettingsSection>

            <TrigSettingsSection
              label={`Секции и формулы${totalFormulas ? ` (${totalFormulas})` : ''}`}
              style={{ flex: 1 }}
            >
              {sections.map((sec, si) => (
                <SectionEditor
                  key={sec.id}
                  section={sec}
                  onChange={updated => updateSection(si, updated)}
                  onDelete={() => deleteSection(si)}
                  onMoveUp={() => moveSection(si, -1)}
                  onMoveDown={() => moveSection(si, 1)}
                  isFirst={si === 0}
                  isLast={si === sections.length - 1}
                />
              ))}
              <Button type="dashed" block icon={<PlusOutlined />} onClick={addSection}>
                Добавить секцию
              </Button>
            </TrigSettingsSection>

            <TrigActions>
              {hasContent && (
                <Button type="primary" block icon={<PrinterOutlined />} onClick={handlePrint}>
                  Распечатать
                </Button>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <Button block icon={<SaveOutlined />} onClick={handleSave} loading={saving} disabled={!hasContent}>
                  {savedId ? 'Обновить' : 'Сохранить'}
                </Button>
                <Button block icon={<FolderOpenOutlined />} onClick={() => setLoadModalOpen(true)}>
                  Загрузить
                </Button>
              </div>
            </TrigActions>
          </div>
        }
        right={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Превью:</span>
              <Radio.Group
                size="small" value={previewMode}
                onChange={e => setPreviewMode(e.target.value)}
              >
                <Radio.Button value="etalon">Эталон</Radio.Button>
                <Radio.Button value="blank">Проверка</Radio.Button>
              </Radio.Group>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
              <ScreenPreview
                title={title}
                subtitle={subtitle}
                sections={sections}
                previewMode={previewMode}
                copiesPerPage={copiesPerPage}
              />
            </div>
          </div>
        }
      />

      <FormulaSheetPrintLayout
        title={title}
        subtitle={subtitle}
        sections={sections}
        printMode={printMode}
        copiesPerPage={copiesPerPage}
      />

      <LoadModal
        open={loadModalOpen}
        onClose={() => setLoadModalOpen(false)}
        onLoad={handleLoad}
      />
    </>
  );
}
