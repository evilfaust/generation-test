import { useState, useRef, useMemo, useEffect } from 'react';
import { Form, Button, Alert, Collapse, Spin, Tag, App, Typography } from 'antd';
import {
  PlusOutlined,
  UnorderedListOutlined,
  SettingOutlined,
  PrinterOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

const { Text } = Typography;
import { v4 as uuid } from 'uuid';
import { PageHeader } from '../ui';
import FilterBlock from './worksheet/FilterBlock';
import VariantSettings from './worksheet/VariantSettings';
import FormatSettings from './worksheet/FormatSettings';
import SaveWorkModal from './worksheet/SaveWorkModal';
import LoadWorkModal from './worksheet/LoadWorkModal';
import VariantRenderer from './worksheet/VariantRenderer';
import AnswersPage from './worksheet/AnswersPage';
import VariantStats from './worksheet/VariantStats';
import ParallelVariantsModal from './worksheet/ParallelVariantsModal';
import ActionButtons from './worksheet/ActionButtons';
import WorksheetGridPrint from './worksheet/WorksheetGridPrint';
import TaskReplaceModal from './TaskReplaceModal';
import TaskEditModal from './TaskEditModal';
import {
  useWorksheetGeneration,
  useTaskDragDrop,
  useWorksheetActions,
  useTaskEditing,
} from '../hooks';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import './TaskWorksheet.css';

/**
 * Генератор контрольных работ с задачами из разных тем
 */
const TestWorkGenerator = () => {
  const { message } = App.useApp();
  const { topics, tags, subtopics, years, sources } = useReferenceData();
  const [form] = Form.useForm();
  const printRef = useRef();

  // Блоки фильтров для структуры работы
  const [workBlocks, setWorkBlocks] = useState([]);
  const [parallelOpen, setParallelOpen] = useState(false);

  // Хуки
  const { variants, setVariants, loading, generateFromStructure, reset } = useWorksheetGeneration();
  const dragDropHandlers = useTaskDragDrop(variants, setVariants);
  const {
    saving,
    exporting,
    handlePrint,
    handleExportPDF,
    handleSaveWork,
    handleUpdateWork,
    handleLoadWorks,
    handleLoadWork,
    handleDeleteWork,
  } = useWorksheetActions();
  const taskEditing = useTaskEditing(variants, setVariants);


  // Настройки вариантов
  const [variantsCount, setVariantsCount] = useState(1);
  const [variantsMode, setVariantsMode] = useState('different');
  const [sortType, setSortType] = useState('random');
  const [progressiveDifficulty, setProgressiveDifficulty] = useState(false);

  // Настройки формата
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

  // Модальные окна сохранения/загрузки
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [savedWorks, setSavedWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [currentWork, setCurrentWork] = useState(null);

  /**
   * Добавление нового блока фильтров
   */
  const addBlock = () => {
    setWorkBlocks([
      ...workBlocks,
      {
        id: uuid(),
        topic: null,
        subtopics: [],
        difficulty: [],
        tags: [],
        source: null,
        year: null,
        count: 1,
      },
    ]);
  };

  /**
   * Обновление блока
   */
  const updateBlock = (index, field, value) => {
    const newBlocks = [...workBlocks];
    newBlocks[index][field] = value;

    // Сбрасываем подтемы при смене темы
    if (field === 'topic') {
      newBlocks[index].subtopics = [];
    }

    setWorkBlocks(newBlocks);
  };

  /**
   * Удаление блока
   */
  const removeBlock = (index) => {
    setWorkBlocks(workBlocks.filter((_, i) => i !== index));
  };

  /**
   * Получение общего количества задач
   */
  const getTotalTaskCount = () => {
    return workBlocks.reduce((sum, block) => sum + (block.count || 0), 0);
  };

  /**
   * Получение количества уникальных тем
   */
  const getUniqueTopicsCount = () => {
    const uniqueTopics = new Set(workBlocks.map(b => b.topic).filter(Boolean));
    return uniqueTopics.size;
  };

  /**
   * Получение названия темы
   */
  function getTopicTitle(topicId) {
    const topic = topics.find(t => t.id === topicId);
    return topic ? (topic.ege_number ? `№${topic.ege_number} — ${topic.title}` : topic.title) : 'Не выбрана';
  }

  /**
   * Генерация работы
   */
  const handleGenerate = async () => {
    if (workBlocks.length === 0) {
      message.warning('Добавьте хотя бы один блок задач');
      return;
    }

    // Проверка, что все блоки заполнены
    for (let i = 0; i < workBlocks.length; i++) {
      if (!workBlocks[i].topic) {
        message.error(`Блок ${i + 1}: выберите тему`);
        return;
      }
      if (!workBlocks[i].count || workBlocks[i].count < 1) {
        message.error(`Блок ${i + 1}: укажите количество задач`);
        return;
      }
    }

    await generateFromStructure(workBlocks, {
      variantsMode,
      variantsCount,
      sortType,
      progressiveDifficulty,
    });
  };

  /**
   * Сброс формы
   */
  const handleReset = () => {
    reset();
    setWorkBlocks([]);
    form.resetFields();
    setCurrentWork(null);
  };

  /**
   * Сохранение работы
   */
  const handleSave = async (values) => {
    if (currentWork?.id) {
      await handleUpdateWork(currentWork.id, values, variants);
    } else {
      const work = await handleSaveWork(values, variants);
      if (work) {
        setCurrentWork(work);
      }
    }
    setSaveModalVisible(false);
  };

  /**
   * Загрузка работы
   */
  const handleOpenLoadModal = async () => {
    setLoadModalVisible(true);
    setLoadingWorks(true);
    try {
      const works = await handleLoadWorks();
      setSavedWorks(works);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleLoad = async (workId) => {
    setLoadingWorks(true);
    try {
      const { work, variants: loadedVariants } = await handleLoadWork(workId);
      setVariants(loadedVariants);
      form.setFieldsValue({
        workTitle: work.title,
      });
      setCurrentWork(work);
      setLoadModalVisible(false);
      message.success(`Работа "${work.title}" успешно загружена`);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleDelete = async (workId, workTitle) => {
    await handleDeleteWork(workId);
    setSavedWorks(savedWorks.filter(w => w.id !== workId));
  };

  useEffect(() => {
    if (!cryptogramEnabled) return;
    setCompactMode(false);
    setShowAnswersInline(false);
  }, [cryptogramEnabled]);

  /**
   * Экспорт вариантов в Markdown (для Obsidian)
   */
  const handleExportMD = () => {
    if (!variants.length) return;
    const workTitle = form.getFieldValue('workTitle') || 'Контрольная работа';

    let md = `# ${workTitle}\n\n`;
    variants.forEach(variant => {
      md += `## ${variantLabel} ${variant.number}\n\n`;
      variant.tasks.forEach((task, idx) => {
        md += `**${idx + 1}.** \`${task.code}\`\n\n${task.statement_md}\n\n`;
        if (task.answer) {
          md += `> **Ответ:** ${task.answer}\n\n`;
        }
        md += `---\n\n`;
      });
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workTitle}.md`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
    message.success('Markdown успешно сохранён');
  };

  /**
   * Рендеринг варианта через переиспользуемый компонент
   */
  const renderVariant = (variant, variantIndex) => (
    <VariantRenderer
      key={variant.number}
      variant={variant}
      variantIndex={variantIndex}
      compactMode={compactMode}
      fontSize={fontSize}
      columns={columns}
      showStudentInfo={showStudentInfo}
      showAnswersInline={showAnswersInline}
      solutionSpace={solutionSpace}
      variantLabel={variantLabel}
      hideTaskPrefixes={hideTaskPrefixes}
      dragDropHandlers={dragDropHandlers}
      onEditTask={taskEditing.handleEditTask}
      onReplaceTask={taskEditing.handleReplaceTask}
      cryptogramEnabled={cryptogramEnabled}
      cryptogramPhrase={cryptogramPhrase}
    />
  );

  return (
    <div className="task-worksheet-container">
      <div className="no-print" style={{ marginBottom: 16 }}>
        <PageHeader title="Контрольные работы" lede="Генератор вариантов с задачами из разных тем" />
        <Form form={form} layout="vertical" onFinish={handleGenerate} initialValues={{ workTitle: 'Контрольная работа' }}>
          <Collapse
            defaultActiveKey={['structure', 'variants', 'format']}
            items={[
              {
                key: 'structure',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UnorderedListOutlined />
                    <span>Структура работы</span>
                    {workBlocks.length > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 400 }}>
                        {workBlocks.length} {workBlocks.length === 1 ? 'блок' : 'блока'} · {getTotalTaskCount()} задач
                      </span>
                    )}
                  </span>
                ),
                children: (
                  <>
                    {workBlocks.length === 0 && (
                      <Alert
                        message="Добавьте блоки задач для составления контрольной работы"
                        description="Каждый блок позволяет настроить количество и фильтры для задач из определённой темы"
                        type="info"
                        style={{ marginBottom: 16 }}
                      />
                    )}

                    {workBlocks.map((block, index) => (
                      <FilterBlock
                        key={block.id}
                        block={block}
                        index={index}
                        topics={topics}
                        subtopics={subtopics}
                        tags={tags}
                        sources={sources}
                        years={years}
                        onChange={updateBlock}
                        onRemove={removeBlock}
                      />
                    ))}

                    <Button
                      type="dashed"
                      block
                      icon={<PlusOutlined />}
                      onClick={addBlock}
                      style={{ marginBottom: 16 }}
                    >
                      Добавить блок задач
                    </Button>

                    {workBlocks.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {workBlocks.map((block, i) => (
                          <Tag key={block.id} color="blue" style={{ fontSize: 12, padding: '2px 8px' }}>
                            {getTopicTitle(block.topic)} · {block.count} зад.
                          </Tag>
                        ))}
                      </div>
                    )}
                  </>
                ),
              },
              {
                key: 'variants',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ThunderboltOutlined />
                    <span>Генерация вариантов</span>
                  </span>
                ),
                children: (
                  <VariantSettings
                    variantsCount={variantsCount}
                    setVariantsCount={setVariantsCount}
                    variantsMode={variantsMode}
                    setVariantsMode={setVariantsMode}
                    sortType={sortType}
                    setSortType={setSortType}
                    progressiveDifficulty={progressiveDifficulty}
                    setProgressiveDifficulty={setProgressiveDifficulty}
                    showTasksCount={true}
                    tasksPerVariant={getTotalTaskCount()}
                  />
                ),
              },
              {
                key: 'format',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PrinterOutlined />
                    <span>Формат печати</span>
                  </span>
                ),
                children: (
                  <FormatSettings
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
                    tasksCount={getTotalTaskCount()}
                  />
                ),
              },
            ]}
          />

          <Form.Item style={{ marginTop: 16 }}>
            <ActionButtons
              hasVariants={variants.length > 0}
              loading={loading}
              onGenerate
              onOpenLoad={handleOpenLoadModal}
              onSave={() => setSaveModalVisible(true)}
              onPrint={handlePrint}
              onExportPDF={() => handleExportPDF(printRef, form.getFieldValue('workTitle'))}
              onExportMD={handleExportMD}
              onReset={handleReset}
              exporting={exporting}
              saving={saving}
              generateLabel="Сформировать работу"
              generateDisabled={workBlocks.length === 0}
            />
          </Form.Item>
        </Form>

        {/* Превью */}
        <VariantStats variants={variants} showAnswersPage={showAnswersPage} />
        {variants.length > 0 && variants[0]?.tasks?.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Button onClick={() => setParallelOpen(true)}>
              🧬 Параллельные варианты (по образцу)
            </Button>
          </div>
        )}
        <ParallelVariantsModal
          open={parallelOpen}
          onClose={() => setParallelOpen(false)}
          baseTasks={variants[0]?.tasks || []}
          excludeTaskIds={variants.slice(1).flatMap((v) => (v.tasks || []).map((t) => t.id))}
          baseTitle={form.getFieldValue('workTitle') || 'Контрольная работа'}
        />
      </div>

      {/* Рабочий лист с клеткой */}
      {variants.length > 0 && (
        <WorksheetGridPrint
          pages={variants.map(v => ({
            title: form.getFieldValue('workTitle') || 'Контрольная работа',
            label: `${variantLabel} ${v.number}`,
            tasks: v.tasks,
          }))}
          hideTaskPrefixes={hideTaskPrefixes}
        />
      )}

      {/* Печатный лист */}
      {variants.length > 0 && (
        <div ref={printRef} className="printable-worksheet">
          {compactMode && columns > 1 ? (
            (() => {
              const pages = [];
              for (let i = 0; i < variants.length; i += columns) {
                const pageVariants = variants.slice(i, i + columns);
                pages.push(
                  <div key={i} className="variants-page">
                    <div
                      className="compact-variants-grid"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${columns}, 1fr)`,
                        columnGap: '10px',
                      }}
                    >
                      {pageVariants.map((variant, idx) => renderVariant(variant, i + idx))}
                    </div>
                  </div>
                );
              }
              return pages;
            })()
          ) : (
            variants.map((variant, index) => renderVariant(variant, index))
          )}
          <AnswersPage
            variants={variants}
            variantLabel={variantLabel}
            show={showAnswersPage}
            cryptogramEnabled={cryptogramEnabled}
            cryptogramPhrase={cryptogramPhrase}
          />
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" tip="Генерируем варианты..." />
        </div>
      )}

      {/* Модальные окна */}
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
        onSave={handleSave}
        saving={saving}
        variantsCount={variants.length}
        tasksCount={variants.reduce((sum, v) => sum + v.tasks.length, 0)}
        initialTitle={currentWork?.title || 'Контрольная работа'}
        initialTimeLimit={currentWork?.time_limit ?? null}
        isEdit={!!currentWork?.id}
      />

      <LoadWorkModal
        visible={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        works={savedWorks}
        loading={loadingWorks}
        onLoad={handleLoad}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default TestWorkGenerator;
