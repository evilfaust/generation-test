import { useState, useCallback } from 'react';
import { isFiniteDecimalAnswer } from '../utils/oralAnswerFilter';

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ═════════════════════════════════════════════════════════════════════════════
// Категории действий с обыкновенными дробями для устного счёта старшеклассников.
// Все пулы подобраны так, чтобы ответ был целым или конечной десятичной.
// Все примеры рассчитаны на короткое мысленное преобразование к общему
// знаменателю либо на типовой приём (умножение на НОК).
// ═════════════════════════════════════════════════════════════════════════════

// 1. (±a/b ± c/d) · N — сумма/разность дробей × целое (N кратно НОК знаменателей)
function genSumFracTimesInt() {
  const POOLS = [
    { expr: '\\left(1\\dfrac{2}{3} + \\dfrac{3}{8}\\right) \\cdot 24',                ans: '49'   },
    { expr: '\\left(1\\dfrac{7}{8} - 8\\dfrac{1}{2}\\right) \\cdot 8',                ans: '-53'  },
    { expr: '\\left(-2\\dfrac{3}{4} - \\dfrac{3}{8}\\right) \\cdot 160',              ans: '-500' },
    { expr: '\\left(\\dfrac{5}{6} - \\dfrac{1}{4}\\right) \\cdot 12',                  ans: '7'    },
    { expr: '\\left(\\dfrac{3}{4} + \\dfrac{1}{6}\\right) \\cdot 12',                  ans: '11'   },
    { expr: '\\left(\\dfrac{5}{6} + \\dfrac{1}{3}\\right) \\cdot 6',                   ans: '7'    },
    { expr: '\\left(2\\dfrac{1}{4} - \\dfrac{2}{3}\\right) \\cdot 12',                ans: '19'   },
    { expr: '\\left(\\dfrac{7}{8} - \\dfrac{5}{12}\\right) \\cdot 24',                ans: '11'   },
    { expr: '\\left(\\dfrac{2}{3} + \\dfrac{3}{5}\\right) \\cdot 15',                  ans: '19'   },
    { expr: '\\left(\\dfrac{1}{2} - \\dfrac{3}{8}\\right) \\cdot 16',                  ans: '2'    },
    { expr: '\\left(\\dfrac{5}{6} - \\dfrac{1}{2}\\right) \\cdot 18',                  ans: '6'    },
    { expr: '\\left(\\dfrac{5}{12} + \\dfrac{1}{4}\\right) \\cdot 24',                ans: '16'   },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 2. (±a/b ± c/d) · D — сумма/разность дробей × конечная десятичная
function genFracSumTimesDecimal() {
  const POOLS = [
    { expr: '\\left(-\\dfrac{7}{8} - 1\\dfrac{1}{6}\\right) \\cdot 2{,}4',  ans: '-4{,}9' },
    { expr: '\\left(\\dfrac{3}{4} + \\dfrac{1}{2}\\right) \\cdot 0{,}4',     ans: '0{,}5'  },
    { expr: '\\left(\\dfrac{5}{6} - \\dfrac{1}{3}\\right) \\cdot 0{,}6',     ans: '0{,}3'  },
    { expr: '\\left(\\dfrac{2}{3} + \\dfrac{1}{6}\\right) \\cdot 1{,}2',     ans: '1'      },
    { expr: '\\left(\\dfrac{3}{8} + \\dfrac{1}{4}\\right) \\cdot 1{,}6',     ans: '1'      },
    { expr: '\\left(\\dfrac{5}{12} + \\dfrac{1}{4}\\right) \\cdot 1{,}2',    ans: '0{,}8'  },
    { expr: '\\left(\\dfrac{3}{4} - \\dfrac{1}{2}\\right) \\cdot 0{,}8',     ans: '0{,}2'  },
    { expr: '\\left(\\dfrac{7}{10} + \\dfrac{1}{5}\\right) \\cdot 0{,}5',    ans: '0{,}45' },
    { expr: '\\left(\\dfrac{1}{4} + \\dfrac{1}{3}\\right) \\cdot 1{,}2',     ans: '0{,}7'  },
    { expr: '\\left(\\dfrac{3}{5} + \\dfrac{1}{4}\\right) \\cdot 2',          ans: '1{,}7'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 3. 0,D : a/b — десятичная делится на дробь
function genDecimalDivFrac() {
  const POOLS = [
    { expr: '0{,}42 : \\dfrac{3}{10}',  ans: '1{,}4'  },
    { expr: '0{,}6 : \\dfrac{3}{5}',     ans: '1'      },
    { expr: '0{,}5 : \\dfrac{1}{4}',     ans: '2'      },
    { expr: '1{,}2 : \\dfrac{3}{5}',     ans: '2'      },
    { expr: '0{,}9 : \\dfrac{3}{10}',    ans: '3'      },
    { expr: '0{,}4 : \\dfrac{2}{5}',     ans: '1'      },
    { expr: '0{,}8 : \\dfrac{4}{5}',     ans: '1'      },
    { expr: '0{,}75 : \\dfrac{3}{8}',    ans: '2'      },
    { expr: '0{,}25 : \\dfrac{1}{8}',    ans: '2'      },
    { expr: '0{,}35 : \\dfrac{7}{20}',   ans: '1'      },
    { expr: '1{,}5 : \\dfrac{3}{4}',     ans: '2'      },
    { expr: '0{,}28 : \\dfrac{7}{25}',   ans: '1'      },
    { expr: '0{,}18 : \\dfrac{9}{50}',   ans: '1'      },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 4. (a b/c - n) : d/e или (a/b + c/d) : e/f — скобка делится на дробь
function genBracketDivFrac() {
  const POOLS = [
    { expr: '\\left(5\\dfrac{1}{3} - 2\\right) : \\dfrac{5}{21}',                       ans: '14' },
    { expr: '\\left(\\dfrac{11}{18} + \\dfrac{2}{9}\\right) : \\dfrac{5}{48}',          ans: '8'  },
    { expr: '\\left(2\\dfrac{1}{2} - 1\\right) : \\dfrac{3}{4}',                        ans: '2'  },
    { expr: '\\left(\\dfrac{5}{6} - \\dfrac{1}{3}\\right) : \\dfrac{1}{6}',             ans: '3'  },
    { expr: '\\left(\\dfrac{2}{3} + \\dfrac{1}{6}\\right) : \\dfrac{5}{12}',            ans: '2'  },
    { expr: '\\left(3 - \\dfrac{1}{4}\\right) : \\dfrac{11}{8}',                        ans: '2'  },
    { expr: '\\left(\\dfrac{7}{8} + \\dfrac{1}{4}\\right) : \\dfrac{3}{8}',             ans: '3'  },
    { expr: '\\left(1\\dfrac{1}{2} - \\dfrac{1}{6}\\right) : \\dfrac{2}{3}',            ans: '2'  },
    { expr: '\\left(\\dfrac{5}{12} + \\dfrac{1}{3}\\right) : \\dfrac{3}{8}',            ans: '2'  },
    { expr: '\\left(2 - \\dfrac{1}{3}\\right) : \\dfrac{5}{6}',                          ans: '2'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 5. N · (a/b - c/d - e/f) — целое × сумма/разность трёх дробей
function genMultiFracTimesInt() {
  const POOLS = [
    { expr: '12 \\cdot \\left(\\dfrac{13}{24} - \\dfrac{7}{12} - \\dfrac{1}{6}\\right)',  ans: '-2{,}5' },
    { expr: '24 \\cdot \\left(\\dfrac{5}{6} - \\dfrac{3}{8} - \\dfrac{1}{4}\\right)',     ans: '5'      },
    { expr: '12 \\cdot \\left(\\dfrac{5}{6} - \\dfrac{1}{4} - \\dfrac{1}{3}\\right)',     ans: '3'      },
    { expr: '6 \\cdot \\left(\\dfrac{1}{2} - \\dfrac{1}{3} + \\dfrac{1}{6}\\right)',       ans: '2'      },
    { expr: '20 \\cdot \\left(\\dfrac{3}{4} - \\dfrac{1}{5} - \\dfrac{1}{2}\\right)',      ans: '1'      },
    { expr: '15 \\cdot \\left(\\dfrac{2}{3} + \\dfrac{1}{5} - \\dfrac{1}{3}\\right)',      ans: '8'      },
    { expr: '24 \\cdot \\left(\\dfrac{5}{12} - \\dfrac{1}{3} + \\dfrac{1}{8}\\right)',     ans: '5'      },
    { expr: '12 \\cdot \\left(\\dfrac{7}{12} - \\dfrac{1}{4} - \\dfrac{1}{6}\\right)',     ans: '2'      },
    { expr: '30 \\cdot \\left(\\dfrac{1}{2} + \\dfrac{1}{3} - \\dfrac{2}{5}\\right)',      ans: '13'     },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 6. (1/n) · 0,D + N — простое произведение плюс целое
function genFracProdPlusInt() {
  const POOLS = [
    { expr: '\\dfrac{1}{3} \\cdot 0{,}99 + 2',  ans: '2{,}33' },
    { expr: '\\dfrac{1}{2} \\cdot 0{,}48 + 1',  ans: '1{,}24' },
    { expr: '\\dfrac{1}{4} \\cdot 0{,}88 + 3',  ans: '3{,}22' },
    { expr: '\\dfrac{1}{5} \\cdot 1{,}5 + 2',    ans: '2{,}3'  },
    { expr: '\\dfrac{1}{3} \\cdot 0{,}9 + 1',    ans: '1{,}3'  },
    { expr: '\\dfrac{1}{2} \\cdot 0{,}6 + 4',    ans: '4{,}3'  },
    { expr: '\\dfrac{1}{4} \\cdot 0{,}8 + 1',    ans: '1{,}2'  },
    { expr: '\\dfrac{1}{6} \\cdot 0{,}6 + 2',    ans: '2{,}1'  },
    { expr: '\\dfrac{1}{5} \\cdot 0{,}5 + 1',    ans: '1{,}1'  },
    { expr: '\\dfrac{2}{3} \\cdot 0{,}9 + 1',    ans: '1{,}6'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 7. a/b : (-c/d) + e f/g — обратные дроби, целый ответ
function genFracDivPlusMixed() {
  const POOLS = [
    { expr: '\\dfrac{4}{11} : \\left(-\\dfrac{16}{33}\\right) + 5\\dfrac{3}{4}',  ans: '5' },
    { expr: '\\dfrac{3}{8} : \\left(-\\dfrac{3}{4}\\right) + 2\\dfrac{1}{2}',     ans: '2' },
    { expr: '\\dfrac{2}{5} : \\left(-\\dfrac{4}{15}\\right) + 4',                  ans: '2{,}5' },
    { expr: '\\dfrac{5}{6} : \\left(-\\dfrac{5}{12}\\right) + 3',                  ans: '1' },
    { expr: '\\dfrac{1}{4} : \\left(-\\dfrac{1}{2}\\right) + 1\\dfrac{1}{2}',     ans: '1' },
    { expr: '\\dfrac{7}{8} : \\left(-\\dfrac{7}{16}\\right) + 3',                  ans: '1' },
    { expr: '\\dfrac{3}{5} : \\left(-\\dfrac{6}{25}\\right) + 3\\dfrac{1}{2}',    ans: '1' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 8. 1 / (1/a - 1/b) — разность обратных, ответ целый или простой
function genOneOverDiff() {
  const POOLS = [
    { expr: '\\dfrac{1}{\\dfrac{1}{3} - \\dfrac{1}{4}}',   ans: '12' },
    { expr: '\\dfrac{1}{\\dfrac{1}{4} - \\dfrac{1}{5}}',   ans: '20' },
    { expr: '\\dfrac{1}{\\dfrac{1}{5} - \\dfrac{1}{6}}',   ans: '30' },
    { expr: '\\dfrac{1}{\\dfrac{1}{6} - \\dfrac{1}{7}}',   ans: '42' },
    { expr: '\\dfrac{1}{\\dfrac{1}{2} - \\dfrac{1}{3}}',   ans: '6'  },
    { expr: '\\dfrac{1}{\\dfrac{1}{9} - \\dfrac{1}{12}}',  ans: '36' },
    { expr: '\\dfrac{1}{\\dfrac{1}{6} - \\dfrac{1}{10}}',  ans: '15' },
    { expr: '\\dfrac{1}{\\dfrac{1}{8} - \\dfrac{1}{10}}',  ans: '40' },
    { expr: '\\dfrac{1}{\\dfrac{1}{4} - \\dfrac{1}{6}}',   ans: '12' },
    { expr: '\\dfrac{1}{\\dfrac{1}{3} - \\dfrac{1}{5}}',   ans: '7{,}5' },
    { expr: '\\dfrac{1}{\\dfrac{1}{2} - \\dfrac{1}{4}}',   ans: '4'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 9. a/b ± D ± (-c/d) — смесь обыкновенных и десятичных
function genFracDecMix() {
  const POOLS = [
    { expr: '\\dfrac{5}{2} - 2{,}5 - \\left(-\\dfrac{3}{5}\\right)',                ans: '0{,}6'  },
    { expr: '\\dfrac{3}{4} + 0{,}25 - \\dfrac{1}{2}',                                ans: '0{,}5'  },
    { expr: '\\dfrac{1}{2} - 0{,}3 + \\dfrac{1}{5}',                                 ans: '0{,}4'  },
    { expr: '\\dfrac{7}{10} - 0{,}2 - \\dfrac{1}{5}',                                ans: '0{,}3'  },
    { expr: '\\dfrac{3}{5} + 0{,}4 - \\dfrac{1}{2}',                                 ans: '0{,}5'  },
    { expr: '\\dfrac{9}{4} - 1{,}25 + \\left(-\\dfrac{1}{2}\\right)',                ans: '0{,}5'  },
    { expr: '\\dfrac{4}{5} - 0{,}5 + \\dfrac{3}{10}',                                ans: '0{,}6'  },
    { expr: '\\dfrac{7}{4} + 0{,}25 - 1',                                             ans: '1'      },
    { expr: '\\dfrac{1}{4} + 0{,}5 - \\dfrac{3}{4}',                                 ans: '0'      },
    { expr: '\\dfrac{5}{8} - 0{,}25 + \\dfrac{1}{8}',                                ans: '0{,}5'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 10. a/b · c/d - e/f — произведение дробей минус дробь, целый ответ
function genFracProdMinusFrac() {
  const POOLS = [
    { expr: '\\dfrac{8}{3} \\cdot \\dfrac{11}{5} - \\dfrac{13}{15}',  ans: '5' },
    { expr: '\\dfrac{5}{4} \\cdot \\dfrac{8}{3} - \\dfrac{1}{3}',     ans: '3' },
    { expr: '\\dfrac{7}{2} \\cdot \\dfrac{4}{3} - \\dfrac{2}{3}',     ans: '4' },
    { expr: '\\dfrac{9}{4} \\cdot \\dfrac{8}{3} - 2',                  ans: '4' },
    { expr: '\\dfrac{5}{6} \\cdot \\dfrac{12}{5} + \\dfrac{1}{2}',    ans: '2{,}5' },
    { expr: '\\dfrac{3}{4} \\cdot \\dfrac{8}{3} - 1',                  ans: '1' },
    { expr: '\\dfrac{7}{5} \\cdot \\dfrac{10}{3} + \\dfrac{2}{3}',    ans: '5' },
    { expr: '\\dfrac{4}{3} \\cdot \\dfrac{9}{2} - 4',                  ans: '2' },
    { expr: '\\dfrac{11}{6} \\cdot \\dfrac{12}{5} - \\dfrac{2}{5}',   ans: '4' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 11. a/b + c/d : e/f — порядок действий (сначала деление)
function genFracPlusFracDivFrac() {
  const POOLS = [
    { expr: '\\dfrac{7}{8} + \\dfrac{15}{4} : \\dfrac{10}{3}',   ans: '2'    },
    { expr: '\\dfrac{1}{4} + \\dfrac{3}{8} : \\dfrac{3}{2}',     ans: '0{,}5' },
    { expr: '\\dfrac{1}{6} + \\dfrac{5}{6} : \\dfrac{5}{2}',     ans: '0{,}5' },
    { expr: '\\dfrac{2}{3} + \\dfrac{4}{9} : \\dfrac{4}{3}',     ans: '1'    },
    { expr: '\\dfrac{1}{2} + \\dfrac{3}{4} : \\dfrac{3}{2}',     ans: '1'    },
    { expr: '\\dfrac{3}{4} + \\dfrac{5}{8} : \\dfrac{5}{2}',     ans: '1'    },
    { expr: '\\dfrac{1}{3} + \\dfrac{7}{12} : \\dfrac{7}{4}',    ans: '\\dfrac{2}{3}' }, // дробный — фильтруется decimalOnly
    { expr: '\\dfrac{2}{5} + \\dfrac{3}{10} : \\dfrac{3}{4}',    ans: '0{,}8' },
    { expr: '\\dfrac{5}{6} + \\dfrac{1}{2} : \\dfrac{3}{2}',     ans: '1{,}1{,}6' }, // не использую — некрасиво
  ];
  // Отфильтруем «некрасивые» примеры
  const goodPools = POOLS.filter(p =>
    /^-?\d+({,}\d+|\.\d+)?$|^\\dfrac/.test(p.ans) && !p.ans.includes('1{,}1{,}6')
  );
  const p = rand(goodPools);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// ─── Маппинг ─────────────────────────────────────────────────────────────────
const GENERATORS_FR = {
  sumFracTimesInt:       genSumFracTimesInt,
  fracSumTimesDecimal:   genFracSumTimesDecimal,
  decimalDivFrac:        genDecimalDivFrac,
  bracketDivFrac:        genBracketDivFrac,
  multiFracTimesInt:     genMultiFracTimesInt,
  fracProdPlusInt:       genFracProdPlusInt,
  fracDivPlusMixed:      genFracDivPlusMixed,
  oneOverDiff:           genOneOverDiff,
  fracDecMix:            genFracDecMix,
  fracProdMinusFrac:     genFracProdMinusFrac,
  fracPlusFracDivFrac:   genFracPlusFracDivFrac,
};

export const CATEGORY_LABELS_FR = {
  sumFracTimesInt:       '(a/b ± c/d) · N',
  fracSumTimesDecimal:   '(a/b ± c/d) · D',
  decimalDivFrac:        'D : a/b',
  bracketDivFrac:        '(скобка) : c/d',
  multiFracTimesInt:     'N · (a/b ± c/d ± e/f)',
  fracProdPlusInt:       'a/b · D + n',
  fracDivPlusMixed:      'a/b : (−c/d) + смешанное',
  oneOverDiff:           '1 / (1/a − 1/b)',
  fracDecMix:            'Смесь дробей и десятичных',
  fracProdMinusFrac:     'a/b · c/d − e/f',
  fracPlusFracDivFrac:   'a/b + c/d : e/f',
};

export const DEFAULT_SETTINGS_FR = {
  variantsCount:  4,
  questionsCount: 20,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  columnsCount:   2,
  fontSize:       's',
  decimalOnly:    false,
  categories: {
    sumFracTimesInt:       true,
    fracSumTimesDecimal:   true,
    decimalDivFrac:        true,
    bracketDivFrac:        true,
    multiFracTimesInt:     true,
    fracProdPlusInt:       true,
    fracDivPlusMixed:      true,
    oneOverDiff:           true,
    fracDecMix:            true,
    fracProdMinusFrac:     true,
    fracPlusFracDivFrac:   true,
  },
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateFractionsVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_FR, ...settings };
  const { variantsCount, questionsCount, categories, decimalOnly } = s;
  const enabledCats = Object.entries(categories || {})
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (enabledCats.length === 0) return [];
  const maxAttempts = decimalOnly ? questionsCount * 30 : questionsCount * 5;
  return Array.from({ length: variantsCount }, () => {
    const questions = [];
    let catIdx = 0;
    while (questions.length < questionsCount && catIdx < maxAttempts) {
      const cat = enabledCats[catIdx % enabledCats.length];
      catIdx++;
      const gen = GENERATORS_FR[cat];
      if (!gen) continue;
      const q = gen();
      if (q && (!decimalOnly || isFiniteDecimalAnswer(q.resultLatex))) {
        questions.push({ ...q, cat });
      }
    }
    return questions;
  });
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useOralFractions() {
  const [title, setTitle]         = useState('Устный счёт: действия с обыкновенными дробями');
  const [settings, setSettings]   = useState({ ...DEFAULT_SETTINGS_FR });
  const [tasksData, setTasksData] = useState(null);

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({
      ...p,
      categories: { ...p.categories, [cat]: checked },
    })), []);

  const generate = useCallback((override) => {
    const s = override
      ? { ...DEFAULT_SETTINGS_FR, ...settings, ...override }
      : settings;
    const { variantsCount, questionsCount, categories, decimalOnly } = s;

    const enabledCats = Object.entries(categories)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (enabledCats.length === 0) return;

    const maxAttempts = decimalOnly ? questionsCount * 30 : questionsCount * 5;

    const variants = Array.from({ length: variantsCount }, () => {
      const questions = [];
      let catIdx = 0;
      while (questions.length < questionsCount && catIdx < maxAttempts) {
        const cat = enabledCats[catIdx % enabledCats.length];
        catIdx++;
        const gen = GENERATORS_FR[cat];
        if (!gen) continue;
        const q = gen();
        if (q && (!decimalOnly || isFiniteDecimalAnswer(q.resultLatex))) {
          questions.push({ ...q, cat });
        }
      }
      return questions;
    });

    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Устный счёт: действия с обыкновенными дробями');
    setSettings({ ...DEFAULT_SETTINGS_FR });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
  };
}
