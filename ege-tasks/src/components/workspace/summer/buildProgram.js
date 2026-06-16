import { api } from '../../../shared/services/pocketbase';
import { WEAK_STATUS } from '../../../shared/utils/weaknessProfile';
import { summerWeeks } from '../../../shared/utils/summerWeeks';

// Сборка индивидуальной летней программы из профиля слабостей.
//
// Модель — доска по неделям: у каждого элемента есть params.week (1..N).
// «Собрать программу» авто-распределяет слабые ЭКЗАМЕНАЦИОННЫЕ темы (алгебра/геометрия)
// по неделям — по отдельной работе+адресной сессии на тему. Устный счёт, тригонометрию
// и любые доп. работы учитель добавляет вручную (см. addExistingWorkItem/generateWorkItem):
// либо выбирает существующую работу, либо генерит из БАНКА по теме (без создания
// новых задач — переиспользуем имеющиеся). Идемпотентно: пересоздаёт items.

const WEAK = new Set([WEAK_STATUS.RED, WEAK_STATUS.AMBER]);

function weakTopicsBySection(profile, section, max) {
  const list = profile.filter((p) => p.section === section && p.topicId && WEAK.has(p.status));
  return max ? list.slice(0, max) : list;
}

function topicLabel(topic) {
  if (!topic) return 'тема';
  return topic.ege_number ? `№${topic.ege_number} — ${topic.title || ''}`.trim() : (topic.title || 'тема');
}

// Одна тема → работа + вариант + адресная сессия. null, если в банке нет задач.
async function buildTopicSession({ student, topicId, label, perTopic, gradeNum, blockTitle }) {
  const tasks = await api.getRandomTasks(perTopic, { topic: topicId });
  if (!tasks.length) return null;
  const taskIds = tasks.map((t) => t.id);
  const work = await api.createWork({ title: `${blockTitle} · ${label} · ${student.name}`, class: gradeNum });
  await api.createVariant({
    work: work.id, number: 1, tasks: taskIds,
    order: taskIds.map((id, i) => ({ taskId: id, position: i })),
  });
  const session = await api.createSession({
    work: work.id, is_open: true, achievements_enabled: false, student_title: `${blockTitle} · ${label}`,
  });
  return { workId: work.id, sessionId: session.id, taskIds };
}

export async function assembleSummerProgram({ student, profile, config, group, year, examType = 'ege_base', topicsById = new Map() }) {
  const gradeNum = Number(group?.grade) || 10;
  const blocks = config?.blocks || {};
  const weeks = Math.max(1, summerWeeks(config?.startDate, config?.endDate).length || 9);

  // 1. Программа ученика (переиспользуем существующую этого сезона/года).
  let program = await api.getStudyProgramForStudent(student.id, { season: 'summer', year });
  const progData = {
    student: student.id,
    group: group?.id || null,
    title: `Каникулярное задание · ${student.name}`,
    year, season: 'summer', exam_type: examType,
    config, profile_snapshot: profile, status: 'issued',
  };
  if (program) {
    await api.updateStudyProgram(program.id, progData);
  } else {
    program = await api.createStudyProgram(progData);
  }

  // 2. Чистим старые элементы (пересборка).
  const old = await api.getProgramItems(program.id);
  for (const it of old) {
    if (it.params?.workId) await api.deleteWork(it.params.workId).catch(() => {});
    await api.deleteProgramItem(it.id);
  }

  // 3. Собираем экзаменационные темы (по элементу на тему) и раскладываем по неделям.
  const examEntries = [];
  const collectExam = async (section, cfg, blockType, blockTitle) => {
    if (!cfg?.enabled) return;
    const weak = weakTopicsBySection(profile, section, cfg.maxTopics);
    for (const w of weak) {
      const label = topicLabel(topicsById.get(w.topicId));
      const res = await buildTopicSession({
        student, topicId: w.topicId, label, perTopic: cfg.perTopic || 4, gradeNum, blockTitle,
      });
      examEntries.push({ blockType, topicId: w.topicId, label, res, perTopic: cfg.perTopic || 4 });
    }
  };
  await collectExam('Алгебра', blocks.algebra, 'algebra', 'Каникулы · Алгебра');
  await collectExam('Геометрия', blocks.geometry, 'geometry', 'Каникулы · Геометрия');

  const perWeek = Math.max(1, Math.ceil(examEntries.length / weeks));
  const items = [];
  let order = 0;
  for (let i = 0; i < examEntries.length; i++) {
    const e = examEntries[i];
    const week = Math.min(weeks, Math.floor(i / perWeek) + 1);
    const rec = await api.createProgramItem({
      program: program.id, order: order++,
      block_type: e.blockType, topic: e.topicId, title: e.label,
      session: e.res?.sessionId || null,
      params: { week, perTopic: e.perTopic, workId: e.res?.workId || null, attachments: [] },
      status: e.res ? 'issued' : 'planned',
    });
    items.push(rec);
  }

  return { program, items };
}

// Следующий order для нового элемента (вызовы add* идут из редактора).
async function nextOrder(programId) {
  const items = await api.getProgramItems(programId);
  return items.reduce((m, it) => Math.max(m, it.order ?? 0), -1) + 1;
}

// Добавить в неделю СУЩЕСТВУЮЩУЮ работу: своя адресная сессия + элемент программы.
export async function addExistingWorkItem({ programId, week, work, blockType = 'custom' }) {
  const session = await api.createSession({
    work: work.id, is_open: true, achievements_enabled: false, student_title: work.title || 'Работа',
  });
  return api.createProgramItem({
    program: programId, order: await nextOrder(programId),
    block_type: blockType, topic: work.topic || null, title: work.title || 'Работа',
    session: session.id,
    params: { week, workId: work.id, attachments: [] },
    status: 'issued',
  });
}

// Добавить в неделю работу, СГЕНЕРИРОВАННУЮ из БАНКА по фильтрам (без создания новых задач).
// filters: { exam_type?, topic?, subtopic?, difficulty? } — передаётся в getRandomTasks.
export async function generateWorkItem({ programId, week, student, gradeNum, filters = {}, count, title, blockType = 'custom' }) {
  const tasks = await api.getRandomTasks(count || 8, filters);
  if (!tasks.length) return null;
  const taskIds = tasks.map((t) => t.id);
  const work = await api.createWork({ title: `${title} · ${student.name}`, class: gradeNum });
  await api.createVariant({
    work: work.id, number: 1, tasks: taskIds,
    order: taskIds.map((id, i) => ({ taskId: id, position: i })),
  });
  const session = await api.createSession({
    work: work.id, is_open: true, achievements_enabled: false, student_title: title,
  });
  return api.createProgramItem({
    program: programId, order: await nextOrder(programId),
    block_type: blockType, topic: filters.topic || null, title,
    session: session.id,
    params: { week, workId: work.id, attachments: [] },
    status: 'issued',
  });
}
