import PrintableWorksheet from '../../PrintableWorksheet';
import VariantRenderer from '../VariantRenderer';
import AnswersPage from '../AnswersPage';

export default function WorksheetPreview({
  printRef,
  variants,
  outputMode,
  // sheet
  hideTaskPrefixes,
  variantLabel,
  fontSize,
  columns,
  compactMode,
  showStudentInfo,
  showAnswersInline,
  showAnswersPage,
  solutionSpace,
  cryptogramEnabled,
  cryptogramPhrase,
  dragDropHandlers,
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
        {variants.map((variant, idx) => (
          <VariantRenderer
            key={variant.number || idx}
            variant={variant}
            variantIndex={idx}
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
        ))}
        <AnswersPage
          variants={variants}
          variantLabel={variantLabel}
          show={showAnswersPage}
          cryptogramEnabled={cryptogramEnabled}
          cryptogramPhrase={cryptogramPhrase}
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
      fontSize={fontSize}
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
