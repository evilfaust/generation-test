import React, { useState, useCallback, useMemo } from 'react';
import { MathInline } from './shared/MathInline';
import {
  Button, Switch, Slider, Select, Checkbox, Space, Input, Row, Col, Typography, InputNumber, Tabs, Dropdown, Divider,
} from 'antd';
import {
  PrinterOutlined, ThunderboltOutlined, FunctionOutlined,
  HolderOutlined, DeleteOutlined, PlusOutlined,
} from '@ant-design/icons';
import { SplitLayout, ConfigLabel } from '../ui';
import UnitCircleSVG from './trig/UnitCircleSVG';
import TrigMixedPrintLayout from './trig/TrigMixedPrintLayout';
import { SheetLayoutOptions, SHEET_DEFAULTS } from './trig/sheetOptions';
import { TRIG_TYPES, getTrigType } from '../hooks/trigMixedRegistry';

const { Text } = Typography;


// ─── Уникальный id для секции ────────────────────────────────────────────────
let _sectionCounter = 0;
const nextSectionId = () => `s${Date.now()}-${++_sectionCounter}`;

function makeSection(type) {
  const meta = getTrigType(type);
  if (!meta) return null;
  return { id: nextSectionId(), type, ...meta.defaultCfg };
}

// ─── Настройки одного раздела ─────────────────────────────────────────────────
function SectionSettings({ section, onChange }) {
  const set = (k, v) => onChange({ ...section, [k]: v });
  const id = section.type;
  const cfg = section;

  if (id === 'trigExpressions') {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Заданий:</Text></Col>
          <Col>
            <InputNumber min={2} max={12} value={cfg.questionsCount}
              onChange={v => set('questionsCount', v)} size="small" style={{ width: 60 }} />
          </Col>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Тип:</Text></Col>
          <Col>
            <Select size="small" value={cfg.taskType} onChange={v => set('taskType', v)}
              style={{ width: 110 }}
              options={[
                { value: 'sum',     label: 'Суммы' },
                { value: 'product', label: 'Произведения' },
                { value: 'mixed',   label: 'Смешанные' },
              ]}
            />
          </Col>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Термов:</Text></Col>
          <Col>
            <InputNumber min={2} max={4} value={cfg.termsCount}
              onChange={v => set('termsCount', v)} size="small" style={{ width: 55 }} />
          </Col>
        </Row>
        <Row gutter={8} align="middle">
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Функции:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'sin', value: 'sin' },
                { label: 'cos', value: 'cos' },
                { label: 'tg',  value: 'tan' },
                { label: 'ctg', value: 'cot' },
              ]}
              value={[cfg.useSin && 'sin', cfg.useCos && 'cos', cfg.useTan && 'tan', cfg.useCot && 'cot'].filter(Boolean)}
              onChange={vals => onChange({
                ...cfg,
                useSin: vals.includes('sin'),
                useCos: vals.includes('cos'),
                useTan: vals.includes('tan'),
                useCot: vals.includes('cot'),
              })}
            />
          </Col>
        </Row>
      </Space>
    );
  }

  if (id === 'inverseTrig') {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Заданий:</Text></Col>
          <Col>
            <InputNumber min={2} max={12} value={cfg.questionsCount}
              onChange={v => set('questionsCount', v)} size="small" style={{ width: 60 }} />
          </Col>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Тип:</Text></Col>
          <Col>
            <Select size="small" value={cfg.taskType} onChange={v => set('taskType', v)}
              style={{ width: 110 }}
              options={[
                { value: 'basic',  label: 'Простые' },
                { value: 'sum',    label: 'Суммы' },
                { value: 'nested', label: 'Вложенные' },
                { value: 'mixed',  label: 'Смешанные' },
              ]}
            />
          </Col>
        </Row>
        <Row gutter={8} align="middle">
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Функции:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'arcsin', value: 'arcsin' },
                { label: 'arccos', value: 'arccos' },
                { label: 'arctg',  value: 'arctan' },
                { label: 'arcctg', value: 'arccot' },
              ]}
              value={[
                cfg.useArcsin && 'arcsin', cfg.useArccos && 'arccos',
                cfg.useArctan && 'arctan', cfg.useArccot && 'arccot',
              ].filter(Boolean)}
              onChange={vals => onChange({
                ...cfg,
                useArcsin: vals.includes('arcsin'),
                useArccos: vals.includes('arccos'),
                useArctan: vals.includes('arctan'),
                useArccot: vals.includes('arccot'),
              })}
            />
          </Col>
        </Row>
      </Space>
    );
  }

  if (id === 'reductionFormulas') {
    const RF_TYPES = [
      { value: 'basic',    label: 'Формулы приведения',    desc: 'sin(π/2 + α) = ?' },
      { value: 'reversed', label: 'Перевёрнутый аргумент', desc: 'cos(α − π/2) = ?' },
      { value: 'numeric',  label: 'Числовые выражения',    desc: '14√3·cos750° = ?' },
    ];
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Заданий:</Text></Col>
          <Col>
            <InputNumber min={2} max={12} value={cfg.tasksPerVariant}
              onChange={v => set('tasksPerVariant', v)} size="small" style={{ width: 60 }} />
          </Col>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Углы:</Text></Col>
          <Col>
            <Select size="small" value={cfg.angleMode} onChange={v => set('angleMode', v)}
              style={{ width: 110 }}
              options={[
                { value: 'radians', label: 'Радианы' },
                { value: 'degrees', label: 'Градусы' },
                { value: 'both',    label: 'Смешанно' },
              ]}
            />
          </Col>
        </Row>
        <Space direction="vertical" size={2}>
          {RF_TYPES.map(o => (
            <div key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Checkbox
                checked={cfg.taskTypes.includes(o.value)}
                onChange={e => {
                  const next = e.target.checked
                    ? [...cfg.taskTypes, o.value]
                    : cfg.taskTypes.filter(t => t !== o.value);
                  if (next.length) set('taskTypes', next);
                }}
              >
                <Text style={{ fontSize: 12 }}>{o.label}</Text>
              </Checkbox>
              <Text type="secondary" style={{ fontSize: 11 }}>{o.desc}</Text>
            </div>
          ))}
        </Space>
      </Space>
    );
  }

  if (id === 'additionFormulas') {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Заданий:</Text></Col>
          <Col>
            <InputNumber min={2} max={12} value={cfg.tasksPerVariant}
              onChange={v => set('tasksPerVariant', v)} size="small" style={{ width: 60 }} />
          </Col>
        </Row>
        <Row gutter={8} align="middle">
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Типы:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'Числовые',    value: 'formula_eval' },
                { label: 'Символьные',  value: 'symbolic' },
                { label: 'Нестандарт.', value: 'nonstandard' },
              ]}
              value={cfg.taskTypes}
              onChange={vals => set('taskTypes', vals)}
            />
          </Col>
        </Row>
        <Row gutter={8} align="middle">
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Функции:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'sin', value: 'sin' },
                { label: 'cos', value: 'cos' },
                { label: 'tg',  value: 'tan' },
              ]}
              value={cfg.funcs}
              onChange={vals => set('funcs', vals)}
            />
          </Col>
        </Row>
      </Space>
    );
  }

  if (id === 'trigEquations') {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Заданий:</Text></Col>
          <Col>
            <InputNumber min={2} max={12} value={cfg.questionsCount}
              onChange={v => set('questionsCount', v)} size="small" style={{ width: 60 }} />
          </Col>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Функции:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'sin t=a', value: 'sin' },
                { label: 'cos t=a', value: 'cos' },
                { label: 'tg t=a',  value: 'tan' },
                { label: 'ctg t=a', value: 'cot' },
              ]}
              value={[cfg.useSin && 'sin', cfg.useCos && 'cos', cfg.useTan && 'tan', cfg.useCot && 'cot'].filter(Boolean)}
              onChange={vals => onChange({
                ...cfg,
                useSin: vals.includes('sin'),
                useCos: vals.includes('cos'),
                useTan: vals.includes('tan'),
                useCot: vals.includes('cot'),
              })}
            />
          </Col>
        </Row>
      </Space>
    );
  }

  if (id === 'doubleAngle') {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Заданий:</Text></Col>
          <Col>
            <InputNumber min={2} max={12} value={cfg.tasksPerVariant}
              onChange={v => set('tasksPerVariant', v)} size="small" style={{ width: 60 }} />
          </Col>
        </Row>
        <Row gutter={8} align="middle">
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Типы:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'Числовые',     value: 'numeric' },
                { label: 'Символьные',   value: 'symbolic' },
                { label: 'Распознавание', value: 'mixed' },
              ]}
              value={cfg.taskTypes}
              onChange={vals => set('taskTypes', vals)}
            />
          </Col>
        </Row>
        <Row gutter={8} align="middle">
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Функции:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'sin', value: 'sin' },
                { label: 'cos', value: 'cos' },
                { label: 'tg',  value: 'tan' },
              ]}
              value={cfg.funcs}
              onChange={vals => set('funcs', vals)}
            />
          </Col>
        </Row>
      </Space>
    );
  }

  if (id === 'trigEquationsAdvanced') {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Заданий:</Text></Col>
          <Col>
            <InputNumber min={2} max={12} value={cfg.questionsCount}
              onChange={v => set('questionsCount', v)} size="small" style={{ width: 60 }} />
          </Col>
        </Row>
        <Row gutter={8} align="middle">
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Типы:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'f(kx) = a',      value: 'type1' },
                { label: 'A·f(kx+b) = c',  value: 'type2' },
              ]}
              value={[cfg.useType1 && 'type1', cfg.useType2 && 'type2'].filter(Boolean)}
              onChange={vals => onChange({ ...cfg, useType1: vals.includes('type1'), useType2: vals.includes('type2') })}
            />
          </Col>
        </Row>
      </Space>
    );
  }

  if (id === 'unitCircle') {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Окружностей:</Text></Col>
          <Col>
            <Select size="small" value={cfg.circlesPerPage} onChange={v => set('circlesPerPage', v)}
              style={{ width: 55 }}
              options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 4, label: '4' }]}
            />
          </Col>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Точек:</Text></Col>
          <Col>
            <InputNumber min={4} max={12} value={cfg.pointsPerCircle}
              onChange={v => set('pointsPerCircle', v)} size="small" style={{ width: 55 }} />
          </Col>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Тип:</Text></Col>
          <Col>
            <Select size="small" value={cfg.taskType} onChange={v => set('taskType', v)}
              style={{ width: 110 }}
              options={[
                { value: 'direct',  label: 'Прямая' },
                { value: 'inverse', label: 'Обратная' },
                { value: 'mixed',   label: 'Смешанная' },
              ]}
            />
          </Col>
        </Row>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Оси:</Text></Col>
          <Col>
            <Select size="small" value={cfg.showAxes} onChange={v => set('showAxes', v)}
              style={{ width: 100 }}
              options={[
                { value: 'none', label: 'Нет' },
                { value: 'axes', label: 'Оси' },
                { value: 'all',  label: 'Все' },
              ]}
            />
          </Col>
          <Col>
            <Checkbox checked={cfg.showTicks} onChange={e => set('showTicks', e.target.checked)}>
              <Text style={{ fontSize: 12 }}>Засечки</Text>
            </Checkbox>
          </Col>
          <Col>
            <Checkbox checked={cfg.showDegrees} onChange={e => set('showDegrees', e.target.checked)}>
              <Text style={{ fontSize: 12 }}>Градусы</Text>
            </Checkbox>
          </Col>
        </Row>
      </Space>
    );
  }

  return null;
}

