import {
  rat, R1, addR, subR, mulR, divR, isZero, toNum,
  rand, randInt, chance,
  num, vr, mul, dvd,
  ROOTS_SMALL,
} from './linearExpr';

/**
 * Формы линейных выражений для блоков «скобки», «дроби» и «особые случаи».
 *
 * Каждая форма строит пару сторон (left, right) так, чтобы решением было
 * выбранное ею значение `x`. Знак между сторонами ставит вызывающий: «=» для
 * уравнений, «<» / «⩽» / … для неравенств. Благодаря этому одинаковые по виду
 * задания в обоих генераторах действительно одинаковые, а не «почти».
 *
 * Форма возвращает `{ left, right }` либо null, если случайные числа дали
 * вырожденное или некрасивое задание — вызывающий пробует ещё раз.
 */

// Случайный «удобный» корень: небольшое целое, иногда отрицательное
function randRoot(negChance = 0.25) {
  return rat(rand(ROOTS_SMALL) * (chance(negChance) ? -1 : 1));
}

// 2(x - 3) ? 10 · a(bx + c) - d ? e · a(x + c) ? dx + e
export function formBrackets({ withVarRight = true } = {}) {
  const k = rat(rand([2, 3, 4, 5, 6, 7]) * (chance(0.3) ? -1 : 1));
  const inner = rat(rand([1, 1, 1, 2, 3]));
  const shift = rat(randInt(1, 12) * (chance(0.5) ? -1 : 1));
  const x = randRoot();
  const bracket = mul(k, [vr(inner), num(shift)]);
  const value = mulR(k, addR(mulR(inner, x), shift));

  const kinds = withVarRight ? ['plain', 'plusTerm', 'varRight'] : ['plain', 'plusTerm'];
  const kind = rand(kinds);

  if (kind === 'plain') {
    return { left: [bracket], right: [num(value)] };
  }
  if (kind === 'plusTerm') {
    const d = rat(randInt(1, 15) * (chance(0.5) ? -1 : 1));
    return { left: [bracket, num(d)], right: [num(addR(value, d))] };
  }

  // a(bx + c) ? dx + e
  const dCoef = rat(rand([1, 2, 3, 4, 5]) * (chance(0.3) ? -1 : 1));
  if (isZero(subR(mulR(k, inner), dCoef))) return null;
  const e = subR(value, mulR(dCoef, x));
  if (Math.abs(toNum(e)) > 200) return null;
  return { left: [bracket], right: [vr(dCoef), num(e)] };
}

// 3(x - 1) ? 2(x + 4) — скобки с обеих сторон
export function formBracketsBoth() {
  const k1 = rat(rand([2, 3, 4, 5, 6]) * (chance(0.25) ? -1 : 1));
  const k2 = rat(rand([2, 3, 4, 5]) * (chance(0.3) ? -1 : 1));
  const i1 = rat(rand([1, 1, 2]));
  const i2 = rat(rand([1, 1, 2]));
  if (isZero(subR(mulR(k1, i1), mulR(k2, i2)))) return null;

  const s1 = rat(randInt(1, 10) * (chance(0.5) ? -1 : 1));
  const x  = randRoot();
  // s2 подбираем так, чтобы решением было ровно x
  const s2 = divR(subR(mulR(k1, addR(mulR(i1, x), s1)), mulR(k2, mulR(i2, x))), k2);
  if (!s2 || s2.d !== 1 || Math.abs(s2.n) > 30 || isZero(s2)) return null;

  return {
    left:  [mul(k1, [vr(i1), num(s1)])],
    right: [mul(k2, [vr(i2), num(s2)])],
  };
}

// 2(x - 1) - 3(x + 2) ? 4 — раскрытие двух скобок
export function formExpandTwo() {
  const k1 = rat(rand([2, 3, 4, 5]));
  const k2 = rat(rand([2, 3, 4, 5]) * (chance(0.7) ? -1 : 1));
  const i1 = rat(rand([1, 1, 2]));
  const i2 = rat(rand([1, 1, 2]));
  if (isZero(addR(mulR(k1, i1), mulR(k2, i2)))) return null;

  const s1 = rat(randInt(1, 8) * (chance(0.5) ? -1 : 1));
  const s2 = rat(randInt(1, 8) * (chance(0.5) ? -1 : 1));
  const x  = randRoot(0.3);
  const value = addR(
    mulR(k1, addR(mulR(i1, x), s1)),
    mulR(k2, addR(mulR(i2, x), s2)),
  );
  if (Math.abs(toNum(value)) > 200) return null;

  return {
    left:  [mul(k1, [vr(i1), num(s1)]), mul(k2, [vr(i2), num(s2)])],
    right: [num(value)],
  };
}

