import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, App } from 'antd';
import TaskReplaceModal from './TaskReplaceModal';
import TaskEditModal from './TaskEditModal';
import SaveWorkModal from './worksheet/SaveWorkModal';
import LoadWorkModal from './worksheet/LoadWorkModal';
import GeneratorHeader from './worksheet/oral-generator/GeneratorHeader';
import HeroSection from './worksheet/oral-generator/HeroSection';
import FiltersAndDistribution from './worksheet/oral-generator/FiltersAndDistribution';
import AppearanceSection from './worksheet/oral-generator/AppearanceSection';
import ResultActionBar from './worksheet/oral-generator/ResultActionBar';
import WorksheetVectorTools from './worksheet/oral-generator/WorksheetVectorTools';
import SelectionMethodPanel from './worksheet/oral-generator/SelectionMethodPanel';
import { api } from '../services/pocketbase';
import WorksheetPreview from './worksheet/oral-generator/WorksheetPreview';
import {
  useWorksheetGeneration,
  useTaskDragDrop,
  useTaskEditing,
  useWorksheetActions,
  useDistribution,
  useAvailableTags,
  useTaskCounter,
} from '../hooks';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import './TaskWorksheet.css';

const DIFFICULTY_OPTIONS = [
  { value: '1', label: '1 - Базовый' },
  { value: '2', label: '2 - Средний' },
  { value: '3', label: '3 - Повышенный' },
  { value: '4', label: '4 - Высокий' },
  { value: '5', label: '5 - Олимпиадный' },
];