// ─── Карточка одного раздела ──────────────────────────────────────────────────
function SectionCard({ section, onUpdate, onRemove, onDragStart, onDragOver, onDrop, onDragEnd, isDragging, isDropTarget }) {
  const meta = getTrigType(section.type);
  if (!meta) return null;

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, section.id)}
      onDragOver={e => onDragOver(e, section.id)}
      onDrop={e => onDrop(e, section.id)}
      onDragEnd={onDragEnd}
      style={{
        padding: '8px 12px',
        border: `1px solid ${isDropTarget ? 'var(--accent)' : 'var(--accent)'}`,
        borderRadius: 'var(--radius)',
        background: 'var(--accent-soft)',
        opacity: isDragging ? 0.5 : 1,
        transition: 'opacity .15s, border-color .15s, background .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <HolderOutlined style={{ color: 'var(--ink-4)', cursor: 'grab', fontSize: 13, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, flex: 1 }}>
          {meta.label}
        </span>
        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onRemove(section.id)} />
      </div>
      <div style={{ marginTop: 8, paddingLeft: 22 }}>
        <SectionSettings section={section} onChange={onUpdate} />
        {section.type !== 'unitCircle' && (
          <div style={{ marginTop: 4 }}>
            <Checkbox
              checked={!!section.twoColumns}
              onChange={e => onUpdate({ ...section, twoColumns: e.target.checked })}
              style={{ fontSize: 12 }}
            >
              2 колонки
            </Checkbox>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function TrigMixedGenerator() {
  const [workTitle,        setWorkTitle]        = useState('Проверочная работа по тригонометрии');
  const [variantsCount,    setVariantsCount]    = useState(4);
  const [showSectionHeaders, setShowSectionHeaders] = useState(false);
  const [showWorkSpace,    setShowWorkSpace]    = useState(false);
  const [workSpaceSize,    setWorkSpaceSize]    = useState(25);
  const [showTeacherKey,   setShowTeacherKey]   = useState(true);
  // Общие настройки листа (шапка, класс, название, интервал)
  const [sheet, setSheet] = useState({ ...SHEET_DEFAULTS });
  const updateSheet = (k, v) => setSheet(p => ({ ...p, [k]: v }));
  const [twoPerPage,       setTwoPerPage]       = useState(false);

  const [sections, setSections] = useState(() => [
    makeSection('trigExpressions'),
    makeSection('trigEquations'),
  ]);
  const [generated, setGenerated] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const addMenuItems = TRIG_TYPES.map(t => ({ key: t.type, label: t.label }));

  const addSection = (type) => {
    const s = makeSection(type);
    if (s) setSections(prev => [...prev, s]);
  };
  const updateSection = (newSec) => {
    setSections(prev => prev.map(s => s.id === newSec.id ? newSec : s));
  };
  const removeSection = (id) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) {
      setDragId(null); setDragOverId(null);
      return;
    }
    setSections(prev => {
      const next = [...prev];
      const fromIdx = next.findIndex(s => s.id === dragId);
      const toIdx = next.findIndex(s => s.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragId(null); setDragOverId(null);
  };
  const handleDragEnd = () => { setDragId(null); setDragOverId(null); };

  // ─── Генерация ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    const perSection = sections.map(sec => {
      const meta = getTrigType(sec.type);
      if (!meta) return null;
      const { id, type, twoColumns, ...settings } = sec;
      const variants = meta.generator({ variantsCount, ...settings });
      return { sec, meta, variants };
    }).filter(Boolean);

    const mixed = Array.from({ length: variantsCount }, (_, vi) => ({
      number: vi + 1,
      sections: perSection.map(({ sec, meta, variants }) => {
        const isUC = sec.type === 'unitCircle';
        return {
          id:           sec.type,
          label:        meta.label,
          instruction:  meta.instruction,
          questionMode: meta.questionMode,
          tasks:        variants[vi] || [],
          ucSettings:   isUC ? sec : undefined,
          twoColumns:   !isUC && (sec.twoColumns || false),
        };
      }),
    }));
    setGenerated(mixed);
  }, [sections, variantsCount]);

  const handleReset = useCallback(() => {
    setGenerated(null);
  }, []);

  const handlePrint = useCallback(() => {
    const style = document.createElement('style');
    style.id = 'tmixed-print-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const s = document.getElementById('tmixed-print-page-style');
      if (s) s.remove();
    }, 1500);
  }, []);

  const printSettings = {
    showSectionHeaders,
    showWorkSpace,
    workSpaceSize,
    showTeacherKey,
    twoPerPage,
    ...sheet,
  };

  const totalTasks = useMemo(() => {
    return sections.reduce((s, x) => {
      const c = x.questionsCount ?? x.tasksPerVariant ?? (x.circlesPerPage || 0);
      return s + (c || 0);
    }, 0);
  }, [sections]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--rule)', marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FunctionOutlined style={{ fontSize: 14 }} />
        </div>
        <Input
          value={workTitle}
          onChange={e => setWorkTitle(e.target.value)}
          placeholder="Название работы"
          style={{ flex: 1, fontWeight: 500 }}
        />
      </div>

      <SplitLayout leftWidth={360} gap={20} style={{ flex: 1, minHeight: 0 }}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 10 }}>

            <div style={{ padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius)', border: '1px solid var(--rule-soft)' }}>
              <ConfigLabel>Настройки</ConfigLabel>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Вариантов: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{variantsCount}</b>
              </div>
              <Slider
                min={1} max={30} value={variantsCount}
                onChange={setVariantsCount}
                marks={{ 1: '1', 2: '2', 4: '4', 8: '8', 12: '12', 20: '20', 30: '30' }}
                size="small"
              />
            </div>

            <div style={{ fontSize: 10.5, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Разделы · {sections.length} · перетащите для сортировки
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, margin: '0 -4px', padding: '0 4px 4px' }}>
              {sections.map(sec => (
                <SectionCard
                  key={sec.id}
                  section={sec}
                  onUpdate={updateSection}
                  onRemove={removeSection}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  isDragging={dragId === sec.id}
                  isDropTarget={dragOverId === sec.id && dragId !== sec.id}
                />
              ))}
              <Dropdown menu={{ items: addMenuItems, onClick: ({ key }) => addSection(key) }} trigger={['click']}>
                <Button block icon={<PlusOutlined />} type="dashed">
                  Добавить раздел
                </Button>
              </Dropdown>
            </div>

            <div style={{ padding: '10px 12px', background: 'var(--bg-sunken)', border: '1px solid var(--rule-soft)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ConfigLabel>Параметры печати</ConfigLabel>
              {[
                ['Заголовки разделов', showSectionHeaders, setShowSectionHeaders],
                ['2 варианта на стр.', twoPerPage, setTwoPerPage],
                ['Лист ответов', showTeacherKey, setShowTeacherKey],
                ['Место для решения', showWorkSpace, setShowWorkSpace],
              ].map(([label, val, setter]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</span>
                  <Switch size="small" checked={val} onChange={setter} />
                </div>
              ))}
              {showWorkSpace && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>
                    Высота: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{workSpaceSize} мм</b>
                  </div>
                  <Slider
                    min={10} max={80} value={workSpaceSize}
                    onChange={setWorkSpaceSize}
                    marks={{ 10: '10', 30: '30', 50: '50', 80: '80' }}
                    size="small"
                  />
                </div>
              )}
              <Divider style={{ margin: '10px 0' }} />
              <SheetLayoutOptions settings={sheet} onChange={updateSheet} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Button
                type="primary" block
                icon={<ThunderboltOutlined />}
                onClick={handleGenerate}
                disabled={!sections.length}
              >
                Сформировать
              </Button>
              {generated && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button block icon={<PrinterOutlined />} onClick={handlePrint} style={{ flex: 1 }}>
                    Печать
                  </Button>
                  <Button block onClick={handleReset} style={{ flex: 1 }}>
                    Сбросить
                  </Button>
                </div>
              )}
            </div>
          </div>
        }
        right={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {!generated ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-3)' }}>
                <FunctionOutlined style={{ fontSize: 32, marginBottom: 12, color: 'var(--ink-4)' }} />
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-3)' }}>
                  Настройте разделы и нажмите «Сформировать»
                </div>
                <div style={{ fontSize: 12, marginTop: 8, color: 'var(--ink-4)' }}>
                  Разделов: {sections.length} · Заданий в варианте: {totalTasks}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, letterSpacing: '-0.025em', color: 'var(--ink)' }}>
                      Предпросмотр
                    </h2>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)', padding: '2px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--rule)' }}>
                      {variantsCount} вар.
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--lvl-1)', padding: '2px 8px', background: 'var(--c-teal-soft)', borderRadius: 'var(--radius-sm)' }}>
                    {generated[0]?.sections.reduce((n, s) => n + s.tasks.length, 0)} задач
                  </span>
                </div>
                <Tabs
                  size="small"
                  style={{ flex: 1, minHeight: 0 }}
                  items={generated.map((variant, vi) => ({
                    key: String(vi),
                    label: `Вариант ${variant.number}`,
                    children: (
                      <div style={{ overflow: 'auto' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                          {variant.sections.map((sec, si) => {
                            let startIdx = 1;
                            for (let k = 0; k < si; k++) startIdx += variant.sections[k].tasks.length;
                            return (
                              <div key={si}>
                                <div style={{
                                  fontSize: 11, fontWeight: 600, color: 'var(--ink-3)',
                                  textTransform: 'uppercase', letterSpacing: '0.09em',
                                  paddingBottom: 6, borderBottom: '1px solid var(--rule)',
                                  marginBottom: 8,
                                }}>
                                  {sec.label}
                                </div>
                                {sec.questionMode === 'unitcircle' ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '4px 0' }}>
                                    {sec.tasks.map((task, ti) => (
                                      <div key={ti} style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                                          {startIdx + ti})
                                        </div>
                                        <div style={{ width: 100, height: 100 }}>
                                          <UnitCircleSVG
                                            points={task.points}
                                            taskType={task.type}
                                            isAnswer={false}
                                            showAxes={sec.ucSettings?.showAxes ?? 'axes'}
                                            showDegrees={sec.ucSettings?.showDegrees ?? false}
                                            showTicks={sec.ucSettings?.showTicks ?? true}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ border: '1px solid var(--rule-soft)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                                    {sec.tasks.map((q, qi) => (
                                      <div key={qi} style={{
                                        display: 'flex', alignItems: 'baseline', gap: 6,
                                        padding: '5px 12px',
                                        borderBottom: qi < sec.tasks.length - 1 ? '1px dotted var(--rule-soft)' : 'none',
                                        fontSize: 13,
                                      }}>
                                        <span style={{ fontWeight: 600, minWidth: 20, color: 'var(--ink-3)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                                          {startIdx + qi})
                                        </span>
                                        <span style={{ flex: 1 }}>
                                          <MathInline latex={q.exprLatex} />
                                        </span>
                                        <span style={{ color: 'var(--rule)', padding: '0 4px', flexShrink: 0 }}>
                                          {sec.questionMode === 'twoLine' ? 't =' : '='}
                                        </span>
                                        <span style={{ color: 'var(--accent)', fontStyle: 'italic', fontWeight: 500, flexShrink: 0 }}>
                                          <MathInline latex={q.resultLatex} />
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ),
                  }))}
                />
              </div>
            )}
          </div>
        }
      />

      <TrigMixedPrintLayout
        variants={generated || []}
        title={workTitle}
        settings={printSettings}
      />
    </div>
  );
}