// (x + 1)/3 ? 2 — переменная в числителе дроби
export function formFracDenom() {
  const d = rat(rand([2, 3, 4, 5, 6, 8]));
  const inner = rat(rand([1, 1, 1, 2, 3]) * (chance(0.2) ? -1 : 1));
  const shift = rat(randInt(1, 12) * (chance(0.55) ? -1 : 1));
  const x = randRoot();
  const value = divR(addR(mulR(inner, x), shift), d);
  if (!value || value.d > 6) return null;

  return { left: [dvd([vr(inner), num(shift)], d)], right: [num(value)] };
}

// x/2 - x/3 ? 1 — дроби с разными знаменателями
export function formFracTwoDen() {
  const d1 = rat(rand([2, 3, 4, 5, 6]));
  const pool = [2, 3, 4, 6, 8].filter(v => v !== d1.n);
  const d2 = rat(rand(pool));
  const sign2 = chance(0.6) ? -1 : 1;
  const total = addR(divR(R1, d1), mulR(rat(sign2), divR(R1, d2)));
  if (isZero(total)) return null;

  const x = randRoot();
  const value = mulR(total, x);
  if (value.d > 6 || Math.abs(toNum(value)) > 60) return null;

  return {
    left:  [dvd([vr(R1)], d1), dvd([vr(rat(sign2))], d2)],
    right: [num(value)],
  };
}

// (2x - 1)/4 ? (x + 3)/2 — дроби с обеих сторон
export function formFracBothSides() {
  const d1 = rat(rand([2, 3, 4, 6]));
  const d2 = rat(rand([2, 3, 4, 6]));
  const i1 = rat(rand([1, 2, 3]));
  const i2 = rat(rand([1, 2]));
  if (isZero(subR(divR(i1, d1), divR(i2, d2)))) return null;
  // Дробь, сокращающаяся в многочлен ((3x + 6)/3), теряет смысл задания
  if (i1.n % d1.n === 0) return null;

  const s1 = rat(randInt(1, 10) * (chance(0.5) ? -1 : 1));
  const x  = randRoot();
  // s2 подбираем целым, чтобы правая дробь выглядела по-школьному
  const s2 = mulR(d2, subR(divR(addR(mulR(i1, x), s1), d1), divR(mulR(i2, x), d2)));
  if (!s2 || s2.d !== 1 || Math.abs(s2.n) > 30) return null;
  if (i2.n % d2.n === 0 && s2.n % d2.n === 0) return null;

  return {
    left:  [dvd([vr(i1), num(s1)], d1)],
    right: [dvd([vr(i2), num(s2)], d2)],
  };
}

/**
 * Вырожденная форма: коэффициенты при переменной по обе стороны равны, поэтому
 * задание сводится к сравнению чисел — «нет решений» или «любое число».
 * `equalConst` = true даёт тождество (левая и правая константы совпадают).
 * Возвращает ещё и сами константы: неравенствам они нужны, чтобы подобрать знак.
 */
export function formDegenerate({ equalConst = false } = {}) {
  const k = rat(rand([2, 3, 4, 5, 6]) * (chance(0.3) ? -1 : 1));
  const inner = rat(rand([1, 1, 2, 3]));
  const shift = rat(randInt(1, 9) * (chance(0.5) ? -1 : 1));
  const lConst = mulR(k, shift);
  const tail = equalConst
    ? lConst
    : rat(randInt(1, 12) * (chance(0.5) ? -1 : 1));
  if (!equalConst && isZero(subR(lConst, tail))) return null;

  return {
    left:  [mul(k, [vr(inner), num(shift)])],
    right: [vr(mulR(k, inner)), num(tail)],
    lConst,
    rConst: tail,
  };
}
