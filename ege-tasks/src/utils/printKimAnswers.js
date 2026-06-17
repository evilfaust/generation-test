// Печать листа ответов для учителя (режим КИМ) — отдельно от буклета ученика.
//
// КИМ-буклет печатается на A5 с нулевыми полями (постоянная инъекция
// `@page { size:A5; margin:0 }` пока активен режим КИМ). Лист ответов учителю
// удобнее на A4 с полями, поэтому:
//   1. добавляем последним в <head> `@page { size:A4; margin:12mm }` —
//      перебивает A5-инъекцию (безымянные @page решаются по порядку);
//   2. вешаем на <body> класс `printing-kim-answers` — статический CSS
//      (EgeVariantGenerator.css) прячет .kim-booklet и показывает
//      .kim-answers-sheet именно при печати с этим классом.
// После печати (afterprint) всё откатывается, КИМ-буклет печатается как обычно.
export function printKimAnswers() {
  const styleId = 'kim-answers-page-style';
  document.getElementById(styleId)?.remove();
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = '@page { size: A4 portrait; margin: 12mm; }';
  document.head.appendChild(style);

  document.body.classList.add('printing-kim-answers');

  const cleanup = () => {
    style.remove();
    document.body.classList.remove('printing-kim-answers');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup, { once: true });

  window.print();
}
