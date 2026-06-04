import TrigMCSaveModal from './TrigMCSaveModal';
import TrigMCPrintLayout from './TrigMCPrintLayout';

// Общий footer MC-теста для одиночных трига/oral-генераторов: модал сохранения
// теста A/B/C/D + его печать. Раньше эти ~18 строк JSX дублировались в 13 генераторах.
// Значения берутся из useTrigMCModal() (open/onClose/printTest/onPrint), остальное —
// специфика генератора (generatorType/Title, tasksData, settings, опц. fillMode).
export function TrigMCSection({
  open,
  onClose,
  printTest,
  onPrint,
  tasksData,
  generatorType,
  generatorTitle,
  settings,
  fillMode,
}) {
  return (
    <>
      <TrigMCSaveModal
        open={open}
        onClose={onClose}
        tasksData={tasksData}
        generatorType={generatorType}
        generatorTitle={generatorTitle}
        settings={settings}
        fillMode={fillMode}
        onPrint={onPrint}
      />
      {printTest && (
        <TrigMCPrintLayout
          variants={printTest.variants}
          title={printTest.title}
          shuffleMode={printTest.shuffle_mode || 'fixed'}
        />
      )}
    </>
  );
}

export default TrigMCSection;
