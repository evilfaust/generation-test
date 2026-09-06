import { Collapse, Segmented, Switch, Input, InputNumber, Space, Typography, Divider, Tooltip, Alert } from 'antd';
import { BgColorsOutlined } from '@ant-design/icons';
import { getCryptogramLetterCount } from '../../../utils/cryptogram';
import { KIM_IMAGE_SIZE_OPTIONS } from '../../../utils/kimImageSize';
import { SOLUTION_SPACE_OPTIONS, SOLUTION_FILL_OPTIONS, MARGIN_OPTIONS } from '../../print-sheet/geometry';

const { Text } = Typography;

const HEADER_OPTIONS = [
  { value: 'compact', label: 'Компактная' },
  { value: 'full', label: 'Полная' },
];
const FONT_SCALE_OPTIONS = [
  { value: 0.9, label: '10 pt' },
  { value: 1, label: '11 pt' },
  { value: 1.12, label: '12 pt' },
  { value: 1.25, label: '14 pt' },
];
const FONT_FAMILY_OPTIONS = [
  { value: 'sans', label: 'Гротеск' },
  { value: 'serif', label: 'Антиква' },
];
const ANSWER_STYLE_OPTIONS = [
  { value: 'none', label: 'Нет' },
  { value: 'line', label: 'Строка' },
  { value: 'box', label: 'Поле справа' },
];
// «N на лист» — бывший «Рабочий лист»: страницы набиваются по N заданий, весь
// остаток высоты делится между ними как зона решения.
const SPACE_OPTIONS = [...SOLUTION_SPACE_OPTIONS, { value: 'fit', label: 'N на лист' }];
const COLUMN_OPTIONS = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
];
const CARD_FORMAT_OPTIONS = [
  { value: 'А6', label: 'A6' },
  { value: 'А5', label: 'A5' },
  { value: 'А4', label: 'A4' },
];

