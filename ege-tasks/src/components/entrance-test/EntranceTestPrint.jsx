import PrintSheet from '../print-sheet/PrintSheet';

/* Печатный движок листа переехал в components/print-sheet (общий с «Листом
   задач» в Генераторе). Здесь остался только профиль входной контрольной:
   полная шапка с инструкцией и зона решения по умолчанию M.

   Реэкспорты — для тестов и старых импортов геометрии. */
export { paginateByHeight, BODY_W_MM, PAGE_W_MM, PAGE_H_MM } from '../print-sheet/geometry';

/**
 * Печатный лист входной контрольной работы.
 *
 * layout: 'sheet' — набор задач; 'workbook' — рабочая тетрадь (зона решения).
 */
export default function EntranceTestPrint({
  variants = [],
  meta = {},
  layout = 'sheet',
  options = {},
  variantLabel = 'Вариант',
  brand = 'Lemma',
  showAnswersPage = true,
}) {
  return (
    <PrintSheet
      variants={variants}
      meta={meta}
      headerMode="full"
      layout={layout}
      variantLabel={variantLabel}
      brand={brand}
      showAnswersPage={showAnswersPage}
      options={{
        answerLine: true,
        solutionSpace: 'm',
        solutionFill: 'grid',
        ...options,
      }}
    />
  );
}
