// latex-fixer.js
// Постпроцессор LaTeX-формул, извлечённых из sdamgia.ru — нормализация под KaTeX.
//
// Применяется в pdf-service.js (cleanLatexFormula) ПОСЛЕ всех русскоязычных
// замен («дробь:», «корень из:» и т.п.). Принимает строку LaTeX без $-обёрток.
//
// Принципы:
//   - Каждое правило — отдельная функция fixFoo(text).
//   - Правила идемпотентны: повторное применение не должно ничего ломать.
//   - Правила консервативны: лучше пропустить редкий случай, чем испортить.
//   - Все правила — регулярки, без AST-парсинга LaTeX.
//
// Тесты — в latex-fixer.test.js.

/**
 * Команды, которые часто пишутся слитно с буквенным аргументом без скобок:
 * \angleABC → \angle{ABC}, \widehatXYZ → \widehat{XYZ}, \overrightarrowCM → \overrightarrow{CM}.
 * Только для аргументов из латинских букв (1+ символов).
 */
const SLAMMED_COMMANDS = [
  'angle', 'widehat', 'widetilde',
  'overrightarrow', 'overleftarrow', 'overline', 'underline',
  'vec', 'bar', 'hat', 'tilde', 'mathring', 'dot', 'ddot',
  'mathbf', 'mathrm', 'mathit', 'mathcal', 'mathbb', 'mathfrak',
  'underset', 'overset', 'phantom',
];

const SLAMMED_RE = new RegExp(
  `\\\\(${SLAMMED_COMMANDS.join('|')})([A-Za-z][A-Za-z0-9]*)`,
  'g'
);

export function fixSlammedCommands(text) {
  return text.replace(SLAMMED_RE, (_, cmd, arg) => `\\${cmd}{${arg}}`);
}

/**
 * Русские нотации тригонометрии, которых нет в KaTeX по умолчанию:
 * \tg, \ctg, \arctg, \arcctg, \cosec, \arccosec → \operatorname{...}.
 * \sh, \ch, \th, \cth — гиперболические (русские).
 */
const RU_TRIG_COMMANDS = ['tg', 'ctg', 'arctg', 'arcctg', 'cosec', 'arccosec', 'sh', 'ch', 'th', 'cth'];
const RU_TRIG_RE = new RegExp(
  `\\\\(${RU_TRIG_COMMANDS.join('|')})(?![A-Za-z])`,
  'g'
);

export function fixRussianTrig(text) {
  return text.replace(RU_TRIG_RE, (_, cmd) => `\\operatorname{${cmd}}`);
}

/**
 * «N г» (артефакт парсинга «градусов» — sdamgia рендерит «°» как картинку,
 * у которой alt = «г») → N^{\circ}.
 * Паттерн: цифра(ы), пробелы, «г», граница (не буква/цифра).
 */
export function fixDegreesArtifact(text) {
  // Случаи: "90 г,", "90 г=", "90 г ", "180 г.", "90 г$"
  return text.replace(/(\d+)\s+г(?=[\s,.\-+=)*/\]}]|$)/g, '$1^{\\circ}');
}

/**
 * Юникодный знак градуса °:  "30°" → "30^{\circ}".
 */
export function fixDegreeSymbol(text) {
  return text.replace(/(\d+)\s*°/g, '$1^{\\circ}');
}

/**
 * Степень в круглых скобках без фигурных: a ^ ( x + b ) → a^{x+b}.
 * Только для не-вложенных скобок (без вложенных «(»).
 */
export function fixPowerParens(text) {
  return text.replace(/\^\s*\(\s*([^()]+?)\s*\)/g, '^{$1}');
}

/**
 * Индекс в круглых скобках без фигурных: a _ ( i + j ) → a_{i+j}.
 */
export function fixSubscriptParens(text) {
  return text.replace(/_\s*\(\s*([^()]+?)\s*\)/g, '_{$1}');
}

/**
 * Многосимвольная степень/индекс без скобок: x^23 → x^{23}, x^abc → x^{abc}.
 * Срабатывает только если за ^/_ идёт 2+ латинских букв/цифр подряд.
 * (Одиночный символ — нормально для KaTeX.)
 */
export function fixMultiCharSuperSub(text) {
  // Берём только чисто-буквенные или чисто-цифровые последовательности.
  // Смешанные (`_1B`, `_x2`) НЕ трогаем — это часто остатки внутри уже
  // обёрнутых кластеров (см. fixDoubleSubscript), оборачивать повторно нельзя.
  //
  // Lookahead `(?![A-Za-z0-9_])` — НЕ оборачивать, если следом ещё один `_`,
  // потому что тогда KaTeX получит двойной subscript (S_{AB}_1B — broken).
  // Старое поведение для `S_AB_1B` — KaTeX рендерит как S_A B_1 B (некрасиво,
  // но валидно). Семантически восстановить намерение автора без AST нельзя.
  text = text.replace(/\^([A-Za-z]{2,})(?![A-Za-z0-9_])/g, '^{$1}');
  text = text.replace(/\^(\d{2,})(?![A-Za-z0-9_])/g, '^{$1}');
  text = text.replace(/_([A-Za-z]{2,})(?![A-Za-z0-9_])/g, '_{$1}');
  text = text.replace(/_(\d{2,})(?![A-Za-z0-9_])/g, '_{$1}');
  return text;
}

