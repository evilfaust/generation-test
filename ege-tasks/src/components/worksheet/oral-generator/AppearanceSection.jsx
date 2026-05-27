import { Collapse, Segmented, Switch, Input, Space, Typography, Divider } from 'antd';
import { BgColorsOutlined } from '@ant-design/icons';
import { getCryptogramLetterCount } from '../../../utils/cryptogram';

const { Text } = Typography;

const FONT_OPTIONS = [10, 12, 14, 16, 20].map(n => ({ value: n, label: `${n}pt` }));
const COLUMN_OPTIONS = [1, 2, 3].map(n => ({ value: n, label: String(n) }));
const SOLUTION_OPTIONS = [
  { value: 'none', label: 'Нет' },
  { value: 'small', label: 'Мало' },
  { value: 'medium', label: 'Средне' },
  { value: 'large', label: 'Много' },
];
const SHEET_FORMAT_OPTIONS = [
  { value: 'A4', label: 'A4' },
  { value: 'A5', label: 'A5' },
];
const CARD_FORMAT_OPTIONS = [
  { value: 'А6', label: 'A6' },
  { value: 'А5', label: 'A5' },
  { value: 'А4', label: 'A4' },
];

// Универсальные обёртки для одной настройки
const Field = ({ label, children }) => (
  <Space size={6}>
    <Text style={{ fontSize: 13, color: '#595959' }}>{label}:</Text>
    {children}
  </Space>
);

const SwitchField = ({ label, ...props }) => (
  <Space size={6}>
    <Switch size="small" {...props} />
    <Text style={{ fontSize: 13, color: '#595959' }}>{label}</Text>
  </Space>
);

export default function AppearanceSection({
  outputMode,
  // sheet props
  sheetFormat,
  setSheetFormat,
  columns,
  setColumns,
  fontSize,
  setFontSize,
  solutionSpace,
  setSolutionSpace,
  compactMode,
  setCompactMode,
  hideTaskPrefixes,
  setHideTaskPrefixes,
  showStudentInfo,
  setShowStudentInfo,
  showAnswersInline,
  setShowAnswersInline,
  showAnswersPage,
  setShowAnswersPage,
  variantLabel,
  setVariantLabel,
  cryptogramEnabled,
  setCryptogramEnabled,
  cryptogramPhrase,
  setCryptogramPhrase,
  tasksCount,
  // cards props
  cardFormat,
  setCardFormat,
  showCardAnswers,
  setShowCardAnswers,
  showCardSolutions,
  setShowCardSolutions,
  showCardStudentInfo,
  setShowCardStudentInfo,
}) {
  const lettersCount = getCryptogramLetterCount(cryptogramPhrase);

  const sheetBody = (
    <>
      <Space wrap size={[16, 10]} style={{ width: '100%' }}>
        <Field label="Шрифт">
          <Segmented size="small" value={fontSize} onChange={setFontSize} options={FONT_OPTIONS} />
        </Field>
        <Field label="Колонки">
          <Segmented size="small" value={columns} onChange={setColumns} options={COLUMN_OPTIONS} />
        </Field>
        <Field label="Место для решения">
          <Segmented size="small" value={solutionSpace} onChange={setSolutionSpace} options={SOLUTION_OPTIONS} />
        </Field>
        <Field label="Формат листа">
          <Segmented size="small" value={sheetFormat} onChange={setSheetFormat} options={SHEET_FORMAT_OPTIONS} />
        </Field>
        <Field label="Название варианта">
          <Input
            size="small"
            value={variantLabel}
            onChange={(e) => setVariantLabel(e.target.value)}
            placeholder="Вариант"
            style={{ width: 130 }}
          />
        </Field>
      </Space>

      <Divider style={{ margin: '10px 0' }} />

      <Space wrap size={[16, 8]} style={{ width: '100%' }}>
        <SwitchField
          label="Скрыть типовые фразы"
          checked={hideTaskPrefixes}
          onChange={setHideTaskPrefixes}
        />
        <SwitchField
          label="Компактный режим"
          checked={compactMode}
          onChange={setCompactMode}
        />
        <SwitchField
          label="Поля для ФИО"
          checked={showStudentInfo}
          onChange={setShowStudentInfo}
          disabled={compactMode}
        />
        <SwitchField
          label="Ответы в тексте"
          checked={showAnswersInline}
          onChange={setShowAnswersInline}
          disabled={compactMode || cryptogramEnabled}
        />
        <SwitchField
          label="Лист с ответами"
          checked={showAnswersPage}
          onChange={setShowAnswersPage}
        />
        <SwitchField
          label="Шифровка по ответам"
          checked={cryptogramEnabled}
          onChange={setCryptogramEnabled}
        />
      </Space>

      {cryptogramEnabled && (
        <>
          <Divider style={{ margin: '10px 0' }} />
          <Space size={6} style={{ width: '100%' }} direction="vertical">
            <Field label="Слово или фраза для шифровки">
              <Input
                size="small"
                value={cryptogramPhrase}
                onChange={(e) => setCryptogramPhrase(e.target.value)}
                placeholder="Например: ТЕОРЕМА ПИФАГОРА"
                style={{ width: 280 }}
              />
            </Field>
            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
              Букв без пробелов: {lettersCount} · Задач в варианте: {tasksCount} · Для корректной шифровки числа должны совпадать
            </Text>
          </Space>
        </>
      )}
    </>
  );

  const cardsBody = (
    <Space wrap size={[16, 10]} style={{ width: '100%' }}>
      <Field label="Формат карточек">
        <Segmented size="small" value={cardFormat} onChange={setCardFormat} options={CARD_FORMAT_OPTIONS} />
      </Field>
      <SwitchField
        label="Показать ответы"
        checked={showCardAnswers}
        onChange={setShowCardAnswers}
      />
      <SwitchField
        label="Показать решения"
        checked={showCardSolutions}
        onChange={setShowCardSolutions}
      />
      <SwitchField
        label="Поля для ФИО"
        checked={showCardStudentInfo}
        onChange={setShowCardStudentInfo}
      />
    </Space>
  );

  return (
    <Collapse
      items={[
        {
          key: 'appearance',
          label: (
            <span style={{ fontWeight: 500 }}>
              <BgColorsOutlined /> Оформление
              <span style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400, marginLeft: 8 }}>
                {outputMode === 'sheet' ? 'для листа задач' : 'для карточек'}
              </span>
            </span>
          ),
          children: outputMode === 'sheet' ? sheetBody : cardsBody,
        },
      ]}
      style={{ marginBottom: 16, background: '#fafafa' }}
    />
  );
}
