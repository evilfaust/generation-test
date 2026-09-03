import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';

// ─── Type 1: f(kx) = a ───────────────────────────────────────────────────────
// Уравнения с линейным аргументом (без сдвига)

const TYPE1_ENTRIES = [

  // ── sin(kx) = a, k = 2 ──
  { exprLatex: '\\sin 2x = \\dfrac{\\sqrt{2}}{2}',
    resultLatex: 'x = (-1)^n\\dfrac{\\pi}{8} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin 2x = -\\dfrac{\\sqrt{2}}{2}',
    resultLatex: 'x = (-1)^n\\!\\left(-\\dfrac{\\pi}{8}\\right) + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin 2x = \\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = (-1)^n\\dfrac{\\pi}{6} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin 2x = -\\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = (-1)^n\\!\\left(-\\dfrac{\\pi}{6}\\right) + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin 2x = \\dfrac{1}{2}',
    resultLatex: 'x = (-1)^n\\dfrac{\\pi}{12} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin 2x = -\\dfrac{1}{2}',
    resultLatex: 'x = (-1)^n\\!\\left(-\\dfrac{\\pi}{12}\\right) + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin 2x = 1',
    resultLatex: 'x = \\dfrac{\\pi}{4} + \\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin 2x = -1',
    resultLatex: 'x = -\\dfrac{\\pi}{4} + \\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin 2x = 0',
    resultLatex: 'x = \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },

  // ── sin(kx) = a, k = 3 ──
  { exprLatex: '\\sin 3x = \\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = (-1)^n\\dfrac{\\pi}{9} + \\dfrac{\\pi n}{3},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin 3x = \\dfrac{1}{2}',
    resultLatex: 'x = (-1)^n\\dfrac{\\pi}{18} + \\dfrac{\\pi n}{3},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin 3x = 1',
    resultLatex: 'x = \\dfrac{\\pi}{6} + \\dfrac{2\\pi n}{3},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin 3x = -1',
    resultLatex: 'x = -\\dfrac{\\pi}{6} + \\dfrac{2\\pi n}{3},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin 3x = 0',
    resultLatex: 'x = \\dfrac{\\pi n}{3},\\; n \\in \\mathbb{Z}' },

  // ── sin(kx) = a, k = 4 ──
  { exprLatex: '\\sin 4x = \\dfrac{\\sqrt{2}}{2}',
    resultLatex: 'x = (-1)^n\\dfrac{\\pi}{16} + \\dfrac{\\pi n}{4},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin 4x = 1',
    resultLatex: 'x = \\dfrac{\\pi}{8} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin 4x = 0',
    resultLatex: 'x = \\dfrac{\\pi n}{4},\\; n \\in \\mathbb{Z}' },

  // ── sin(x/2) = a ──
  { exprLatex: '\\sin\\dfrac{x}{2} = \\dfrac{1}{2}',
    resultLatex: 'x = (-1)^n\\dfrac{\\pi}{3} + 2\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin\\dfrac{x}{2} = \\dfrac{\\sqrt{2}}{2}',
    resultLatex: 'x = (-1)^n\\dfrac{\\pi}{2} + 2\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin\\dfrac{x}{2} = \\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = (-1)^n\\dfrac{2\\pi}{3} + 2\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin\\dfrac{x}{2} = -\\dfrac{1}{2}',
    resultLatex: 'x = (-1)^n\\!\\left(-\\dfrac{\\pi}{3}\\right) + 2\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin\\dfrac{x}{2} = -\\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = (-1)^n\\!\\left(-\\dfrac{2\\pi}{3}\\right) + 2\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin\\dfrac{x}{2} = 1',
    resultLatex: 'x = \\pi + 4\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin\\dfrac{x}{2} = 0',
    resultLatex: 'x = 2\\pi n,\\; n \\in \\mathbb{Z}' },

  // ── sin(x/3) = a ──
  { exprLatex: '\\sin\\dfrac{x}{3} = \\dfrac{\\sqrt{2}}{2}',
    resultLatex: 'x = (-1)^n\\dfrac{3\\pi}{4} + 3\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin\\dfrac{x}{3} = -\\dfrac{\\sqrt{2}}{2}',
    resultLatex: 'x = (-1)^n\\!\\left(-\\dfrac{3\\pi}{4}\\right) + 3\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin\\dfrac{x}{3} = \\dfrac{1}{2}',
    resultLatex: 'x = (-1)^n\\dfrac{\\pi}{2} + 3\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin\\dfrac{x}{3} = \\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = (-1)^n\\pi + 3\\pi n,\\; n \\in \\mathbb{Z}' },

  // ── sin(x/4) = a ──
  { exprLatex: '\\sin\\dfrac{x}{4} = \\dfrac{1}{2}',
    resultLatex: 'x = (-1)^n\\dfrac{2\\pi}{3} + 4\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin\\dfrac{x}{4} = \\dfrac{\\sqrt{2}}{2}',
    resultLatex: 'x = (-1)^n\\pi + 4\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin\\dfrac{x}{4} = \\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = (-1)^n\\dfrac{4\\pi}{3} + 4\\pi n,\\; n \\in \\mathbb{Z}' },

  // ── sin с отрицательным аргументом ──
  { exprLatex: '\\sin\\!\\left(-\\dfrac{x}{3}\\right) = \\dfrac{\\sqrt{2}}{2}',
    resultLatex: 'x = (-1)^{n+1}\\dfrac{3\\pi}{4} + 3\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin(-2x) = \\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = (-1)^{n+1}\\dfrac{\\pi}{6} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin(-2x) = \\dfrac{1}{2}',
    resultLatex: 'x = (-1)^{n+1}\\dfrac{\\pi}{12} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin(-2x) = \\dfrac{\\sqrt{2}}{2}',
    resultLatex: 'x = (-1)^{n+1}\\dfrac{\\pi}{8} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },

  // ── cos(kx) = a, k = 2 ──
  { exprLatex: '\\cos 2x = \\dfrac{\\sqrt{2}}{2}',
    resultLatex: 'x = \\pm\\dfrac{\\pi}{8} + \\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos 2x = -\\dfrac{\\sqrt{2}}{2}',
    resultLatex: 'x = \\pm\\dfrac{3\\pi}{8} + \\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos 2x = \\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = \\pm\\dfrac{\\pi}{12} + \\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos 2x = -\\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = \\pm\\dfrac{5\\pi}{12} + \\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos 2x = \\dfrac{1}{2}',
    resultLatex: 'x = \\pm\\dfrac{\\pi}{6} + \\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos 2x = -\\dfrac{1}{2}',
    resultLatex: 'x = \\pm\\dfrac{\\pi}{3} + \\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos 2x = 0',
    resultLatex: 'x = \\dfrac{\\pi}{4} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos 2x = 1',
    resultLatex: 'x = \\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos 2x = -1',
    resultLatex: 'x = \\dfrac{\\pi}{2} + \\pi n,\\; n \\in \\mathbb{Z}' },

  // ── cos(kx) = a, k = 3 ──
  { exprLatex: '\\cos 3x = \\dfrac{1}{2}',
    resultLatex: 'x = \\pm\\dfrac{\\pi}{9} + \\dfrac{2\\pi n}{3},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos 3x = -\\dfrac{1}{2}',
    resultLatex: 'x = \\pm\\dfrac{2\\pi}{9} + \\dfrac{2\\pi n}{3},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos 3x = 0',
    resultLatex: 'x = \\dfrac{\\pi}{6} + \\dfrac{\\pi n}{3},\\; n \\in \\mathbb{Z}' },

  // ── cos(kx) = a, k = 4 ──
  { exprLatex: '\\cos 4x = 0',
    resultLatex: 'x = \\dfrac{\\pi}{8} + \\dfrac{\\pi n}{4},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos 4x = \\dfrac{\\sqrt{2}}{2}',
    resultLatex: 'x = \\pm\\dfrac{\\pi}{16} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos 4x = -1',
    resultLatex: 'x = \\dfrac{\\pi}{4} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },

  // ── cos(x/3) = a ──
  { exprLatex: '\\cos\\dfrac{x}{3} = -\\dfrac{1}{2}',
    resultLatex: 'x = \\pm 2\\pi + 6\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos\\dfrac{x}{3} = \\dfrac{1}{2}',
    resultLatex: 'x = \\pm\\pi + 6\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos\\dfrac{x}{3} = \\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = \\pm\\dfrac{\\pi}{2} + 6\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos\\dfrac{x}{3} = -\\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = \\pm\\dfrac{5\\pi}{2} + 6\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos\\dfrac{x}{3} = 0',
    resultLatex: 'x = \\dfrac{3\\pi}{2} + 3\\pi n,\\; n \\in \\mathbb{Z}' },

  // ── cos(x/2) = a ──
  { exprLatex: '\\cos\\dfrac{x}{2} = \\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = \\pm\\dfrac{\\pi}{3} + 4\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos\\dfrac{x}{2} = \\dfrac{1}{2}',
    resultLatex: 'x = \\pm\\dfrac{2\\pi}{3} + 4\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos\\dfrac{x}{2} = -\\dfrac{1}{2}',
    resultLatex: 'x = \\pm\\dfrac{4\\pi}{3} + 4\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos\\dfrac{x}{2} = -\\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = \\pm\\dfrac{5\\pi}{3} + 4\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos\\dfrac{x}{2} = 0',
    resultLatex: 'x = \\pi + 4\\pi n,\\; n \\in \\mathbb{Z}' },

  // ── cos с отрицательным аргументом (cos(-u)=cos(u), ответ тот же) ──
  { exprLatex: '\\cos(-2x) = -\\dfrac{\\sqrt{3}}{2}',
    resultLatex: 'x = \\pm\\dfrac{5\\pi}{12} + \\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos(-2x) = \\dfrac{1}{2}',
    resultLatex: 'x = \\pm\\dfrac{\\pi}{6} + \\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\cos\\!\\left(-\\dfrac{x}{2}\\right) = \\dfrac{\\sqrt{2}}{2}',
    resultLatex: 'x = \\pm\\dfrac{\\pi}{2} + 4\\pi n,\\; n \\in \\mathbb{Z}' },

  // ── tg(kx) = a, k = 2 ──
  { exprLatex: '\\operatorname{tg} 2x = \\sqrt{3}',
    resultLatex: 'x = \\dfrac{\\pi}{6} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{tg} 2x = -\\sqrt{3}',
    resultLatex: 'x = -\\dfrac{\\pi}{6} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{tg} 2x = 1',
    resultLatex: 'x = \\dfrac{\\pi}{8} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{tg} 2x = -1',
    resultLatex: 'x = -\\dfrac{\\pi}{8} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{tg} 2x = \\dfrac{\\sqrt{3}}{3}',
    resultLatex: 'x = \\dfrac{\\pi}{12} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{tg} 2x = 0',
    resultLatex: 'x = \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },

  // ── tg(x/3) = a ──
  { exprLatex: '\\operatorname{tg}\\dfrac{x}{3} = \\dfrac{\\sqrt{3}}{3}',
    resultLatex: 'x = \\dfrac{\\pi}{2} + 3\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{tg}\\dfrac{x}{3} = 1',
    resultLatex: 'x = \\dfrac{3\\pi}{4} + 3\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{tg}\\dfrac{x}{3} = \\sqrt{3}',
    resultLatex: 'x = \\pi + 3\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{tg}\\dfrac{x}{3} = -\\sqrt{3}',
    resultLatex: 'x = -\\pi + 3\\pi n,\\; n \\in \\mathbb{Z}' },

  // ── tg(-kx) = a ──
  { exprLatex: '\\operatorname{tg}(-4x) = \\dfrac{\\sqrt{3}}{3}',
    resultLatex: 'x = -\\dfrac{\\pi}{24} + \\dfrac{\\pi n}{4},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{tg}(-4x) = 1',
    resultLatex: 'x = -\\dfrac{\\pi}{16} + \\dfrac{\\pi n}{4},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{tg}(-4x) = \\sqrt{3}',
    resultLatex: 'x = -\\dfrac{\\pi}{12} + \\dfrac{\\pi n}{4},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{tg}(-4x) = -1',
    resultLatex: 'x = \\dfrac{\\pi}{16} + \\dfrac{\\pi n}{4},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{tg}\\!\\left(-\\dfrac{x}{2}\\right) = 1',
    resultLatex: 'x = -\\dfrac{\\pi}{2} + 2\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{tg}\\!\\left(-\\dfrac{x}{2}\\right) = \\sqrt{3}',
    resultLatex: 'x = -\\dfrac{2\\pi}{3} + 2\\pi n,\\; n \\in \\mathbb{Z}' },

  // ── ctg(kx) = a ──
  { exprLatex: '\\operatorname{ctg} 2x = 1',
    resultLatex: 'x = \\dfrac{\\pi}{8} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{ctg} 2x = -1',
    resultLatex: 'x = -\\dfrac{\\pi}{8} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{ctg} 2x = \\sqrt{3}',
    resultLatex: 'x = \\dfrac{\\pi}{12} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{ctg} 2x = \\dfrac{\\sqrt{3}}{3}',
    resultLatex: 'x = \\dfrac{\\pi}{6} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{ctg}\\dfrac{x}{2} = 1',
    resultLatex: 'x = \\dfrac{\\pi}{2} + 2\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{ctg}\\dfrac{x}{2} = -1',
    resultLatex: 'x = -\\dfrac{\\pi}{2} + 2\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{ctg}\\!\\left(-\\dfrac{x}{2}\\right) = 1',
    resultLatex: 'x = -\\dfrac{\\pi}{2} + 2\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{ctg}\\!\\left(-\\dfrac{x}{2}\\right) = -1',
    resultLatex: 'x = \\dfrac{\\pi}{2} + 2\\pi n,\\; n \\in \\mathbb{Z}' },
];

// ─── Type 2: A·f(kx + b) = c ─────────────────────────────────────────────────
// Уравнения с коэффициентом снаружи и сдвигом внутри аргумента

const TYPE2_ENTRIES = [

  // ── Мордкович §18.3 ──
  { exprLatex: '2\\cos\\!\\left(\\dfrac{x}{2} - \\dfrac{\\pi}{6}\\right) = \\sqrt{3}',
    resultLatex: 'x = \\dfrac{2\\pi}{3} + 4\\pi n \\text{ или } x = 4\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sqrt{3}\\,\\operatorname{tg}\\!\\left(\\dfrac{x}{3} + \\dfrac{\\pi}{6}\\right) = 3',
    resultLatex: 'x = \\pi + 3\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '2\\sin\\!\\left(3x - \\dfrac{\\pi}{4}\\right) = -\\sqrt{2}',
    resultLatex: 'x = -\\dfrac{\\pi}{12} + \\dfrac{\\pi n}{3} \\text{ или } x = \\dfrac{5\\pi}{12} + \\dfrac{\\pi n}{3},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sin\\!\\left(\\dfrac{x}{2} - \\dfrac{\\pi}{6}\\right) + 1 = 0',
    resultLatex: 'x = -\\dfrac{2\\pi}{3} + 4\\pi n,\\; n \\in \\mathbb{Z}' },

  // ── Мордкович §18.4 ──
  { exprLatex: '\\cos\\!\\left(\\dfrac{\\pi}{6} - 2x\\right) = -1',
    resultLatex: 'x = \\dfrac{\\pi}{12} + \\dfrac{\\pi n}{2} + \\dfrac{\\pi}{2} \\longrightarrow x = \\dfrac{7\\pi}{12} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\operatorname{tg}\\!\\left(\\dfrac{\\pi}{4} - \\dfrac{x}{2}\\right) = -1',
    resultLatex: 'x = \\dfrac{3\\pi}{2} + 2\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '2\\sin\\!\\left(\\dfrac{\\pi}{3} - \\dfrac{x}{4}\\right) = \\sqrt{3}',
    resultLatex: 'x = \\dfrac{4\\pi}{3} + 4\\pi n \\text{ или } x = -\\dfrac{4\\pi}{3} + 4\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '2\\cos\\!\\left(\\dfrac{\\pi}{4} - 3x\\right) = \\sqrt{2}',
    resultLatex: 'x = 0 + \\dfrac{\\pi n}{3} \\text{ или } x = \\dfrac{\\pi}{6} + \\dfrac{\\pi n}{3},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '2\\sin\\!\\left(\\dfrac{\\pi}{3} - x\\right) = \\sqrt{3} + 1',
    resultLatex: 'x = -\\dfrac{\\pi}{12} + 2\\pi n \\text{ или } x = \\dfrac{5\\pi}{12} + 2\\pi n,\\; n \\in \\mathbb{Z}' },

  // ── Доп. задания с 2·f(kx+b) = c ──
  { exprLatex: '2\\sin\\!\\left(2x + \\dfrac{\\pi}{6}\\right) = \\sqrt{2}',
    resultLatex: 'x = \\dfrac{\\pi}{24} + \\pi n \\text{ или } x = \\dfrac{5\\pi}{24} + \\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '2\\cos\\!\\left(3x - \\dfrac{\\pi}{3}\\right) = 1',
    resultLatex: 'x = \\dfrac{\\pi}{9} + \\dfrac{2\\pi n}{3} \\text{ или } x = \\dfrac{2\\pi}{9} + \\dfrac{2\\pi n}{3},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '2\\sin\\!\\left(x + \\dfrac{\\pi}{4}\\right) = \\sqrt{3}',
    resultLatex: 'x = \\dfrac{\\pi}{12} + 2\\pi n \\text{ или } x = \\dfrac{5\\pi}{12} + 2\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '2\\cos\\!\\left(x - \\dfrac{\\pi}{3}\\right) = \\sqrt{3}',
    resultLatex: 'x = \\dfrac{\\pi}{2} + 2\\pi n \\text{ или } x = \\dfrac{\\pi}{6} + 2\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sqrt{3}\\,\\operatorname{tg}\\!\\left(x - \\dfrac{\\pi}{6}\\right) = 1',
    resultLatex: 'x = \\dfrac{\\pi}{3} + \\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sqrt{3}\\,\\operatorname{tg}\\!\\left(2x + \\dfrac{\\pi}{4}\\right) = -3',
    resultLatex: 'x = \\dfrac{\\pi}{24} + \\dfrac{\\pi n}{2},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '2\\sin\\!\\left(\\dfrac{x}{2} + \\dfrac{\\pi}{4}\\right) = 1',
    resultLatex: 'x = -\\dfrac{\\pi}{6} + 4\\pi n \\text{ или } x = \\dfrac{5\\pi}{6} + 4\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '2\\cos\\!\\left(\\dfrac{x}{2} + \\dfrac{\\pi}{3}\\right) = \\sqrt{2}',
    resultLatex: 'x = \\dfrac{\\pi}{6} + 4\\pi n \\text{ или } x = -\\dfrac{7\\pi}{6} + 4\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '2\\sin\\!\\left(3x + \\dfrac{\\pi}{6}\\right) = -1',
    resultLatex: 'x = -\\dfrac{\\pi}{9} + \\dfrac{2\\pi n}{3} \\text{ или } x = \\dfrac{2\\pi}{9} + \\dfrac{2\\pi n}{3},\\; n \\in \\mathbb{Z}' },
  { exprLatex: '\\sqrt{2}\\,\\cos\\!\\left(x - \\dfrac{\\pi}{4}\\right) = 1',
    resultLatex: 'x = \\dfrac{\\pi}{2} + 2\\pi n \\text{ или } x = 2\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '2\\cos\\!\\left(\\dfrac{x}{3} - \\dfrac{\\pi}{6}\\right) = -\\sqrt{3}',
    resultLatex: 'x = \\dfrac{5\\pi}{2} + 6\\pi n \\text{ или } x = -\\dfrac{3\\pi}{2} + 6\\pi n,\\; n \\in \\mathbb{Z}' },
  { exprLatex: '2\\sin\\!\\left(\\dfrac{x}{4} - \\dfrac{\\pi}{3}\\right) = \\sqrt{2}',
    resultLatex: 'x = \\dfrac{11\\pi}{3} + 8\\pi n \\text{ или } x = \\dfrac{5\\pi}{3} + 8\\pi n,\\; n \\in \\mathbb{Z}' },
];

// ─── Рандом ───────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Настройки по умолчанию ───────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  variantsCount:  4,
  questionsCount: 6,
  useType1:       true,
  useType2:       false,
  showTeacherKey: true,
  twoPerPage:     false,
  showWorkSpace:  false,
  workSpaceSize:  35,
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateTrigEquationsAdvancedVariants(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const { variantsCount, questionsCount, useType1, useType2 } = s;
  const pool = [
    ...(useType1 ? TYPE1_ENTRIES : []),
    ...(useType2 ? TYPE2_ENTRIES : []),
  ];
  if (pool.length === 0) return [];
  return Array.from({ length: variantsCount }, () => {
    const shuffled = shuffle(pool);
    return shuffled.slice(0, Math.min(questionsCount, shuffled.length));
  });
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useTrigEquationsAdvanced() {
  const [title, setTitle] = useState('Тригонометрические уравнения f(kx + b) = a');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const { variantsCount, questionsCount, useType1, useType2 } = s;

    const pool = [
      ...(useType1 ? TYPE1_ENTRIES : []),
      ...(useType2 ? TYPE2_ENTRIES : []),
    ];
    if (pool.length === 0) return;

    const variants = Array.from({ length: variantsCount }, () => {
      const shuffled = shuffle(pool);
      return shuffled.slice(0, Math.min(questionsCount, shuffled.length));
    });

    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Тригонометрические уравнения f(kx + b) = a');
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return {
    title, setTitle, settings, updateSetting, tasksData, generate, reset,
    setTasksData, applySheet,
  };
}
