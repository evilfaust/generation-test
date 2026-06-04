// Единый хелпер печати с временным @page-стилем.
// Раньше этот болерплейт (создать <style> с @page → window.print() → убрать стиль
// через setTimeout) дублировался в десятке генераторов с разными style.id.
//
// @page-стиль инжектируется динамически перед печатью, потому что padding/поля
// элемента работают только для первой страницы — для многостраничной печати
// размер/поля задаются именно через @page (см. ege-tasks/CLAUDE.md § Print Patterns).

let _printStyleCounter = 0;

/**
 * @param {Object}  [opts]
 * @param {string}  [opts.size='A4 portrait']     значение @page size
 * @param {string}  [opts.margin='0']             значение @page margin
 * @param {number}  [opts.delayBeforePrint=0]     пауза перед window.print() (мс),
 *                                                чтобы React успел отрисовать print-DOM
 */
export function printPaged({ size = 'A4 portrait', margin = '0', delayBeforePrint = 0 } = {}) {
  const id = `print-page-style-${++_printStyleCounter}`;
  document.getElementById(id)?.remove();
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `@page { size: ${size}; margin: ${margin}; }`;
  document.head.appendChild(style);

  const run = () => {
    window.print();
    setTimeout(() => document.getElementById(id)?.remove(), 1500);
  };

  if (delayBeforePrint > 0) setTimeout(run, delayBeforePrint);
  else run();
}
