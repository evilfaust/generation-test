import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Space, Steps, App } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import { useWorkImport } from '../../hooks/useWorkImport';
import { blockingIssues } from '../../utils/workImportPlan';
import SourceStep from './SourceStep';
import ReviewStep from './ReviewStep';
import TopicsStep from './TopicsStep';
import FinishStep from './FinishStep';

const STEPS = [
  { title: 'Источник', description: 'Текст работы' },
  { title: 'Проверка', description: 'Что распозналось' },
  { title: 'Темы', description: 'Куда попадут задачи' },
  { title: 'Импорт', description: 'Сохранение' },
];

/**
 * Мастер импорта работы целиком (WORK_IMPORT_FORMAT.md).
 *
 * В отличие от «Импорта задач» результат — не пачка задач одной темы, а
 * сохранённая работа: задачи расходятся по своим темам, порядок и варианты
 * сохраняются, фото оригинала прикрепляется к работе.
 */
export default function WorkImporter() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { topics, subtopics, reloadData } = useReferenceData();

  const [step, setStep] = useState(0);
  const [text, setText] = useState('');
  const [examTypeHint, setExamTypeHint] = useState(null);
  const [originalFiles, setOriginalFiles] = useState([]);
  const [placeholderFiles, setPlaceholderFiles] = useState({});
  const [workMeta, setWorkMeta] = useState({ title: '', classNumber: null, timeLimit: null, source: '' });

  const {
    parsed, rows, scanning, importing, progress, result,
    parse, updateRow, setTopicForRows, scanDuplicates, runImport, reset,
  } = useWorkImport({ topics, subtopics });

  const issues = useMemo(() => blockingIssues(rows), [rows]);

  // Дубли ищутся сами при первом заходе на шаг «Темы»: переиспользовать
  // задачу вместо копии — поведение по умолчанию, а не отдельное действие.
  // Повторный поиск (после ручной простановки тем) — кнопкой в шаге.
  const autoScannedRef = useRef(false);
  useEffect(() => {
    if (step !== 2 || autoScannedRef.current || rows.length === 0) return;
    autoScannedRef.current = true;
    scanDuplicates()
      .then(({ found }) => { if (found > 0) message.info(`Найдено в базе: ${found} задач(и) — они будут взяты, а не скопированы`); })
      .catch((e) => console.warn('[work-import] автопоиск дублей:', e.message));
  }, [step, rows.length, scanDuplicates, message]);

  const handleParse = () => {
    const data = parse(text);
    setWorkMeta({
      title: data.work.title || '',
      classNumber: data.work.classNumber ?? null,
      timeLimit: data.work.timeLimit ?? null,
      source: data.work.source || '',
    });

    const tasksCount = data.rows.length;
    if (data.errors.length > 0) {
      message.warning(`Разобрано задач: ${tasksCount}. Есть ошибки — проверьте на следующем шаге`);
    } else {
      message.success(`Разобрано задач: ${tasksCount}, вариантов: ${data.variants.length}`);
    }
    setStep(1);
  };

  const handlePlaceholderFile = (key, file) => {
    setPlaceholderFiles((prev) => {
      const next = { ...prev };
      if (file) next[key] = file;
      else delete next[key];
      return next;
    });
  };

  const handleScanDuplicates = async () => {
    const { found } = await scanDuplicates();
    message.info(found > 0 ? `Найдено совпадений: ${found}` : 'Совпадений в базе не найдено');
  };

  const handleImport = async () => {
    try {
      const summary = await runImport({
        workMeta,
        placeholderFiles,
        originalFiles: originalFiles.map((f) => f.originFileObj || f).filter(Boolean),
      });
      message.success(`Работа сохранена: ${summary.created} новых задач, ${summary.reused} из базы`);
    } catch (error) {
      console.error('[work-import]', error);
      message.error(`Импорт не удался: ${error.message}`);
    }
  };

  const handleReset = () => {
    reset();
    autoScannedRef.current = false;
    setText('');
    setStep(0);
    setPlaceholderFiles({});
    setOriginalFiles([]);
    setWorkMeta({ title: '', classNumber: null, timeLimit: null, source: '' });
  };

  return (
    <Card
      title="Импорт работы целиком"
      extra={<span style={{ color: '#888' }}>Формат: WORK_IMPORT_FORMAT.md</span>}
    >
      <Steps current={step} items={STEPS} style={{ marginBottom: 24 }} onChange={parsed ? setStep : undefined} />

      {step === 0 && (
        <SourceStep
          text={text}
          onTextChange={setText}
          onParse={handleParse}
          topics={topics}
          examTypeHint={examTypeHint}
          onExamTypeHintChange={setExamTypeHint}
          originalFiles={originalFiles}
          onOriginalFilesChange={setOriginalFiles}
        />
      )}

      {step === 1 && (
        <ReviewStep
          parsed={parsed}
          rows={rows}
          workMeta={workMeta}
          onWorkMetaChange={setWorkMeta}
          placeholderFiles={placeholderFiles}
          onPlaceholderFile={handlePlaceholderFile}
        />
      )}

      {step === 2 && (
        <TopicsStep
          rows={rows}
          topics={topics}
          subtopics={subtopics}
          examTypeHint={examTypeHint || parsed?.work?.examType}
          scanning={scanning}
          onUpdateRow={updateRow}
          onSetTopicForRows={setTopicForRows}
          onScanDuplicates={handleScanDuplicates}
          onTopicCreated={() => reloadData?.()}
        />
      )}

      {step === 3 && (
        <FinishStep
          rows={rows}
          workMeta={workMeta}
          issues={issues}
          importing={importing}
          progress={progress}
          result={result}
          onImport={handleImport}
          onOpenWork={(workId) => navigate(workId ? `/app/works/${workId}/edit` : '/app/works')}
          onReset={handleReset}
        />
      )}

      {step > 0 && !result && (
        <Space style={{ marginTop: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => setStep(step - 1)}>Назад</Button>
          {step < 3 && (
            <Button type="primary" onClick={() => setStep(step + 1)}>
              Дальше <ArrowRightOutlined />
            </Button>
          )}
        </Space>
      )}
    </Card>
  );
}