/**
 * Аргумент функции в круглых скобках без фигурных: \sqrt ( x ) → \sqrt{x},
 * \sin ( x ) тоже, но \sin(x) для KaTeX нормально — оставляем как есть.
 * Здесь чиним только команды, для которых ()-скобки рендерятся как часть результата.
 */
const PAREN_AS_ARG_CMDS = ['sqrt', 'cbrt'];
const PAREN_ARG_RE = new RegExp(
  `\\\\(${PAREN_AS_ARG_CMDS.join('|')})\\s*\\(\\s*([^()]+?)\\s*\\)`,
  'g'
);

export function fixFunctionParenArg(text) {
  return text.replace(PAREN_ARG_RE, (_, cmd, arg) => `\\${cmd}{${arg}}`);
}

/**
 * Двойной subscript без скобок: S_A_1B_1 → S_{A_1B_1}.
 * Регулярка: после _ идёт буква/цифра + один или более _<буква/цифра+>.
 */
export function fixDoubleSubscript(text) {
  // Захватываем кластер вида A_1B_1C_1 после внешнего _.
  // Чтобы быть идемпотентным, нужно знать, не находимся ли мы УЖЕ внутри {},
  // — потому что регулярка из-за backtrack может матчить и подстроку.
  // Поэтому идём вручную с подсчётом баланса.
  let out = '';
  let depth = 0;
  let i = 0;
  // Строгий шаблон: одна буква + цифровой индекс, повторяющиеся группы.
  // Ловит классические кластеры вида A_1B_1C_1 (геометрические индексы),
  // но НЕ трогает «обычные» вроде S_AB_1B — где S_AB это просто S с
  // индексом AB и оборачивать нельзя (получим двойной subscript broken).
  const re = /^_([A-Za-z](?:_\d+)+(?:[A-Za-z](?:_\d+)+)*)/;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '{') { depth++; out += ch; i++; continue; }
    if (ch === '}') { depth--; out += ch; i++; continue; }
    if (depth === 0 && ch === '_') {
      const m = text.slice(i).match(re);
      if (m) {
        out += `_{${m[1]}}`;
        i += m[0].length;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Десятичная запятая в формуле: 0,5 → 0{,}5.
 * Иначе KaTeX вставляет пробел после запятой (как после знака пунктуации).
 */
export function fixDecimalComma(text) {
  return text.replace(/(\d),(\d)/g, '$1{,}$2');
}

/**
 * \log a b → \log_{a} b (sdamgia теряет _ при парсинге MathML).
 * Срабатывает когда после \log/\lg/\ln идёт пробел, одиночный символ-основание,
 * пробел, и аргумент. Консервативно: основание — одна буква или одна цифра.
 */
export function fixLogBase(text) {
  // \log a 32 → \log_{a} 32
  text = text.replace(/\\(log|lg|ln)\s+([A-Za-z]|\d+)\s+(\S+)/g, '\\$1_{$2} $3');
  // \log ( a ) x → \log_{a} x (после fixPowerParens круглые ещё на месте)
  text = text.replace(/\\(log|lg|ln)\s*\(\s*([^()]+?)\s*\)\s+(\S+)/g, '\\$1_{$2} $3');
  return text;
}

/**
 * Косметика: пробелы внутри круглых скобок «( x )» → «(x)».
 * Не критично для рендера, но улучшает читаемость и экономит место.
 */
export function fixSpacesInParens(text) {
  // ( x → (x  и  x ) → x)
  // Только если внутри один пробел сразу после/перед скобкой.
  text = text.replace(/\(\s+/g, '(');
  text = text.replace(/\s+\)/g, ')');
  return text;
}

/**
 * Удалить пробелы перед ^ и _ (KaTeX не любит «a ^ 2»).
 */
export function fixSpaceBeforeSupSub(text) {
  return text.replace(/\s+([\^_])/g, '$1');
}

/**
 * Полный пайплайн: применить все фиксы в правильном порядке.
 * Порядок важен:
 *   1) слитные команды (\angleABC),
 *   2) русские триг.команды,
 *   3) градусы,
 *   4) аргументы функций в скобках,
 *   5) логарифмы,
 *   6) убрать пробелы перед ^/_,
 *   7) скобки в степенях/индексах,
 *   8) ДВОЙНОЙ subscript раньше многосимвольного — иначе многосимвольный
 *      съест внутренние _ (S_A_1B_1 → S_A_{1B}_1, что испортит структуру),
 *   9) косметика (запятая, пробелы в скобках).
 */
export function fixLatex(text) {
  if (!text) return text;
  let t = text;
  t = fixSlammedCommands(t);
  t = fixRussianTrig(t);
  t = fixDegreesArtifact(t);
  t = fixDegreeSymbol(t);
  t = fixFunctionParenArg(t);
  t = fixLogBase(t);
  t = fixSpaceBeforeSupSub(t);
  t = fixPowerParens(t);
  t = fixSubscriptParens(t);
  t = fixDoubleSubscript(t);   // ДО fixMultiCharSuperSub
  t = fixMultiCharSuperSub(t);
  t = fixDecimalComma(t);
  t = fixSpacesInParens(t);
  return t;
}

export default fixLatex;
