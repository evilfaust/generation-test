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
import WorksheetGridPrint from './worksheet/WorksheetGridPrint';
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
  const [sheetFormat, setSheetFormat] = useState('A4');
  const [columns, setColumns] = useState(1);
  const [fontSize, setFontSize] = useState(12);
  const [solutionSpace, setSolutionSpace] = useState('medium');
  const [compactMode, setCompactMode] = useState(false);
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
  const [worksheetOpen, setWorksheetOpen] = useState(false);

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
    setCompactMode(false);
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

  const handleSheetPrint = () => {
    const styleId = 'sheet-print-page-style';
    document.getElementById(styleId)?.remove();
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `@media print { @page { size: ${sheetFormat} portrait; margin: 8mm 5mm; } }`;
    document.head.appendChild(style);
    const cleanup = () => {
      document.getElementById(styleId)?.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const sheetPDFOptions = {
    format: sheetFormat,
    marginTop: '5mm', marginBottom: '5mm', marginLeft: '5mm', marginRight: '5mm',
    extraCSS: '.sheet-pages-preview { display: block !important; padding: 0 !important; background: none !important; } .sheet-page { box-shadow: none !important; break-after: avoid !important; page-break-after: avoid !important; border-bottom: 0.3mm solid #ccc; padding-bottom: 3mm !important; margin-bottom: 3mm !important; } .sheet-page:last-child { border-bottom: none !important; } .sheet-page-a4, .sheet-page-a5 { min-height: 0 !important; width: 100% !important; padding: 0 !important; } .sheet-page-label { display: none !important; } .sheet-page .variant-container { padding-top: 0 !important; } .variant-header { padding: 3px 5px !important; } .task-item { margin-bottom: 4px !important; }',
  };

  const cardsPDFOptions = {
    marginTop: '5mm', marginBottom: '5mm', marginLeft: '5mm', marginRight: '5mm',
    extraCSS: `
      .printable-worksheet { min-height: 0 !important; padding: 0 !important; }
      .title-page { min-height: 0 !important; }
      .variant-container { padding-top: 0 !important; margin-bottom: 6px !important; }
      .variant-header { padding: 4px 8px !important; margin-bottom: 4px !important; }
      .tasks-content { margin-top: 6px !important; }
      .task-item { margin-bottom: 8px !important; padding-bottom: 6px !important; }
      .answers-page { padding: 8px !important; }
      .variant-answers { margin-bottom: 12px !important; }
    `,
  };

  const workTitle = form.getFieldValue('workTitle') || 'Лист задач';

  if (worksheetOpen) {
    return (
      <WorksheetGridPrint
        pages={variants.map(v => ({
          title: workTitle,
          label: `${variantLabel} ${v.number}`,
          tasks: v.tasks,
        }))}
        hideTaskPrefixes={hideTaskPrefixes}
        onBack={() => setWorksheetOpen(false)}
      />
    );
  }

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
            sheetFormat={sheetFormat}
            setSheetFormat={setSheetFormat}
            columns={columns}
            setColumns={setColumns}
            fontSize={fontSize}
            setFontSize={setFontSize}
            solutionSpace={solutionSpace}
            setSolutionSpace={setSolutionSpace}
            compactMode={compactMode}
            setCompactMode={setCompactMode}
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
          sheetFormat={sheetFormat}
          cardFormat={cardFormat}
          showAnswersPage={showAnswersPage}
          onSave={() => setSaveModalVisible(true)}
          onOpenLoad={handleOpenLoadModal}
          onPrint={outputMode === 'sheet' ? handleSheetPrint : worksheetActions.handlePrint}
          onExportPDF={() => worksheetActions.handleExportPDF(
            printRef,
            workTitle,
            outputMode === 'sheet' ? sheetPDFOptions : cardsPDFOptions
          )}
          onExportMD={handleExportMD}
          onReset={handleReset}
          onOpenWorksheet={() => setWorksheetOpen(true)}
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
        sheetFormat={sheetFormat}
        columns={columns}
        fontSize={fontSize}
        compactMode={compactMode}
        hideTaskPrefixes={hideTaskPrefixes}
        showStudentInfo={showStudentInfo}
        showAnswersInline={showAnswersInline}
        showAnswersPage={showAnswersPage}
        solutionSpace={solutionSpace}
        variantLabel={variantLabel}
        cryptogramEnabled={cryptogramEnabled}
        cryptogramPhrase={cryptogramPhrase}
        dragDropHandlers={dragDropHandlers}
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
