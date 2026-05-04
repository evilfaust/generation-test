import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Checkbox, Progress, Space, Spin, Tag, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined, RedoOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import MathRenderer from '../../shared/components/MathRenderer';
import './TDFFlashcards.css';

const { Text, Title } = Typography;

const TYPE_LABELS = {
  theorem: 'Теорема', definition: 'Определение', formula: 'Формула',
  axiom: 'Аксиома', property: 'Свойство', criterion: 'Признак', corollary: 'Следствие',
};
const TYPE_COLORS = {
  theorem: 'blue', definition: 'green', formula: 'purple', axiom: 'orange',
  property: 'cyan', criterion: 'magenta', corollary: 'gold',
};
const ALL_TYPES = Object.keys(TYPE_LABELS);

// Локальное хранилище прогресса по набору
function loadProgress(setId) {
  try {
    const raw = localStorage.getItem(`tdf-flashcards-${setId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveProgress(setId, data) {
  try {
    localStorage.setItem(`tdf-flashcards-${setId}`, JSON.stringify(data));
  } catch {}
}

// Карточка (3D flip)
function FlashCard({ item, isFlipped, onFlip }) {
  const drawingUrl = item.drawing_image
    ? api.getTdfItemDrawingUrl(item)
    : null;

  return (
    <div
      className={`tdf-flashcard ${isFlipped ? 'tdf-flashcard--flipped' : ''}`}
      onClick={onFlip}
      role="button"
      aria-label="Перевернуть карточку"
    >
      <div className="tdf-flashcard-inner">
        {/* Лицевая сторона: вопрос */}
        <div className="tdf-flashcard-front">
          <div className="tdf-flashcard-type">
            <Tag color={TYPE_COLORS[item.type] || 'default'}>
              {TYPE_LABELS[item.type] || item.type}
            </Tag>
            {item.name && <span className="tdf-flashcard-name">{item.name}</span>}
          </div>
          {item.formulation_md && (
            <div className="tdf-flashcard-content">
              <MathRenderer content={item.formulation_md} />
            </div>
          )}
          {!item.formulation_md && (
            <Text type="secondary">Нет формулировки</Text>
          )}
          <div className="tdf-flashcard-hint">нажмите, чтобы увидеть краткую запись и чертёж</div>
        </div>

        {/* Обратная сторона: ответ */}
        <div className="tdf-flashcard-back">
          <div className="tdf-flashcard-type">
            <Tag color={TYPE_COLORS[item.type] || 'default'}>
              {TYPE_LABELS[item.type] || item.type}
            </Tag>
            {item.name && <span className="tdf-flashcard-name">{item.name}</span>}
          </div>
          <div className="tdf-flashcard-content">
            {item.formulation_md ? (
              <MathRenderer content={item.formulation_md} />
            ) : (
              <Text type="secondary">Нет формулировки</Text>
            )}
          </div>
          {item.short_notation_md && (
            <div className="tdf-flashcard-short-notation">
              <div className="tdf-flashcard-short-label">Краткая запись:</div>
              <MathRenderer content={item.short_notation_md} />
            </div>
          )}
          {drawingUrl && (
            <div className="tdf-flashcard-drawing">
              <img src={drawingUrl} alt="Чертёж" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 4 }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Экран настроек сессии
function SettingsScreen({ tdfSet, items, onStart, savedProgress }) {
  const [filterTypes, setFilterTypes] = useState(ALL_TYPES);
  const [shuffled, setShuffled] = useState(true);
  const [onlyUnknown, setOnlyUnknown] = useState(false);

  const available = useMemo(() => {
    let result = items.filter(it => !it.is_section_header && filterTypes.includes(it.type));
    if (onlyUnknown) {
      result = result.filter(it => savedProgress[it.id] !== 'know');
    }
    return result;
  }, [items, filterTypes, onlyUnknown, savedProgress]);

  const knownCount = useMemo(
    () => items.filter(it => !it.is_section_header && savedProgress[it.id] === 'know').length,
    [items, savedProgress]
  );
  const totalItems = items.filter(it => !it.is_section_header).length;

  return (
    <div className="tdf-flashcards-settings">
      <Title level={4} style={{ marginBottom: 4 }}>{tdfSet?.title || 'Карточки'}</Title>
      {tdfSet?.class_number && (
        <Tag style={{ marginBottom: 16 }}>{tdfSet.class_number} класс</Tag>
      )}

      {totalItems > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Прогресс: знаю {knownCount} из {totalItems}</Text>
          <Progress
            percent={Math.round((knownCount / totalItems) * 100)}
            size="small"
            strokeColor="#52c41a"
            style={{ margin: '4px 0 0' }}
          />
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Типы пунктов:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ALL_TYPES.map(type => (
            <Tag.CheckableTag
              key={type}
              checked={filterTypes.includes(type)}
              onChange={(checked) =>
                setFilterTypes(prev =>
                  checked ? [...prev, type] : prev.filter(t => t !== type)
                )
              }
            >
              {TYPE_LABELS[type]}
            </Tag.CheckableTag>
          ))}
        </div>
      </div>

      <Space direction="vertical" size={8} style={{ marginBottom: 20 }}>
        <Checkbox checked={shuffled} onChange={e => setShuffled(e.target.checked)}>
          Перемешать карточки
        </Checkbox>
        <Checkbox
          checked={onlyUnknown}
          onChange={e => setOnlyUnknown(e.target.checked)}
          disabled={knownCount === 0}
        >
          Только «не знаю» ({items.filter(it => !it.is_section_header && savedProgress[it.id] === 'dont-know').length})
        </Checkbox>
      </Space>

      <Button
        type="primary"
        size="large"
        disabled={available.length === 0}
        onClick={() => onStart({ filtered: available, shuffled })}
        block
      >
        Начать ({available.length} карточек)
      </Button>
    </div>
  );
}

// Экран результатов
function ResultsScreen({ deck, results, onRestart, onRestartUnknown, onBack }) {
  const knownCount = Object.values(results).filter(v => v === 'know').length;
  const total = deck.length;
  const pct = total > 0 ? Math.round((knownCount / total) * 100) : 0;

  const unknown = deck.filter(item => results[item.id] !== 'know');

  return (
    <div className="tdf-flashcards-results">
      <Title level={4}>Результаты</Title>

      <div style={{ marginBottom: 20 }}>
        <Progress
          type="circle"
          percent={pct}
          strokeColor={pct >= 70 ? '#52c41a' : pct >= 40 ? '#faad14' : '#ff4d4f'}
        />
        <div style={{ marginTop: 12, fontSize: 15 }}>
          <Text strong>{knownCount}</Text>
          <Text type="secondary"> из </Text>
          <Text strong>{total}</Text>
          <Text type="secondary"> — знаю</Text>
        </div>
      </div>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {unknown.length > 0 && (
          <Button
            type="primary"
            icon={<RedoOutlined />}
            onClick={onRestartUnknown}
            block
          >
            Повторить «не знаю» ({unknown.length})
          </Button>
        )}
        <Button icon={<RedoOutlined />} onClick={onRestart} block>
          Начать заново
        </Button>
        <Button icon={<SettingOutlined />} onClick={onBack} block>
          Настройки
        </Button>
      </Space>
    </div>
  );
}

// Экран выбора набора (когда setId не передан)
function SetSelectorScreen({ onSelect }) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTdfSets()
      .then(setSets)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 64 }}><Spin size="large" /></div>;
  }

  if (sets.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>
        Наборов ТДФ нет. Создайте набор в разделе «ТДФ — Наборы».
      </div>
    );
  }

  return (
    <div className="tdf-flashcards-settings">
      <Title level={4} style={{ marginBottom: 16 }}>Выберите набор</Title>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sets.map(s => (
          <Button key={s.id} block onClick={() => onSelect(s)} style={{ height: 'auto', padding: '10px 16px', textAlign: 'left' }}>
            <div>
              <span style={{ fontWeight: 500 }}>{s.title}</span>
              {s.class_number && (
                <Tag style={{ marginLeft: 8 }}>{s.class_number} класс</Tag>
              )}
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}

// Основной компонент
export default function TDFFlashcards({ setId: initialSetId, onBack }) {
  const [activeSetId, setActiveSetId] = useState(initialSetId || null);
  const [tdfSet, setTdfSet] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(!!initialSetId);

  // Фазы: 'settings' | 'session' | 'results'
  const [phase, setPhase] = useState('settings');
  const [deck, setDeck] = useState([]); // текущая колода
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState({}); // {itemId: 'know'|'dont-know'}
  const [progress, setProgress] = useState({}); // localStorage прогресс

  useEffect(() => {
    if (!activeSetId) return;
    setLoading(true);
    Promise.all([api.getTdfSet(activeSetId), api.getTdfItems(activeSetId)])
      .then(([set, its]) => {
        setTdfSet(set);
        setItems(its);
        setProgress(loadProgress(activeSetId));
      })
      .finally(() => setLoading(false));
  }, [activeSetId]);

  const handleStart = useCallback(({ filtered, shuffled }) => {
    let deck = [...filtered];
    if (shuffled) {
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    setDeck(deck);
    setCurrentIndex(0);
    setIsFlipped(false);
    setResults({});
    setPhase('session');
  }, []);

  const handleFlip = useCallback(() => setIsFlipped(prev => !prev), []);

  const handleAnswer = useCallback((answer) => {
    const item = deck[currentIndex];
    const newResults = { ...results, [item.id]: answer };
    setResults(newResults);

    // Сохраняем в localStorage
    const newProgress = { ...progress, [item.id]: answer };
    setProgress(newProgress);
    saveProgress(activeSetId, newProgress);

    if (currentIndex + 1 >= deck.length) {
      setPhase('results');
    } else {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  }, [deck, currentIndex, results, progress, activeSetId]);

  const handleRestartUnknown = useCallback(() => {
    const unknown = deck.filter(item => results[item.id] !== 'know');
    setDeck(unknown);
    setCurrentIndex(0);
    setIsFlipped(false);
    setResults({});
    setPhase('session');
  }, [deck, results]);

  const handleRestart = useCallback(() => {
    setPhase('settings');
  }, []);

  if (!activeSetId) {
    return (
      <div className="tdf-flashcards-container">
        <div className="tdf-flashcards-topbar">
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={onBack}>
            Назад к ТДФ
          </Button>
        </div>
        <SetSelectorScreen onSelect={(s) => { setActiveSetId(s.id); setPhase('settings'); }} />
      </div>
    );
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 64 }}><Spin size="large" /></div>;
  }

  return (
    <div className="tdf-flashcards-container">
      <div className="tdf-flashcards-topbar">
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={initialSetId ? onBack : () => setActiveSetId(null)}>
          {initialSetId ? 'Назад к ТДФ' : 'Выбрать другой набор'}
        </Button>
      </div>

      {phase === 'settings' && (
        <SettingsScreen
          tdfSet={tdfSet}
          items={items}
          onStart={handleStart}
          savedProgress={progress}
        />
      )}

      {phase === 'session' && deck.length > 0 && (
        <div className="tdf-flashcards-session">
          {/* Прогресс-бар */}
          <div style={{ marginBottom: 16 }}>
            <Progress
              percent={Math.round((currentIndex / deck.length) * 100)}
              size="small"
              showInfo={false}
              strokeColor="#1890ff"
            />
            <div style={{ textAlign: 'center', fontSize: 12, color: '#888', marginTop: 4 }}>
              {currentIndex + 1} / {deck.length}
            </div>
          </div>

          {/* Карточка */}
          <FlashCard
            item={deck[currentIndex]}
            isFlipped={isFlipped}
            onFlip={handleFlip}
          />

          {/* Кнопки ответа (активны только после флипа) */}
          <div className="tdf-flashcards-actions">
            <Button
              size="large"
              icon={<CloseOutlined />}
              onClick={() => handleAnswer('dont-know')}
              disabled={!isFlipped}
              danger
              style={{ flex: 1 }}
            >
              Не знаю
            </Button>
            <Button
              size="large"
              icon={<CheckOutlined />}
              onClick={() => handleAnswer('know')}
              disabled={!isFlipped}
              style={{ flex: 1, borderColor: '#52c41a', color: '#52c41a' }}
            >
              Знаю
            </Button>
          </div>
        </div>
      )}

      {phase === 'results' && (
        <ResultsScreen
          deck={deck}
          results={results}
          onRestart={handleRestart}
          onRestartUnknown={handleRestartUnknown}
          onBack={handleRestart}
        />
      )}
    </div>
  );
}
