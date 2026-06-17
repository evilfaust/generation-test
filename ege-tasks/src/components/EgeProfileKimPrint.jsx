import React, { useState, useRef, useMemo, useLayoutEffect } from 'react';
import { Typography } from 'antd';
import MathRenderer from './MathRenderer';
import { api } from '../services/pocketbase';
import { kimImageBoxStyle, kimImageImgStyle } from '../utils/kimImageSize';

const { Text } = Typography;

// Печатные KIM-компоненты профильного варианта ЕГЭ, вынесены из
// EgeProfileVariantGenerator.jsx (god-компонент). Чисто презентационные:
// обложка, задача, страница, печатный буклет (двухфазный рендер) и лист ответов.

// Граница между частями: задания 1–12 — часть 1, 13–19 — часть 2
const PART1_LAST = 12;

// Размеры в px (при 96dpi: 1mm ≈ 3.78px)
const MM_TO_PX = 3.78;
const KIM_GAP_PX = 2.5 * MM_TO_PX; // 2.5mm gap

// Высоты доступной зоны под задачи на A5-странице (см. EgeVariantGenerator)
const PAGE_HEIGHT_PX = 188 * MM_TO_PX;        // обычная страница заданий
const PART1_FIRST_PX = 172 * MM_TO_PX;        // первая стр. части 1 (note-box)
const PART2_FIRST_PX = 150 * MM_TO_PX;        // первая стр. части 2 (блок «Часть 2»)

/**
 * Жадная пагинация уже пронумерованных задач (kimNumber выставлен заранее).
 * @param {Array} tasks      — задачи с полем kimNumber
 * @param {Map}   heights    — id → offsetHeight(px)
 * @param {number} firstCap  — ёмкость первой страницы (px)
 * @param {number} restCap   — ёмкость последующих страниц (px)
 */
const paginateTasks = (tasks, heights, firstCap, restCap) => {
  if (tasks.length === 0) return [];
  const pages = [];
  let current = [];
  let usedPx = 0;

  for (const task of tasks) {
    const h = heights.get(task.id) || 60;
    const capacity = pages.length === 0 ? firstCap : restCap;

    if (current.length > 0 && usedPx + KIM_GAP_PX + h > capacity) {
      pages.push(current);
      current = [];
      usedPx = 0;
    }

    if (current.length > 0) usedPx += KIM_GAP_PX;
    current.push(task);
    usedPx += h;
  }
  if (current.length > 0) pages.push(current);

  return pages;
};

const KimProfileCoverPage = ({ variant, kimMeta }) => (
  <div className="kim-page kim-page-cover">
    <div className="kim-cover-body">
      <div className="kim-cover-title">Тренировочная работа по МАТЕМАТИКЕ</div>
      <div className="kim-cover-class">{kimMeta.classNum} класс</div>
      <div className="kim-cover-date">{kimMeta.displayDate}</div>
      <div className="kim-cover-variant">Вариант {kimMeta.variantNumberOverride || variant.number}</div>
      <div className="kim-cover-level">(профильный уровень)</div>

      <div className="kim-cover-student-row">
        <span>Выполнена: ФИО</span>
        <span className="kim-cover-line kim-cover-line-name" />
        <span>класс</span>
        <span className="kim-cover-line kim-cover-line-class" />
      </div>

      <div className="kim-cover-instruction-title">Инструкция по выполнению работы</div>

      <div className="kim-cover-text">
        <p>Экзаменационная работа состоит из двух частей, включающих в себя 19 заданий. Часть 1 содержит 12 заданий с кратким ответом базового и повышенного уровней сложности. Часть 2 содержит 7 заданий с развёрнутым ответом повышенного и высокого уровней сложности.</p>
        <p>На выполнение работы по математике отводится 3 часа 55 минут (235 минут).</p>
        <p>Ответы к заданиям 1–12 записываются в виде целого числа или конечной десятичной дроби. Запишите ответы в поля ответов в тексте работы.</p>
        <p>При выполнении заданий 13–19 требуется записать полное обоснованное решение и ответ.</p>
        <p>При выполнении заданий можно пользоваться черновиком. Записи в черновике не учитываются при оценивании работы. Баллы, полученные Вами за выполненные задания, суммируются. Постарайтесь выполнить как можно больше заданий и набрать наибольшее количество баллов.</p>
      </div>

      <div className="kim-cover-wish">Желаем успеха!</div>
    </div>
    <div className="kim-page-footer">{kimMeta.brand}</div>
  </div>
);

