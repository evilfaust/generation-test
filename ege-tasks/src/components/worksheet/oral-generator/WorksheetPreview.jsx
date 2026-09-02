import PrintableWorksheet from '../../PrintableWorksheet';
import PrintSheet from '../../print-sheet/PrintSheet';
import SheetCryptogram from './SheetCryptogram';

export default function WorksheetPreview({
  printRef,
  variants,
  outputMode,
  // sheet
  columns,
  margins,
  figureSize,
  showFigures,
  headerMode,
  sheetMeta,
  hideTaskPrefixes,
  variantLabel,
  fontScale,
  fontFamily,
  answerStyle,
  solutionSpace,
  solutionFill,
  tasksPerPage,
  showFooter,
  showTaskCode,
  showStudentInfo,
  showAnswersInline,
  showAnswersPage,
  cryptogramEnabled,
  cryptogramPhrase,
  dragDropHandlers,
  onSetFigureSize,
  workTitle,
  // cards
  cardFormat,
  showCardAnswers,
  showCardSolutions,
  showCardStudentInfo,
  topics,
  tags,
  subtopics,
  setVariants,
  taskEditing,
}) {
  if (!variants || variants.length === 0) return null;

  if (outputMode === 'sheet') {
    return (
      <div ref={printRef}>
        <PrintSheet
          variants={variants}
          variantLabel={variantLabel || 'Вариант'}
          headerMode={headerMode}
          layout="workbook"
          columns={columns}
          margins={margins}
          showAnswersPage={showAnswersPage}
          meta={{
            ...sheetMeta,
            // Пустой заголовок = название работы: учителю не надо дублировать
            // его руками, но переопределить можно.
            title: sheetMeta.title || workTitle || 'Лист задач',
            showStudentFields: showStudentInfo,
            alwaysShowVariant: false,
          }}
          options={{
            answerStyle,
            solutionSpace,
            solutionFill,
            tasksPerPage,
            hideTaskPrefixes,
            showTaskCode,
            showAnswersInline,
            fontScale,
            fontFamily,
            showFooter,
            figureSize,
            showFigures,
          }}
          editing={{
            dragDropHandlers,
            onEditTask: taskEditing.handleEditTask,
            onReplaceTask: taskEditing.handleReplaceTask,
            onSetFigureSize,
          }}
          renderTail={cryptogramEnabled
            ? (variant) => <SheetCryptogram variant={variant} phrase={cryptogramPhrase} />
            : null}
        />
      </div>
    );
  }

  // outputMode === 'cards'
  return (
    <PrintableWorksheet
      ref={printRef}
      key={variants.map(v => v.tasks.map(t => t.id).join(',')).join('|')}
      cards={variants.map(v => v.tasks)}
      title={variantLabel || 'Проверочная работа'}
      showAnswers={showCardAnswers}
      showSolutions={showCardSolutions}
      format={cardFormat}
      cardsCount={variants.length}
      tasksPerCard={variants[0]?.tasks.length || 0}
      topicName=""
      variantLabel={variantLabel || 'Проверочная работа'}
      topics={topics}
      tags={tags}
      subtopics={subtopics}
      hideTaskPrefixes={hideTaskPrefixes}
      fontSize={12}
      showStudentInfo={showCardStudentInfo}
      onEditTask={taskEditing.handleEditTask}
      onCardsChange={(newCards) => {
        const newVariants = variants.map((v, i) => ({
          ...v,
          tasks: newCards[i] || v.tasks,
        }));
        setVariants(newVariants);
      }}
    />
  );
}
