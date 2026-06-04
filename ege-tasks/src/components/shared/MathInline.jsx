import katex from 'katex';

// Общий инлайновый рендер LaTeX через KaTeX. Раньше эта 5-строчная функция
// дублировалась в ~15 генераторах и print-layout'ах — теперь единый источник.
// throwOnError:false — битая формула падает на сырой текст, а не на исключение.
export function MathInline({ latex, displayMode = false, trust = false }) {
  let html;
  try {
    html = katex.renderToString(latex ?? '', { throwOnError: false, displayMode, trust });
  } catch {
    html = latex ?? '';
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default MathInline;