const KimProfileTask = ({ task, withAnswer }) => {
  const taskImageUrl = api.getTaskImageUrl(task);
  return (
    <div className={`kim-book-task${withAnswer ? '' : ' kim-book-task--part2'}`}>
      <div className="kim-book-task-number">{task.kimNumber}</div>
      <div className="kim-book-task-main">
        <div className="kim-book-task-content">
          <MathRenderer text={task.statement_md} />
          {task.has_image && taskImageUrl && (
            <div className="kim-book-task-image" style={kimImageBoxStyle(task.kimImageSize)}>
              <img src={taskImageUrl} alt="" style={kimImageImgStyle(task.kimImageSize)} />
            </div>
          )}
        </div>
        {withAnswer && (
          <div className="kim-book-answer">
            <span>Ответ:</span>
            <span className="kim-book-answer-line" />
            <span className="kim-book-answer-dot">.</span>
          </div>
        )}
      </div>
    </div>
  );
};

const KimProfileTaskPage = ({ variant, pageNumber, tasks, kimMeta, part, isPartStart }) => (
  <div className="kim-page kim-page-task">
    <div className="kim-page-header">
      <span>Математика. Профильный уровень. {kimMeta.classNum} класс. Вариант {kimMeta.variantNumberOverride || variant.number}</span>
      <span>{pageNumber}</span>
    </div>

    {part === 1 && isPartStart && (
      <div className="kim-page-note">
        <em>Ответом к каждому из заданий 1–12 является целое число
        или конечная десятичная дробь. Запишите ответы к заданиям
        в поле ответа в тексте работы.</em>
      </div>
    )}

    {part === 2 && isPartStart && (
      <div className="kim-part2-intro">
        <div className="kim-part2-title">Часть 2</div>
        <div className="kim-part2-instruction">
          Для записи решений и ответов на задания 13–19 используйте БЛАНК
          ОТВЕТОВ № 2. Запишите сначала номер выполняемого задания
          (13, 14 и т.д.), а затем полное обоснованное решение и ответ.
          Ответы записывайте чётко и разборчиво.
        </div>
      </div>
    )}

    <div className="kim-book-tasks">
      {tasks.map((task) => (
        <KimProfileTask key={task.id} task={task} withAnswer={part === 1} />
      ))}
    </div>

    <div className="kim-page-footer">{kimMeta.brand}</div>
  </div>
);

/**
 * Печатный профильный КИМ — плоский список A5-страниц.
 * Двухфазный рендер (см. EgeVariantGenerator): сперва скрытый блок для измерения
 * высот всех задач, затем раздельная пагинация части 1 (1–12) и части 2 (13–19).
 * Часть 2 всегда стартует с новой страницы.
 */