const Subtitle = ({ children }) => (
  <Text style={{ fontSize: 12, fontWeight: 600, color: '#8c8c8c', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
    {children}
  </Text>
);

// Универсальные обёртки для одной настройки
const Field = ({ label, children }) => (
  <Space size={6}>
    <Text style={{ fontSize: 13, color: '#595959' }}>{label}:</Text>
    {children}
  </Space>
);

const SwitchField = ({ label, hint, ...props }) => {
  const text = <Text style={{ fontSize: 13, color: '#595959' }}>{label}</Text>;
  return (
    <Space size={6}>
      <Switch size="small" {...props} />
      {hint ? <Tooltip title={hint}>{text}</Tooltip> : text}
    </Space>
  );
};

export default function AppearanceSection({
  outputMode,
  // sheet props
  columns,
  setColumns,
  margins,
  setMargins,
  figureSize,
  setFigureSize,
  showFigures,
  setShowFigures,
  headerMode,
  setHeaderMode,
  sheetMeta,
  patchSheetMeta,
  answerStyle,
  setAnswerStyle,
  solutionSpace,
  setSolutionSpace,
  solutionFill,
  setSolutionFill,
  tasksPerPage,
  setTasksPerPage,
  fontScale,
  setFontScale,
  fontFamily,
  setFontFamily,
  showFooter,
  setShowFooter,
  showTaskCode,
  setShowTaskCode,
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
  showVariantLabel,
  setShowVariantLabel,
  variantsCount = 1,
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
  // Тумблер показывает фактическое состояние листа: пока учитель его не трогал
  // (null), надпись живёт по авто-правилу движка — «вариантов больше одного».
  const variantVisible = showVariantLabel != null ? showVariantLabel : variantsCount > 1;

  const sheetBody = (
    <>
      <Alert
        type="info"
        showIcon={false}
        style={{ marginBottom: 12, fontSize: 12 }}
        message="Лист монохромный и считает страницы по реальной высоте задач — что видно в превью, то и напечатается. Формат A4."
      />

      <Subtitle>Лист</Subtitle>
      <Space wrap size={[16, 10]} style={{ width: '100%', marginTop: 6 }}>
        <Field label="Колонки">
          <Tooltip title="Две колонки — для коротких задач (устный счёт, вычисления). Задачи меряются шириной колонки, поэтому длинные условия с чертежами лучше печатать в одну.">
            <Segmented size="small" value={columns} onChange={setColumns} options={COLUMN_OPTIONS} />
          </Tooltip>
        </Field>
        <Field label="Поля">
          <Tooltip title="Узкие поля: 8 мм по бокам вместо 14 — плюс 12 мм ширины под задачи.">
            <Segmented size="small" value={margins} onChange={setMargins} options={MARGIN_OPTIONS} />
          </Tooltip>
        </Field>
        <Field label="Кегль условий">
          <Segmented size="small" value={fontScale} onChange={setFontScale} options={FONT_SCALE_OPTIONS} />
        </Field>
        <Field label="Шрифт">
          <Segmented size="small" value={fontFamily} onChange={setFontFamily} options={FONT_FAMILY_OPTIONS} />
        </Field>
        <SwitchField
          label="Номер варианта"
          hint="Надпись «Вариант N» в шапке, колонтитуле и ключе. Сама включается, когда вариантов несколько."
          checked={variantVisible}
          onChange={setShowVariantLabel}
        />
        {variantVisible && (
          <Field label="Название варианта">
            <Input
              size="small"
              value={variantLabel}
              onChange={(e) => setVariantLabel(e.target.value)}
              placeholder="Вариант"
              style={{ width: 130 }}
            />
          </Field>
        )}
      </Space>

      <Divider style={{ margin: '12px 0' }} />

      <Subtitle>Задачи</Subtitle>
      <Space wrap size={[16, 10]} style={{ width: '100%', marginTop: 6 }}>
        <Field label="Поле ответа">
          <Segmented size="small" value={answerStyle} onChange={setAnswerStyle} options={ANSWER_STYLE_OPTIONS} />
        </Field>
        <Field label="Место для решения">
          <Segmented
            size="small"
            value={solutionSpace}
            onChange={setSolutionSpace}
            options={columns > 1 ? SOLUTION_SPACE_OPTIONS : SPACE_OPTIONS}
          />
        </Field>
        {solutionSpace === 'fit' && columns === 1 && (
          <Field label="Задач на лист">
            <InputNumber
              size="small"
              min={1}
              max={20}
              value={tasksPerPage}
              onChange={(v) => setTasksPerPage(v || 1)}
              style={{ width: 70 }}
            />
          </Field>
        )}
        {solutionSpace !== 'none' && (
          <Field label="Разлиновка">
            <Segmented size="small" value={solutionFill} onChange={setSolutionFill} options={SOLUTION_FILL_OPTIONS} />
          </Field>
        )}
      </Space>

      <Space wrap size={[16, 8]} style={{ width: '100%', marginTop: 10 }}>
        <SwitchField
          label="Скрыть типовые фразы"
          checked={hideTaskPrefixes}
          onChange={setHideTaskPrefixes}
        />
        <SwitchField
          label="Ответы в тексте"
          hint="Готовый ответ под условием — экземпляр для учителя."
          checked={showAnswersInline}
          onChange={setShowAnswersInline}
          disabled={cryptogramEnabled}
        />
        <SwitchField
          label="Код задачи"
          checked={showTaskCode}
          onChange={setShowTaskCode}
        />
      </Space>

      <Divider style={{ margin: '12px 0' }} />

      <Subtitle>Чертежи и графики</Subtitle>
      <Space wrap size={[16, 10]} style={{ width: '100%', marginTop: 6 }}>
        <SwitchField
          label="Показывать"
          hint="Выключает и картинки задач, и встроенные чертежи (числовые прямые, графики)."
          checked={showFigures}
          onChange={setShowFigures}
        />
        {showFigures && (
          <Field label="Размер">
            <Tooltip title="Общий размер для картинок задачи, картинок из условия и встроенных чертежей (```numline / ```plot).">
              <Segmented size="small" value={figureSize} onChange={setFigureSize} options={KIM_IMAGE_SIZE_OPTIONS} />
            </Tooltip>
          </Field>
        )}
      </Space>
      {showFigures && (
        <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginTop: 6 }}>
          Размер отдельной задачи — переключателем S/M/L/XL в правом верхнем углу самой задачи
          на листе ниже (виден у задач с чертежом).
        </Text>
      )}

      <Divider style={{ margin: '12px 0' }} />

      <Subtitle>Шапка и колонтитул</Subtitle>
      <Space wrap size={[16, 10]} style={{ width: '100%', marginTop: 6 }}>
        <Field label="Вид">
          <Segmented size="small" value={headerMode} onChange={setHeaderMode} options={HEADER_OPTIONS} />
        </Field>
        <Field label="Заголовок">
          <Input
            size="small"
            value={sheetMeta.title}
            onChange={(e) => patchSheetMeta({ title: e.target.value })}
            placeholder="Название работы"
            style={{ width: 220 }}
          />
        </Field>
        <Field label="Подзаголовок">
          <Input
            size="small"
            value={sheetMeta.subtitle}
            onChange={(e) => patchSheetMeta({ subtitle: e.target.value })}
            placeholder="Тема урока"
            style={{ width: 200 }}
          />
        </Field>
        <Field label="Класс">
          <Input
            size="small"
            value={sheetMeta.classLabel}
            onChange={(e) => patchSheetMeta({ classLabel: e.target.value })}
            placeholder="10 класс"
            style={{ width: 110 }}
          />
        </Field>
        <Field label="Время, мин">
          <InputNumber
            size="small"
            min={0}
            max={300}
            value={sheetMeta.duration}
            onChange={(v) => patchSheetMeta({ duration: v || null })}
            style={{ width: 80 }}
          />
        </Field>
        <Field label="Дата">
          <Input
            size="small"
            value={sheetMeta.dateLabel}
            onChange={(e) => patchSheetMeta({ dateLabel: e.target.value })}
            placeholder="1 сентября"
            style={{ width: 130 }}
          />
        </Field>
      </Space>

      <Space wrap size={[16, 8]} style={{ width: '100%', marginTop: 10 }}>
        <SwitchField
          label="Поля для ФИО"
          checked={showStudentInfo}
          onChange={setShowStudentInfo}
        />
        <SwitchField
          label="Поле «Класс»"
          checked={sheetMeta.showClassField !== false}
          onChange={(v) => patchSheetMeta({ showClassField: v })}
          disabled={!showStudentInfo}
        />
        <SwitchField
          label="Число заданий"
          hint="Строка «10 заданий» в подзаголовке — рядом с классом, временем и датой."
          checked={sheetMeta.showTasksCount !== false}
          onChange={(v) => patchSheetMeta({ showTasksCount: v })}
        />
        <SwitchField
          label="Нижний колонтитул"
          hint="Подпись слева и номер страницы справа. Без подвала задачам достаётся ещё 8 мм на листе."
          checked={showFooter}
          onChange={setShowFooter}
        />
        {showFooter && (
          <Field label="Подпись в подвале">
            <Input
              size="small"
              value={sheetMeta.footerNote}
              onChange={(e) => patchSheetMeta({ footerNote: e.target.value })}
              placeholder="Lemma"
              style={{ width: 180 }}
            />
          </Field>
        )}
      </Space>

      {headerMode === 'full' && (
        <>
          <Space wrap size={[16, 10]} style={{ width: '100%', marginTop: 10 }}>
            <Field label="Надзаголовок">
              <Input
                size="small"
                value={sheetMeta.eyebrow}
                onChange={(e) => patchSheetMeta({ eyebrow: e.target.value })}
                placeholder="Самостоятельная работа"
                style={{ width: 220 }}
              />
            </Field>
            <Field label="Заголовок доп. блока">
              <Input
                size="small"
                value={sheetMeta.notesTitle}
                onChange={(e) => patchSheetMeta({ notesTitle: e.target.value })}
                placeholder="Дополнительная информация"
                style={{ width: 220 }}
              />
            </Field>
          </Space>
          <div style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>Инструкция:</Text>
            <Input.TextArea
              size="small"
              rows={2}
              value={sheetMeta.instruction}
              onChange={(e) => patchSheetMeta({ instruction: e.target.value })}
              placeholder="Работа состоит из 10 заданий. Ответы записывайте рядом с заданием."
              style={{ marginTop: 4 }}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>Дополнительная информация:</Text>
            <Input.TextArea
              size="small"
              rows={2}
              value={sheetMeta.notes}
              onChange={(e) => patchSheetMeta({ notes: e.target.value })}
              placeholder="Работа не влияет на оценку за четверть."
              style={{ marginTop: 4 }}
            />
          </div>
        </>
      )}

      <Divider style={{ margin: '12px 0' }} />

      <Subtitle>Ответы</Subtitle>
      <Space wrap size={[16, 8]} style={{ width: '100%', marginTop: 6 }}>
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
        <Space size={6} style={{ width: '100%', marginTop: 10 }} direction="vertical">
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
