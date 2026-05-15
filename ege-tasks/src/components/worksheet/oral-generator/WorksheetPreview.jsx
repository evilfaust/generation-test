import PrintableWorksheet from '../../PrintableWorksheet';
import WorksheetGridPrint from '../WorksheetGridPrint';
import VariantRenderer from '../VariantRenderer';
import AnswersPage from '../AnswersPage';

export default function WorksheetPreview({
  printRef,
  variants,
  outputMode,
  workTitle,
  // sheet
  sheetFormat,
  columns,
  fontSize,
  compactMode,
  hideTaskPrefixes,
  showStudentInfo,
  showAnswersInline,
  showAnswersPage,
  solutionSpace,
  variantLabel,
  cryptogramEnabled,
  cryptogramPhrase,
  dragDropHandlers,
  taskEditing,
  // cards
  cardFormat,
  showCardAnswers,
  showCardSolutions,
  showCardStudentInfo,
  topics,
  tags,
  subtopics,
  setVariants,
}) {
  if (!variants || variants.length === 0) return null;

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

  if (outputMode === 'sheet') {
    const pageClass = `sheet-page sheet-page-${sheetFormat.toLowerCase()}`;
    const pageContents = [];

    if (compactMode && columns > 1) {
      for (let i = 0; i < variants.length; i += columns) {
        const pageVariants = variants.slice(i, i + columns);
        pageContents.push({
          key: `page-${i}`,
          content: (
            <div
              className="compact-variants-grid"
              style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, columnGap: '10px' }}
            >
              {pageVariants.map((variant, idx) => renderVariant(variant, i + idx))}
            </div>
          ),
        });
      }
    } else {
      variants.forEach((variant, index) => {
        pageContents.push({
          key: `variant-${variant.number}`,
          content: renderVariant(variant, index),
        });
      });
    }

    if (showAnswersPage) {
      pageContents.push({
        key: 'answers',
        content: (
          <AnswersPage
            variants={variants}
            variantLabel={variantLabel}
            show={true}
            cryptogramEnabled={cryptogramEnabled}
            cryptogramPhrase={cryptogramPhrase}
          />
        ),
      });
    }

    const total = pageContents.length;

    return (
      <>
        <WorksheetGridPrint
          pages={variants.map(v => ({
            title: workTitle || 'Лист задач',
            label: `${variantLabel} ${v.number}`,
            tasks: v.tasks,
          }))}
          hideTaskPrefixes={hideTaskPrefixes}
        />
        <div ref={printRef} className="sheet-pages-preview">
          {pageContents.map(({ key, content }, pageIdx) => (
            <div key={key} className={pageClass}>
              {content}
              <div className="sheet-page-label no-print">{pageIdx + 1} / {total}</div>
            </div>
          ))}
        </div>
      </>
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