const KimProfileVariantPrint = ({ variant, kimMeta }) => {
  const allTasks = useMemo(
    () => (variant.tasks || []).map((t, i) => ({ ...t, kimNumber: i + 1 })),
    [variant.tasks]
  );
  const part1 = useMemo(() => allTasks.filter(t => t.kimNumber <= PART1_LAST), [allTasks]);
  const part2 = useMemo(() => allTasks.filter(t => t.kimNumber > PART1_LAST), [allTasks]);

  const [state, setState] = useState({ taskKey: null, pages: null });
  const taskRefs = useRef([]);

  // Ключ measure-фазы включает СОДЕРЖИМОЕ, а не только id — иначе правка
  // задачи через редактор (id не меняется) не триггерит перерасчёт пагинации
  // и КИМ печатает устаревший текст. solution_md важен для части 2.
  const taskKey = allTasks
    .map((t) => `${t.id}|${t.statement_md || ''}|${t.solution_md || ''}|${t.image || ''}|${t.has_image ? 1 : 0}|${t.kimImageSize || 'm'}`)
    .join('§');
  const needsMeasure = state.taskKey !== taskKey;

  useLayoutEffect(() => {
    if (!needsMeasure) return;
    if (allTasks.length === 0) { setState({ taskKey, pages: [] }); return; }

    const heights = new Map();
    allTasks.forEach((task, index) => {
      const el = taskRefs.current[index];
      if (el) heights.set(task.id, el.offsetHeight);
    });

    const part1Pages = paginateTasks(part1, heights, PART1_FIRST_PX, PAGE_HEIGHT_PX);
    const part2Pages = paginateTasks(part2, heights, PART2_FIRST_PX, PAGE_HEIGHT_PX);

    const pages = [
      ...part1Pages.map((tasks, i) => ({ part: 1, tasks, isPartStart: i === 0 })),
      ...part2Pages.map((tasks, i) => ({ part: 2, tasks, isPartStart: i === 0 })),
    ];
    setState({ taskKey, pages });
  });

  // ── Фаза 1: скрытый рендер для измерения ──
  if (needsMeasure) {
    return (
      <div className="kim-measure-root">
        <div className="kim-measure-page">
          <div className="kim-measure-tasks">
            {allTasks.map((task, index) => (
              <div
                key={task.id}
                ref={(el) => { taskRefs.current[index] = el; }}
              >
                <KimProfileTask task={task} withAnswer={task.kimNumber <= PART1_LAST} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Фаза 2: плоский список A5-страниц ──
  const pages = state.pages || [];
  if (pages.length === 0) return null;

  return (
    <div className="kim-booklet">
      <KimProfileCoverPage variant={variant} kimMeta={kimMeta} />
      {pages.map((page, index) => (
        <KimProfileTaskPage
          key={index}
          variant={variant}
          pageNumber={index + 2}
          tasks={page.tasks}
          kimMeta={kimMeta}
          part={page.part}
          isPartStart={page.isPartStart}
        />
      ))}
    </div>
  );
};

/**
 * Лист ответов профильного варианта (обычная печать):
 * часть 1 (1–12) — краткие ответы, часть 2 (13–19) — развёрнутые решения с баллами.
 */
const ProfileAnswersPage = ({ variants, title = '' }) => {
  if (variants.length === 0) return null;
  const showVariantHeading = variants.length > 1 || !title;
  return (
    <div className="answers-page">
      <h2>{title || 'Ответы и решения'}</h2>
      {title && <div className="answers-page-subtitle">Лист ответов для учителя</div>}
      {variants.map((variant) => {
        const tasks = (variant.tasks || []).map((t, i) => ({ ...t, kimNumber: i + 1 }));
        const part1 = tasks.filter(t => t.kimNumber <= PART1_LAST);
        const part2 = tasks.filter(t => t.kimNumber > PART1_LAST);
        return (
          <div key={variant.number} className="variant-answers">
            {showVariantHeading && <h3>Вариант {variant.number}</h3>}

            {part1.length > 0 && (
              <>
                <div className="profile-answers-part1-title">Часть 1</div>
                <div className="answers-grid">
                  {part1.map((task) => (
                    <div key={task.id} className="answer-item">
                      <span className="answer-number">{task.kimNumber}.</span>
                      <span className="answer-value">
                        {task.answer ? <MathRenderer text={task.answer} /> : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {part2.length > 0 && (
              <div className="profile-answers-part2">
                <div className="profile-answers-part2-title">Часть 2</div>
                {part2.map((task) => (
                  <div key={task.id} className="profile-answer-solution">
                    <div className="profile-answer-solution-head">
                      Задание {task.kimNumber}
                      {task.max_score ? (
                        <span className="profile-answer-solution-score"> ({task.max_score} б.)</span>
                      ) : null}
                    </div>
                    {task.solution_md ? (
                      <MathRenderer text={task.solution_md} />
                    ) : task.answer ? (
                      <div>Ответ: <MathRenderer text={task.answer} /></div>
                    ) : (
                      <Text type="secondary">— решение не задано —</Text>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export { KimProfileVariantPrint, ProfileAnswersPage, PART1_LAST };
