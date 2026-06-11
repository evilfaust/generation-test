import './FormulaPalette.css';

/**
 * Палитра LaTeX: шаблоны и символы для быстрого набора формул.
 * Каждый элемент вставляется по курсору через onInsert({ before, after }):
 *   - структуры (дробь, корень…) — курсор встаёт в первый слот {};
 *   - символы (греческие, операторы) — просто вставляются.
 *
 * Подразумевается, что вставка идёт внутри математического режима
 * ($…$ или $$…$$); кнопки «fx» в тулбаре создают этот режим.
 */
const STRUCTURES = [
  { label: 'a⁄b', title: 'Дробь', before: '\\frac{', after: '}{}' },
  { label: 'xⁿ', title: 'Степень', before: '^{', after: '}' },
  { label: 'xₙ', title: 'Индекс', before: '_{', after: '}' },
  { label: '√', title: 'Корень', before: '\\sqrt{', after: '}' },
  { label: 'ⁿ√', title: 'Корень степени n', before: '\\sqrt[', after: ']{}' },
  { label: '( )', title: 'Авторазмер скобок', before: '\\left(', after: '\\right)' },
  { label: '|x|', title: 'Модуль', before: '\\left|', after: '\\right|' },
  { label: '→', title: 'Вектор', before: '\\vec{', after: '}' },
];

const OPERATORS = [
  { label: 'Σ', title: 'Сумма', before: '\\sum_{', after: '}^{}' },
  { label: '∏', title: 'Произведение', before: '\\prod_{', after: '}^{}' },
  { label: '∫', title: 'Интеграл', before: '\\int_{', after: '}^{}' },
  { label: 'lim', title: 'Предел', before: '\\lim_{', after: '}' },
  { label: '{', title: 'Система', before: '\\begin{cases} ', after: ' \\end{cases}' },
  { label: '[··]', title: 'Матрица 2×2', before: '\\begin{pmatrix} ', after: ' \\end{pmatrix}' },
];

const RELATIONS = [
  ['≤', '\\le '], ['≥', '\\ge '], ['≠', '\\ne '], ['≈', '\\approx '],
  ['±', '\\pm '], ['×', '\\times '], ['÷', '\\div '], ['⋅', '\\cdot '],
  ['∈', '\\in '], ['∉', '\\notin '], ['⊂', '\\subset '], ['∪', '\\cup '],
  ['∩', '\\cap '], ['∅', '\\varnothing '], ['∞', '\\infty '],
  ['→', '\\to '], ['⇒', '\\Rightarrow '], ['⇔', '\\Leftrightarrow '],
  ['∀', '\\forall '], ['∃', '\\exists '],
];

const GREEK = [
  ['α', '\\alpha '], ['β', '\\beta '], ['γ', '\\gamma '], ['δ', '\\delta '],
  ['ε', '\\varepsilon '], ['θ', '\\theta '], ['λ', '\\lambda '], ['μ', '\\mu '],
  ['π', '\\pi '], ['ρ', '\\rho '], ['σ', '\\sigma '], ['φ', '\\varphi '],
  ['ψ', '\\psi '], ['ω', '\\omega '],
  ['Δ', '\\Delta '], ['Σ', '\\Sigma '], ['Ω', '\\Omega '], ['Φ', '\\Phi '],
];

export default function FormulaPalette({ onInsert }) {
  const structBtn = (item) => (
    <button
      key={item.title}
      type="button"
      className="fp-btn"
      title={item.title}
      onClick={() => onInsert({ before: item.before, after: item.after })}
    >
      {item.label}
    </button>
  );

  const symBtn = ([label, cmd]) => (
    <button
      key={cmd}
      type="button"
      className="fp-btn fp-btn--sym"
      title={cmd.trim()}
      onClick={() => onInsert({ before: cmd, after: '' })}
    >
      {label}
    </button>
  );

  return (
    <div className="fp-palette">
      <div className="fp-group">
        <div className="fp-group__title">Структуры</div>
        <div className="fp-row">{STRUCTURES.map(structBtn)}</div>
      </div>
      <div className="fp-group">
        <div className="fp-group__title">Операторы</div>
        <div className="fp-row">{OPERATORS.map(structBtn)}</div>
      </div>
      <div className="fp-group">
        <div className="fp-group__title">Отношения и символы</div>
        <div className="fp-row">{RELATIONS.map(symBtn)}</div>
      </div>
      <div className="fp-group">
        <div className="fp-group__title">Греческие</div>
        <div className="fp-row">{GREEK.map(symBtn)}</div>
      </div>
    </div>
  );
}