const TaskSheetGenerator = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { topics, tags, years, sources, subtopics } = useReferenceData();
  const [form] = Form.useForm();
  const worksheetGen = useWorksheetGeneration();
  const { variants, setVariants, loading, generateFromFilters, generateFromVector } = worksheetGen;

  // Способ подбора задач (v3.9.41): 'filters' | 'seed' | 'diverse' | 'novelty'
  const [selectionMethod, setSelectionMethod] = useState('filters');
  const [seedTask, setSeedTask] = useState(null);
  const [similarity, setSimilarity] = useState(0.5);
  const [diverseMethod, setDiverseMethod] = useState('mmr');
  const [avoidWorkId, setAvoidWorkId] = useState(null);
  const [noveltyMaxCos, setNoveltyMaxCos] = useState(0.85);

  // Output mode + appearance
  const [outputMode, setOutputMode] = useState('sheet');
  // Лист печатается движком print-sheet (общий с входной контрольной): честная
  // пагинация по измеренным высотам, A4, монохром. Компактно по умолчанию —
  // шапка в строку, без места для решения.
  const [headerMode, setHeaderMode] = useState('compact');
  const [columns, setColumns] = useState(1);
  const [margins, setMargins] = useState('narrow');
  const [figureSize, setFigureSize] = useState('m');
  const [showFigures, setShowFigures] = useState(true);
  const [sheetMeta, setSheetMeta] = useState({
    title: '',                 // пусто → название работы
    eyebrow: '',
    subtitle: '',
    classLabel: '',
    duration: null,
    dateLabel: '',
    instruction: '',
    notesTitle: 'Дополнительная информация',
    notes: '',
    footerNote: '',
    showClassField: true,
    showTasksCount: true,
  });
  const patchSheetMeta = (patch) => setSheetMeta(prev => ({ ...prev, ...patch }));

  // «N на лист» делит остаток высоты страницы между заданиями — в двух
  // колонках делить нечего, поэтому режим сбрасывается явно, а не молча.
  const handleColumnsChange = (value) => {
    setColumns(value);
    if (value > 1 && solutionSpace === 'fit') setSolutionSpace('none');
  };

  // Размер чертежа у одной задачи (кнопка на карточке в превью) — пишется в
  // task.kimImageSize и переживает пересборку листа вместе с вариантом.
  const handleSetFigureSize = (variantIndex, taskIndex, size) => {
    setVariants(prev => prev.map((v, vi) => (
      vi !== variantIndex ? v : {
        ...v,
        tasks: v.tasks.map((t, ti) => (ti === taskIndex ? { ...t, kimImageSize: size } : t)),
      }
    )));
  };
  const [fontScale, setFontScale] = useState(1);
  const [fontFamily, setFontFamily] = useState('sans');
  const [answerStyle, setAnswerStyle] = useState('line');
  const [solutionSpace, setSolutionSpace] = useState('none');
  const [solutionFill, setSolutionFill] = useState('grid');
  const [tasksPerPage, setTasksPerPage] = useState(6);
  const [showFooter, setShowFooter] = useState(true);
  const [showTaskCode, setShowTaskCode] = useState(false);
  const [hideTaskPrefixes, setHideTaskPrefixes] = useState(false);
  const [showStudentInfo, setShowStudentInfo] = useState(true);
  const [showAnswersInline, setShowAnswersInline] = useState(false);
  const [showAnswersPage, setShowAnswersPage] = useState(true);
  const [variantLabel, setVariantLabel] = useState('Вариант');
  const [cryptogramEnabled, setCryptogramEnabled] = useState(false);
  const [cryptogramPhrase, setCryptogramPhrase] = useState('');
  const [cardFormat, setCardFormat] = useState('А6');
  const [showCardAnswers, setShowCardAnswers] = useState(false);
  const [showCardSolutions, setShowCardSolutions] = useState(false);
  const [showCardStudentInfo, setShowCardStudentInfo] = useState(true);

  const [selectedExamType, setSelectedExamType] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  const [progressiveDifficulty, setProgressiveDifficulty] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [savedWorks, setSavedWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [currentWork, setCurrentWork] = useState(null);

  const printRef = useRef();
  const worksheetActions = useWorksheetActions();
  const dragDropHandlers = useTaskDragDrop(variants, setVariants);
  const taskEditing = useTaskEditing(variants, setVariants);

  const syncTotal = (total) => form.setFieldValue('tasksPerVariant', total);
  const tagDistribution = useDistribution('tag', { onTotalChange: syncTotal, itemLabel: 'тег' });
  const difficultyDistribution = useDistribution('difficulty', { onTotalChange: syncTotal, itemLabel: 'уровень сложности' });

  const { availableTags, loadingTags } = useAvailableTags(selectedTopic, selectedSubtopic, tags);

  const watchedValues = Form.useWatch([], form);
  const tasksPerVariantValue = Form.useWatch('tasksPerVariant', form) || 0;
  const { availableTasksCount, loadingTasksCount } = useTaskCounter(watchedValues);

  useEffect(() => {
    if (!cryptogramEnabled) return;
    setShowAnswersInline(false);
  }, [cryptogramEnabled]);

  const distributionsActive = tagDistribution.items.length > 0 || difficultyDistribution.items.length > 0;

  const handleFormValuesChange = (changedValues) => {
    if ('exam_type' in changedValues) {
      setSelectedExamType(changedValues.exam_type || null);
      setSelectedTopic(null);
      setSelectedSubtopic(null);
      form.setFieldValue('topic', undefined);
      form.setFieldValue('subtopic', undefined);
      form.setFieldValue('filterTags', []);
      tagDistribution.reset();
      difficultyDistribution.reset();
    }
    if ('topic' in changedValues) {
      setSelectedTopic(changedValues.topic || null);
      setSelectedSubtopic(null);
      form.setFieldValue('subtopic', undefined);
      form.setFieldValue('filterTags', []);
      tagDistribution.reset();
      difficultyDistribution.reset();
    }
    if ('subtopic' in changedValues) {
      setSelectedSubtopic(changedValues.subtopic || null);
    }
  };

  const handleGenerate = async (values) => {
    const tasksPerVariant = values.tasksPerVariant || 20;

    const commonOpts = {
      variantsMode: values.variantsMode || 'different',
      variantsCount: values.variantsCount || 1,
      tasksPerVariant,
      sortType: values.sortType || 'random',
    };

    // === Векторные режимы подбора ===
    if (selectionMethod !== 'filters') {
      if (selectionMethod === 'seed' && !seedTask) {
        message.warning('Выберите задачу-эталон');
        return;
      }
      if ((selectionMethod === 'diverse' || selectionMethod === 'novelty') && !values.topic) {
        message.warning('Выберите тему — из неё будем подбирать задачи');
        return;
      }
      let avoidTaskIds = [];
      if (selectionMethod === 'novelty') {
        if (!avoidWorkId) {
          message.warning('Выберите работу, задачи которой не нужно повторять');
          return;
        }
        const variantsOfWork = await api.getVariantsByWork(avoidWorkId);
        const idset = new Set();
        variantsOfWork.forEach(v => (v.tasks || []).forEach(id => idset.add(id)));
        avoidTaskIds = [...idset];
      }
      await generateFromVector({
        method: selectionMethod,
        seedTaskId: seedTask?.id,
        similarity,
        diverseMethod,
        topic: values.topic,
        subtopic: values.subtopic,
        avoidTaskIds,
        maxCos: noveltyMaxCos,
      }, commonOpts);
      return;
    }

    // === Классические фильтры (без изменений) ===
    if (values.progressiveDifficulty && distributionsActive) {
      message.warning('Автопрогрессия несовместима с ручным распределением по тегам/сложности');
      return;
    }
    if (tagDistribution.items.length > 0 && !tagDistribution.validate(tasksPerVariant)) return;
    if (difficultyDistribution.items.length > 0 && !difficultyDistribution.validate(tasksPerVariant)) return;

    const filters = {};
    if (values.exam_type) filters.exam_type = values.exam_type;
    if (values.topic) filters.topic = values.topic;
    if (values.subtopic) filters.subtopic = values.subtopic;
    if (values.difficulty) filters.difficulty = values.difficulty;
    if (values.source) filters.source = values.source;
    if (values.year) filters.year = values.year;
    if (values.filterTags && values.filterTags.length > 0) filters.tags = values.filterTags;
    if (values.hasAnswer !== undefined) filters.hasAnswer = values.hasAnswer === 'yes';
    if (values.hasSolution !== undefined) filters.hasSolution = values.hasSolution === 'yes';
    if (values.search) filters.search = values.search;

    await generateFromFilters(filters, {
      variantsMode: values.variantsMode || 'different',
      variantsCount: values.variantsCount || 1,
      tasksPerVariant,
      sortType: values.sortType || 'random',
      tagDistribution: tagDistribution.items.length > 0 ? tagDistribution.items : undefined,
      difficultyDistribution: difficultyDistribution.items.length > 0 ? difficultyDistribution.items : undefined,
      progressiveDifficulty: values.progressiveDifficulty || false,
      getLabelForTag: (tagId) => availableTags.find(t => t.id === tagId)?.title || tagId,
      getLabelForDifficulty: (val) => DIFFICULTY_OPTIONS.find(o => o.value === val)?.label || val,
    });
  };

  const handleReset = () => {
    worksheetGen.reset();
    setSelectedExamType(null);
    setSelectedTopic(null);
    setSelectedSubtopic(null);
    tagDistribution.reset();
    difficultyDistribution.reset();
    form.resetFields();
    setCurrentWork(null);
    setProgressiveDifficulty(false);
    setSelectionMethod('filters');
    setSeedTask(null);
    setSimilarity(0.5);
    setDiverseMethod('mmr');
    setAvoidWorkId(null);
    setNoveltyMaxCos(0.85);
  };

  const handleSaveWork = async (values) => {
    const topic = form.getFieldValue('topic') || null;
    if (currentWork?.id) {
      await worksheetActions.handleUpdateWork(currentWork.id, { ...values, topic }, variants);
    } else {
      await worksheetActions.handleSaveWork({ ...values, topic }, variants);
    }
    setSaveModalVisible(false);
  };

  const handleOpenLoadModal = async () => {
    setLoadModalVisible(true);
    setLoadingWorks(true);
    try {
      const works = await worksheetActions.handleLoadWorks();
      setSavedWorks(works);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleLoadWork = async (workId) => {
    setLoadingWorks(true);
    try {
      const { work, variants: loadedVariants } = await worksheetActions.handleLoadWork(workId);
      setVariants(loadedVariants);
      form.setFieldsValue({ workTitle: work.title, topic: work.topic });
      setCurrentWork(work);
      setLoadModalVisible(false);
      message.success(`Работа "${work.title}" успешно загружена`);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleDeleteWork = async (workId) => {
    await worksheetActions.handleDeleteWork(workId);
    setSavedWorks(savedWorks.filter(w => w.id !== workId));
  };

  const handleExportMD = () => {
    const title = form.getFieldValue('workTitle') || 'Лист задач';
    let md = `# ${title}\n\n`;
    variants.forEach(variant => {
      md += `## ${variantLabel} ${variant.number}\n\n`;
      (variant.tasks || []).forEach((task, idx) => {
        md += `**${idx + 1}.** \`${task.code}\`\n\n${task.statement_md}\n\n`;
        if (task.answer) md += `> **Ответ:** ${task.answer}\n\n`;
        md += `---\n\n`;
      });
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.md`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
    message.success('Markdown успешно сохранён');
  };

  // Поля листа задаёт сам движок (padding .ps-page), поэтому @page нулевой.
  // Инъекция последним стилем в <head> перебивает глобальный
  // `@page { margin: 10mm 8mm }` из TaskWorksheet.css — иначе поля удваиваются.
  const handleSheetPrint = () => {
    const styleId = 'sheet-print-page-style';
    document.getElementById(styleId)?.remove();
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    const cleanup = () => {
      document.getElementById(styleId)?.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const workTitle = form.getFieldValue('workTitle') || 'Лист задач';

  // Подпись режима в панели действий: «A4 · компактно» / «A4 · 6 на лист» и т.п.
  const spaceLabel = {
    none: 'компактно', s: 'решение S', m: 'решение M', l: 'решение L', xl: 'решение XL',
    fit: `${tasksPerPage} на лист`,
  }[solutionSpace] || 'компактно';
  const colLabel = columns > 1 ? ` · ${columns} колонки` : '';
  const sheetSummary = `A4${margins === 'narrow' ? ' узкие поля' : ''}${colLabel} · ${spaceLabel}`;

  return (
    <div className="task-worksheet-container">
      <div className="no-print">
        <GeneratorHeader
          outputMode={outputMode}
          setOutputMode={setOutputMode}
          onOpenLoad={handleOpenLoadModal}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleGenerate}
          onValuesChange={handleFormValuesChange}
          initialValues={{
            sortType: 'random',
            variantsCount: 1,
            variantsMode: 'different',
            tasksPerVariant: 20,
            workTitle: 'Лист задач',
            progressiveDifficulty: false,
          }}
        >
          <HeroSection
            topics={topics}
            subtopics={subtopics}
            form={form}
            loading={loading}
            availableTasksCount={availableTasksCount}
            loadingTasksCount={loadingTasksCount}
            selectedExamType={selectedExamType}
            selectedTopic={selectedTopic}
            distributionsActive={distributionsActive}
            onSubtopicChange={setSelectedSubtopic}
            methodSlot={
              <SelectionMethodPanel
                method={selectionMethod}
                setMethod={setSelectionMethod}
                seedTask={seedTask}
                setSeedTask={setSeedTask}
                similarity={similarity}
                setSimilarity={setSimilarity}
                diverseMethod={diverseMethod}
                setDiverseMethod={setDiverseMethod}
                avoidWorkId={avoidWorkId}
                setAvoidWorkId={setAvoidWorkId}
                noveltyMaxCos={noveltyMaxCos}
                setNoveltyMaxCos={setNoveltyMaxCos}
                selectedTopic={selectedTopic}
              />
            }
            filtersSlot={
              <FiltersAndDistribution
                form={form}
                sources={sources}
                years={years}
                availableTags={availableTags}
                loadingTags={loadingTags}
                selectedTopic={selectedTopic}
                tagDistribution={tagDistribution}
                difficultyDistribution={difficultyDistribution}
                progressiveDifficulty={progressiveDifficulty}
                setProgressiveDifficulty={setProgressiveDifficulty}
              />
            }
          />

          <AppearanceSection
            outputMode={outputMode}
            columns={columns}
            setColumns={handleColumnsChange}
            margins={margins}
            setMargins={setMargins}
            figureSize={figureSize}
            setFigureSize={setFigureSize}
            showFigures={showFigures}
            setShowFigures={setShowFigures}
            headerMode={headerMode}
            setHeaderMode={setHeaderMode}
            sheetMeta={sheetMeta}
            patchSheetMeta={patchSheetMeta}
            fontScale={fontScale}
            setFontScale={setFontScale}
            fontFamily={fontFamily}
            setFontFamily={setFontFamily}
            answerStyle={answerStyle}
            setAnswerStyle={setAnswerStyle}
            solutionSpace={solutionSpace}
            setSolutionSpace={setSolutionSpace}
            solutionFill={solutionFill}
            setSolutionFill={setSolutionFill}
            tasksPerPage={tasksPerPage}
            setTasksPerPage={setTasksPerPage}
            showFooter={showFooter}
            setShowFooter={setShowFooter}
            showTaskCode={showTaskCode}
            setShowTaskCode={setShowTaskCode}
            hideTaskPrefixes={hideTaskPrefixes}
            setHideTaskPrefixes={setHideTaskPrefixes}
            showStudentInfo={showStudentInfo}
            setShowStudentInfo={setShowStudentInfo}
            showAnswersInline={showAnswersInline}
            setShowAnswersInline={setShowAnswersInline}
            showAnswersPage={showAnswersPage}
            setShowAnswersPage={setShowAnswersPage}
            variantLabel={variantLabel}
            setVariantLabel={setVariantLabel}
            cryptogramEnabled={cryptogramEnabled}
            setCryptogramEnabled={setCryptogramEnabled}
            cryptogramPhrase={cryptogramPhrase}
            setCryptogramPhrase={setCryptogramPhrase}
            tasksCount={tasksPerVariantValue}
            cardFormat={cardFormat}
            setCardFormat={setCardFormat}
            showCardAnswers={showCardAnswers}
            setShowCardAnswers={setShowCardAnswers}
            showCardSolutions={showCardSolutions}
            setShowCardSolutions={setShowCardSolutions}
            showCardStudentInfo={showCardStudentInfo}
            setShowCardStudentInfo={setShowCardStudentInfo}
          />
        </Form>

        <ResultActionBar
          variants={variants}
          outputMode={outputMode}
          variantLabel={variantLabel}
          cardFormat={cardFormat}
          showAnswersPage={showAnswersPage}
          sheetSummary={sheetSummary}
          onSave={() => setSaveModalVisible(true)}
          onOpenLoad={handleOpenLoadModal}
          onPrint={outputMode === 'sheet' ? handleSheetPrint : worksheetActions.handlePrint}
          onExportPDF={() => worksheetActions.handleExportPDF(printRef, workTitle)}
          onExportMD={handleExportMD}
          onReset={handleReset}
          worksheetActions={worksheetActions}
        />

        <WorksheetVectorTools
          variants={variants}
          setVariants={setVariants}
          workTitle={workTitle}
          currentWorkId={currentWork?.id || null}
          onOpenWork={(id) => navigate(`/app/works/${id}/edit`)}
        />
      </div>

      <WorksheetPreview
        printRef={printRef}
        variants={variants}
        outputMode={outputMode}
        workTitle={workTitle}
        columns={columns}
        margins={margins}
        figureSize={figureSize}
        showFigures={showFigures}
        headerMode={headerMode}
        sheetMeta={sheetMeta}
        fontScale={fontScale}
        fontFamily={fontFamily}
        answerStyle={answerStyle}
        solutionFill={solutionFill}
        tasksPerPage={tasksPerPage}
        showFooter={showFooter}
        showTaskCode={showTaskCode}
        hideTaskPrefixes={hideTaskPrefixes}
        showStudentInfo={showStudentInfo}
        showAnswersInline={showAnswersInline}
        showAnswersPage={showAnswersPage}
        solutionSpace={solutionSpace}
        variantLabel={variantLabel}
        cryptogramEnabled={cryptogramEnabled}
        cryptogramPhrase={cryptogramPhrase}
        dragDropHandlers={dragDropHandlers}
        onSetFigureSize={handleSetFigureSize}
        taskEditing={taskEditing}
        cardFormat={cardFormat}
        showCardAnswers={showCardAnswers}
        showCardSolutions={showCardSolutions}
        showCardStudentInfo={showCardStudentInfo}
        topics={topics}
        tags={tags}
        subtopics={subtopics}
        setVariants={setVariants}
      />

      <TaskReplaceModal
        visible={taskEditing.replaceModalVisible}
        taskToReplace={taskEditing.taskToReplace}
        onConfirm={taskEditing.handleConfirmReplace}
        onCancel={taskEditing.handleCancelReplace}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        currentVariantTasks={taskEditing.taskToReplace ? variants[taskEditing.taskToReplace.variantIndex]?.tasks || [] : []}
      />

      {taskEditing.taskToEdit && (
        <TaskEditModal
          task={taskEditing.taskToEdit}
          visible={taskEditing.editModalVisible}
          onClose={taskEditing.handleCancelEdit}
          onSave={taskEditing.handleSaveEdit}
          onDelete={taskEditing.handleDeleteEdit}
          allTags={tags || []}
          allSources={sources || []}
          allYears={years || []}
          allSubtopics={subtopics || []}
          allTopics={topics || []}
        />
      )}

      <SaveWorkModal
        visible={saveModalVisible}
        onCancel={() => setSaveModalVisible(false)}
        onSave={handleSaveWork}
        saving={worksheetActions.saving}
        variantsCount={variants.length}
        tasksCount={variants.reduce((sum, v) => sum + v.tasks.length, 0)}
        initialTitle={currentWork?.title || 'Лист задач'}
        initialTimeLimit={currentWork?.time_limit ?? null}
        isEdit={!!currentWork?.id}
      />

      <LoadWorkModal
        visible={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        works={savedWorks}
        loading={loadingWorks}
        onLoad={handleLoadWork}
        onDelete={handleDeleteWork}
      />
    </div>
  );
};

export default TaskSheetGenerator;
