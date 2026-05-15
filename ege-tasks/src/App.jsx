import { lazy, Suspense, useState, useEffect } from 'react';
import {
  BrowserRouter, Routes, Route, Navigate,
  useNavigate, useLocation, useParams, useSearchParams, Outlet,
} from 'react-router-dom';
import { Layout, Menu, ConfigProvider, Spin, Drawer, Button, Grid, Breadcrumb } from 'antd';
import { hybridTheme } from './theme/hybrid';
import {
  FileTextOutlined, FileSearchOutlined, BookOutlined, FileAddOutlined,
  UploadOutlined, PieChartOutlined, SolutionOutlined, EditOutlined,
  TeamOutlined, TrophyOutlined, BarChartOutlined, ReadOutlined,
  SnippetsOutlined, FolderOutlined, CompassOutlined, UnorderedListOutlined,
  FormOutlined, QrcodeOutlined, PictureOutlined, HeatMapOutlined,
  BranchesOutlined, CreditCardOutlined, RadarChartOutlined, KeyOutlined,
  FunctionOutlined, AppstoreOutlined, BulbOutlined, MenuOutlined,
  CalculatorOutlined, ExperimentOutlined, LineChartOutlined, FieldNumberOutlined,
} from '@ant-design/icons';
import TaskList from './components/TaskList';
import TaskSheetGenerator from './components/OralWorksheetGenerator';
import TestWorkGenerator from './components/TestWorkGenerator';
import EgeVariantGenerator from './components/EgeVariantGenerator';
import TaskStatsDashboard from './components/TaskStatsDashboard';
import TaskCatalogManager from './components/TaskCatalogManager';
import TheoryBrowser from './components/TheoryBrowser';
const TheoryEditor = lazy(() => import('./components/TheoryEditor'));
const ExcalidrawSection = lazy(() => import('./components/ExcalidrawSection'));
import TheoryArticleView from './components/TheoryArticleView';
import TheoryCategoryManager from './components/TheoryCategoryManager';
import TheoryPrintBuilder from './components/TheoryPrintBuilder';
import TaskImporter from './components/TaskImporter';
import WorkManager from './components/WorkManager';
import WorkEditorPage from './components/WorkEditorPage';
import StudentProgressDashboard from './components/StudentProgressDashboard';
import StudentDetailPage from './components/StudentDetailPage';
import AchievementManager from './components/AchievementManager';
import GeometryTaskList from './components/GeometryTaskList';
import GeometryTopicManager from './components/geometry/GeometryTopicManager';
import TDFManager from './components/tdf/TDFManager';
import TDFEditor from './components/tdf/TDFEditor';
import TDFVariantBuilder from './components/tdf/TDFVariantBuilder';
import TDFFlashcards from './components/tdf/TDFFlashcards';
import FormulaSheetGenerator from './components/FormulaSheetGenerator';
import QRWorksheetGenerator from './components/QRWorksheetGenerator';
import PixelArtWorksheet from './components/PixelArtWorksheet';
import TeamPixelArtWorksheet from './components/TeamPixelArtWorksheet';
import RouteSheetGenerator from './components/RouteSheetGenerator';
import ErrorHeatmap from './components/ErrorHeatmap';
import UnitCircleGenerator from './components/UnitCircleGenerator';
import UnitCircleCryptogramGenerator from './components/UnitCircleCryptogramGenerator';
import CryptogramGenerator from './components/CryptogramGenerator';
import TrigValuesGenerator from './components/TrigValuesGenerator';
import TrigExpressionsGenerator from './components/TrigExpressionsGenerator';
import InverseTrigGenerator from './components/InverseTrigGenerator';
import TrigEquationsGenerator from './components/TrigEquationsGenerator';
import TrigEquationsAdvancedGenerator from './components/TrigEquationsAdvancedGenerator';
import ReductionFormulasGenerator from './components/ReductionFormulasGenerator';
import AdditionFormulasGenerator from './components/AdditionFormulasGenerator';
import TrigMixedGenerator from './components/TrigMixedGenerator';
import DoubleAngleGenerator from './components/DoubleAngleGenerator';
import OralCountingGenerator from './components/OralCountingGenerator';
import LogExpEquationsGenerator from './components/LogExpEquationsGenerator';
import OralPowersRootsGenerator from './components/OralPowersRootsGenerator';
import OralLogarithmsGenerator from './components/OralLogarithmsGenerator';
import OralEgeBaseGenerator from './components/OralEgeBaseGenerator';
import MarathonGenerator from './components/MarathonGenerator';
import CrosswordGenerator from './components/CrosswordGenerator';
import EgeScoreCalculator from './components/EgeScoreCalculator';
import MCTestGenerator from './components/MCTestGenerator';
import { api } from './services/pocketbase';
import { ReferenceDataProvider, useReferenceData } from './contexts/ReferenceDataContext';
import { useVersionSync } from './shared/version/useVersionSync';
import 'katex/dist/katex.min.css';
import './theme/tokens.css';
import './App.css';

const { Header, Content, Sider } = Layout;

// ── Route path constants ────────────────────────────────────────────────────
export const R = {
  TASKS:               '/app/tasks',
  STATS:               '/app/stats',
  CATALOG:             '/app/catalog',
  // Рабочие листы
  GENERATOR:           '/app/worksheets/oral',
  EGE_VARIANT:         '/app/worksheets/ege-variant',
  EGE_SCORE_CALC:      '/app/worksheets/ege-score-calc',
  TEST:                '/app/worksheets/test',
  MC_TEST:             '/app/worksheets/mc-test',
  MC_TEST_EDIT:        '/app/worksheets/mc-test/:testId',
  // Геймификация
  QR:                  '/app/gamification/qr-worksheet',
  PIXEL_ART:           '/app/gamification/pixel-art',
  PIXEL_ART_TEAM:      '/app/gamification/pixel-art-team',
  CRYPTOGRAM:          '/app/gamification/cryptogram',
  ROUTE_SHEET:         '/app/gamification/route-sheet',
  MARATHON:            '/app/gamification/marathon',
  CROSSWORD:           '/app/gamification/crossword',
  // Работы
  WORKS:               '/app/works',
  WORK_EDITOR:         '/app/works/:workId/edit',
  // Ученики
  STUDENTS:            '/app/students',
  STUDENTS_HEATMAP:    '/app/students/heatmap',
  ACHIEVEMENTS:        '/app/students/achievements',
  STUDENT_DETAIL:      '/app/students/:studentId',
  // Прочее
  IMPORT:              '/app/import',
  GEOMETRY_TASKS:      '/app/geometry/tasks',
  GEOMETRY_TOPICS:     '/app/geometry/topics',
  // ТДФ
  TDF:                 '/app/tdf',
  TDF_EDITOR:          '/app/tdf/sets/:setId/edit',
  TDF_VARIANTS:        '/app/tdf/sets/:setId/variants',
  TDF_FLASHCARDS:      '/app/tdf/sets/:setId/flashcards',
  FORMULA_SHEET:       '/app/tdf/formula-sheet',
  // Тригонометрия
  TRIG_MIXED:          '/app/trig/mixed',
  UNIT_CIRCLE:         '/app/trig/unit-circle',
  TRIG_VALUES:         '/app/trig/values',
  TRIG_EXPRESSIONS:    '/app/trig/expressions',
  INVERSE_TRIG:        '/app/trig/inverse',
  TRIG_EQUATIONS:      '/app/trig/equations',
  TRIG_EQUATIONS_ADV:  '/app/trig/equations-advanced',
  REDUCTION:           '/app/trig/reduction',
  ADDITION:            '/app/trig/addition',
  DOUBLE_ANGLE:        '/app/trig/double-angle',
  TRIG_CRYPTOGRAM:     '/app/trig/cryptogram',
  // Арифметика
  ORAL_COUNTING:       '/app/arith/oral-counting',
  LOG_EXP_EQUATIONS:   '/app/arith/log-exp',
  POWERS_ROOTS:        '/app/arith/powers-roots',
  LOGARITHMS:          '/app/arith/logarithms',
  EGE_BASE_ORAL:       '/app/arith/ege-base',
  // Теория
  THEORY:              '/app/theory',
  THEORY_NEW:          '/app/theory/articles/new',
  THEORY_VIEW:         '/app/theory/articles/:articleId',
  THEORY_EDIT:         '/app/theory/articles/:articleId/edit',
  THEORY_PRINT:        '/app/theory/print',
  THEORY_CATEGORIES:   '/app/theory/categories',
  // Лаборатория
  EXCALIDRAW:          '/app/lab/excalidraw',
};

// Вспомогательная функция для построения конкретного URL из шаблона с параметрами
export function route(template, params) {
  return Object.entries(params).reduce(
    (url, [k, v]) => url.replace(`:${k}`, encodeURIComponent(v)),
    template,
  );
}

// ── Метаданные маршрутов (для заголовка, подсветки меню, отступов) ──────────
// Порядок важен: более специфичные паттерны — первее
const ROUTE_META = [
  // Работы (detail)
  { re: /^\/app\/works\/[^/]+\/edit/, menuKey: 'work-editor',        title: 'Редактор работ' },
  // Ученики (detail + sub-pages)
  { re: /^\/app\/students\/heatmap$/,     menuKey: 'heatmap',       menuGroup: 'students-group', title: 'Тепловая карта ошибок' },
  { re: /^\/app\/students\/achievements$/, menuKey: 'achievements', menuGroup: 'students-group', title: 'Управление достижениями' },
  { re: /^\/app\/students\/[^/]+$/,        menuKey: 'students',     menuGroup: 'students-group', title: 'Детали ученика' },
  // ТДФ (detail)
  { re: /^\/app\/tdf\/sets\/[^/]+\/edit/,      menuKey: 'tdf',           menuGroup: 'tdf-group', title: 'ТДФ — Редактор конспекта' },
  { re: /^\/app\/tdf\/sets\/[^/]+\/variants/,  menuKey: 'tdf',           menuGroup: 'tdf-group', title: 'ТДФ — Варианты' },
  { re: /^\/app\/tdf\/sets\/[^/]+\/flashcards/, menuKey: 'tdf-flashcards', menuGroup: 'tdf-group', title: 'ТДФ — Карточки-флипы' },
  // Теория (detail + editor)
  { re: /^\/app\/theory\/articles\/new$/,          menuKey: 'theory-editor',  menuGroup: 'theory', title: 'Теория — Новая статья',  noMargin: true },
  { re: /^\/app\/theory\/articles\/[^/]+\/edit$/,  menuKey: 'theory-editor',  menuGroup: 'theory', title: 'Теория — Редактор',       noMargin: true },
  { re: /^\/app\/theory\/articles\/[^/]+$/,        menuKey: 'theory-browser', menuGroup: 'theory', title: 'Теория — Просмотр',       noMargin: true },
  // MC-тест (edit с id)
  { re: /^\/app\/worksheets\/mc-test\/.+/, menuKey: 'mc-test', menuGroup: 'worksheets-group', title: 'Тесты с выбором' },
  // Простые маршруты
  { re: /^\/app\/tasks/,                   menuKey: 'tasks',                   title: 'Все задачи' },
  { re: /^\/app\/stats/,                   menuKey: 'stats',                   title: 'Аналитика задач' },
  { re: /^\/app\/catalog/,                 menuKey: 'catalog',                 title: 'Каталог задач' },
  { re: /^\/app\/worksheets\/oral/,        menuKey: 'generator',         menuGroup: 'worksheets-group', title: 'Генератор' },
  { re: /^\/app\/worksheets\/ege-variant/, menuKey: 'ege-variant',       menuGroup: 'worksheets-group', title: 'Варианты ЕГЭ (базовый уровень)' },
  { re: /^\/app\/worksheets\/ege-score/,   menuKey: 'ege-score-calc',    menuGroup: 'worksheets-group', title: 'Калькулятор баллов ЕГЭ' },
  { re: /^\/app\/worksheets\/test/,        menuKey: 'test-generator',    menuGroup: 'worksheets-group', title: 'Контрольные работы' },
  { re: /^\/app\/worksheets\/mc-test$/,    menuKey: 'mc-test',           menuGroup: 'worksheets-group', title: 'Тесты с выбором' },
  { re: /^\/app\/gamification\/qr/,        menuKey: 'qr-worksheet',      menuGroup: 'gamification-group', title: 'QR-листы' },
  { re: /^\/app\/gamification\/pixel-art-team/, menuKey: 'pixel-art-team', menuGroup: 'gamification-group', title: 'Командный пиксель-арт' },
  { re: /^\/app\/gamification\/pixel-art$/, menuKey: 'pixel-art',        menuGroup: 'gamification-group', title: 'Пиксель-арт раскраска' },
  { re: /^\/app\/gamification\/cryptogram/, menuKey: 'cryptogram',       menuGroup: 'gamification-group', title: 'Шифровки' },
  { re: /^\/app\/gamification\/route/,     menuKey: 'route-sheet',       menuGroup: 'gamification-group', title: 'Маршрутный лист' },
  { re: /^\/app\/gamification\/marathon/,  menuKey: 'marathon',          menuGroup: 'gamification-group', title: 'Марафон — подготовка и проведение' },
  { re: /^\/app\/gamification\/crossword/, menuKey: 'crossword',         menuGroup: 'gamification-group', title: 'Генератор кроссвордов' },
  { re: /^\/app\/works$/,                  menuKey: 'work-manager',              title: 'Мои работы' },
  { re: /^\/app\/students$/,               menuKey: 'students', menuGroup: 'students-group', title: 'Прогресс учеников' },
  { re: /^\/app\/import/,                  menuKey: 'import',                    title: 'Импорт задач' },
  { re: /^\/app\/geometry\/tasks/,         menuKey: 'geometry-tasks',   menuGroup: 'geometry', title: 'Геометрические задачи' },
  { re: /^\/app\/geometry\/topics/,        menuKey: 'geometry-topics',  menuGroup: 'geometry', title: 'Геометрия — Темы и подтемы' },
  { re: /^\/app\/tdf$/,                    menuKey: 'tdf',              menuGroup: 'tdf-group', title: 'ТДФ — Теоремы, Определения, Формулы' },
  { re: /^\/app\/tdf\/formula-sheet/,      menuKey: 'formula-sheet',    menuGroup: 'tdf-group', title: 'ТДФ — Листы формул' },
  { re: /^\/app\/trig\/mixed/,             menuKey: 'trig-mixed',       menuGroup: 'trig', title: 'Тригонометрия — Смешанная работа' },
  { re: /^\/app\/trig\/unit-circle/,       menuKey: 'unit-circle',      menuGroup: 'trig', title: 'Тригонометрия — Единичная окружность' },
  { re: /^\/app\/trig\/values/,            menuKey: 'trig-values',      menuGroup: 'trig', title: 'Тригонометрия — Значения функций' },
  { re: /^\/app\/trig\/expressions/,       menuKey: 'trig-expressions', menuGroup: 'trig', title: 'Тригонометрия — Вычисление выражений' },
  { re: /^\/app\/trig\/inverse/,           menuKey: 'inverse-trig',     menuGroup: 'trig', title: 'Тригонометрия — Обратные функции' },
  { re: /^\/app\/trig\/equations-advanced/, menuKey: 'trig-equations-advanced', menuGroup: 'trig', title: 'Тригонометрия — Уравнения f(kx+b)=a' },
  { re: /^\/app\/trig\/equations/,         menuKey: 'trig-equations',   menuGroup: 'trig', title: 'Тригонометрия — Уравнения' },
  { re: /^\/app\/trig\/reduction/,         menuKey: 'reduction-formulas', menuGroup: 'trig', title: 'Тригонометрия — Формулы приведения' },
  { re: /^\/app\/trig\/addition/,          menuKey: 'addition-formulas', menuGroup: 'trig', title: 'Тригонометрия — Формулы сложения' },
  { re: /^\/app\/trig\/double-angle/,      menuKey: 'double-angle',     menuGroup: 'trig', title: 'Тригонометрия — Двойной аргумент' },
  { re: /^\/app\/trig\/cryptogram/,        menuKey: 'trig-cryptogram',  menuGroup: 'trig', title: 'Тригонометрия — Шифровки' },
  { re: /^\/app\/arith\/oral-counting/,   menuKey: 'oral-counting',    menuGroup: 'arith', title: 'Устный счёт — Арифметика' },
  { re: /^\/app\/arith\/log-exp/,         menuKey: 'log-exp',          menuGroup: 'arith', title: 'Устный счёт — Степени и логарифмы' },
  { re: /^\/app\/arith\/powers-roots/,    menuKey: 'powers-roots',     menuGroup: 'arith', title: 'Устный счёт — Степени и корни' },
  { re: /^\/app\/arith\/logarithms/,      menuKey: 'logarithms',       menuGroup: 'arith', title: 'Устный счёт — Логарифмы' },
  { re: /^\/app\/arith\/ege-base/,        menuKey: 'ege-base-oral',    menuGroup: 'arith', title: 'Устный счёт — ЕГЭ база' },
  { re: /^\/app\/theory\/print/,           menuKey: 'theory-print',     menuGroup: 'theory', title: 'Теория — Конспекты', noMargin: true },
  { re: /^\/app\/theory\/categories/,      menuKey: 'theory-categories', menuGroup: 'theory', title: 'Теория — Категории' },
  { re: /^\/app\/theory$/,                 menuKey: 'theory-browser',   menuGroup: 'theory', title: 'Теория — Библиотека' },
  { re: /^\/app\/lab\/excalidraw/,         menuKey: 'excalidraw',       menuGroup: 'lab', title: 'Excalidraw', noMargin: true },
];

function getRouteMeta(pathname) {
  return ROUTE_META.find(m => m.re.test(pathname)) ?? {};
}

// ── Маппинг menuKey → путь (для навигации по клику в меню) ─────────────────
const MENU_KEY_PATH = {
  tasks:                    R.TASKS,
  stats:                    R.STATS,
  generator:                R.GENERATOR,
  'ege-variant':            R.EGE_VARIANT,
  'ege-score-calc':         R.EGE_SCORE_CALC,
  'test-generator':         R.TEST,
  'mc-test':                R.MC_TEST,
  'qr-worksheet':           R.QR,
  'pixel-art':              R.PIXEL_ART,
  'pixel-art-team':         R.PIXEL_ART_TEAM,
  cryptogram:               R.CRYPTOGRAM,
  'route-sheet':            R.ROUTE_SHEET,
  marathon:                 R.MARATHON,
  crossword:                R.CROSSWORD,
  'work-manager':           R.WORKS,
  'work-editor':            '/app/works/new/edit',
  students:                 R.STUDENTS,
  heatmap:                  R.STUDENTS_HEATMAP,
  achievements:             R.ACHIEVEMENTS,
  import:                   R.IMPORT,
  'geometry-tasks':         R.GEOMETRY_TASKS,
  'geometry-topics':        R.GEOMETRY_TOPICS,
  tdf:                      R.TDF,
  'tdf-flashcards':         R.TDF,   // открывает список наборов; карточки — через TDFManager
  'formula-sheet':          R.FORMULA_SHEET,
  'trig-mixed':             R.TRIG_MIXED,
  'unit-circle':            R.UNIT_CIRCLE,
  'trig-values':            R.TRIG_VALUES,
  'trig-expressions':       R.TRIG_EXPRESSIONS,
  'inverse-trig':           R.INVERSE_TRIG,
  'trig-equations':         R.TRIG_EQUATIONS,
  'trig-equations-advanced': R.TRIG_EQUATIONS_ADV,
  'reduction-formulas':     R.REDUCTION,
  'addition-formulas':      R.ADDITION,
  'double-angle':           R.DOUBLE_ANGLE,
  'trig-cryptogram':        R.TRIG_CRYPTOGRAM,
  'oral-counting':          R.ORAL_COUNTING,
  'log-exp':                R.LOG_EXP_EQUATIONS,
  'powers-roots':           R.POWERS_ROOTS,
  'logarithms':             R.LOGARITHMS,
  'ege-base-oral':          R.EGE_BASE_ORAL,
  'theory-browser':         R.THEORY,
  'theory-editor':          R.THEORY_NEW,
  'theory-print':           R.THEORY_PRINT,
  'theory-categories':      R.THEORY_CATEGORIES,
  excalidraw:               R.EXCALIDRAW,
};

// ── Метаданные групп меню (для хлебных крошек) ──────────────────────────────
const GROUP_META = {
  'worksheets-group':   { label: 'Рабочие листы' },
  'gamification-group': { label: 'Геймификация' },
  'students-group':     { label: 'Ученики',      path: R.STUDENTS },
  geometry:             { label: 'Геометрия',    path: R.GEOMETRY_TASKS },
  'tdf-group':          { label: 'ТДФ',          path: R.TDF },
  trig:                 { label: 'Тригонометрия' },
  arith:                { label: 'Устный счёт' },
  theory:               { label: 'Теория',        path: R.THEORY },
  lab:                  { label: 'Лаборатория' },
};

// Явные родители для страниц без menuGroup
const PARENT_META = {
  'work-editor': { label: 'Мои работы', path: R.WORKS },
  catalog:       { label: 'Аналитика',  path: R.STATS },
};

// ── Утилиты для фильтров (Stats → Tasks) ────────────────────────────────────
function filtersToSearch(filters) {
  if (!filters) return '';
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v != null) p.set(k, String(v)); });
  const s = p.toString();
  return s ? '?' + s : '';
}

function parseFiltersFromSearch(searchParams) {
  const filters = {};
  for (const [k, v] of searchParams.entries()) filters[k] = v;
  return Object.keys(filters).length ? filters : null;
}

// ── Вспомогательный Suspense-лоадер ─────────────────────────────────────────
function LazyFallback() {
  return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;
}

// ── Page wrappers (читают params/searchParams, прокидывают navigate-колбэки) ─

function TasksPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filters = parseFiltersFromSearch(searchParams);
  return (
    <TaskList
      initialFilters={filters}
      initialFiltersToken={searchParams.toString()}
      onOpenWorkEditor={(workId) => navigate(route(R.WORK_EDITOR, { workId }))}
    />
  );
}

function StatsPage() {
  const navigate = useNavigate();
  return (
    <TaskStatsDashboard
      onOpenTasks={(filters) => navigate(R.TASKS + filtersToSearch(filters))}
      onOpenCatalog={() => navigate(R.CATALOG)}
    />
  );
}

function CatalogPage() {
  const navigate = useNavigate();
  return (
    <TaskCatalogManager
      onOpenTasks={(filters) => navigate(R.TASKS + filtersToSearch(filters))}
      onBackToAnalytics={() => navigate(R.STATS)}
    />
  );
}

function MCTestPage() {
  const { testId } = useParams();
  return <MCTestGenerator initialMcTestId={testId ?? null} />;
}

function WorksPage() {
  const navigate = useNavigate();
  return (
    <WorkManager
      onEditWork={(workId) => navigate(route(R.WORK_EDITOR, { workId }))}
      onEditMCTest={(mcId) => navigate(route(R.MC_TEST_EDIT, { testId: mcId }))}
    />
  );
}

function WorkEditorRoute() {
  const { workId } = useParams();
  return <WorkEditorPage initialWorkId={workId === 'new' ? null : workId} />;
}

function StudentsPage() {
  const navigate = useNavigate();
  return (
    <StudentProgressDashboard
      onOpenWork={(workId) => navigate(route(R.WORK_EDITOR, { workId }))}
      onOpenStudent={(studentId) => navigate(route(R.STUDENT_DETAIL, { studentId }))}
    />
  );
}

function StudentDetailRoute() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  return (
    <StudentDetailPage
      studentId={studentId}
      onBack={() => navigate(R.STUDENTS)}
      onOpenWork={(workId) => navigate(route(R.WORK_EDITOR, { workId }))}
    />
  );
}

function TDFPage() {
  const navigate = useNavigate();
  return (
    <TDFManager
      onOpenEditor={(id) => navigate(route(R.TDF_EDITOR, { setId: id }))}
      onOpenVariants={(id) => navigate(route(R.TDF_VARIANTS, { setId: id }))}
      onOpenFlashcards={(id) => navigate(route(R.TDF_FLASHCARDS, { setId: id }))}
    />
  );
}

function TDFEditorRoute() {
  const { setId } = useParams();
  const navigate = useNavigate();
  return <TDFEditor setId={setId} onBack={() => navigate(R.TDF)} />;
}

function TDFVariantsRoute() {
  const { setId } = useParams();
  const navigate = useNavigate();
  return <TDFVariantBuilder setId={setId} onBack={() => navigate(R.TDF)} />;
}

function TDFFlashcardsRoute() {
  const { setId } = useParams();
  const navigate = useNavigate();
  return <TDFFlashcards setId={setId} onBack={() => navigate(R.TDF)} />;
}

function TheoryPage() {
  const navigate = useNavigate();
  return (
    <TheoryBrowser
      onEditArticle={(id) => navigate(route(R.THEORY_EDIT, { articleId: id }))}
      onViewArticle={(id) => navigate(route(R.THEORY_VIEW, { articleId: id }))}
      onCreateArticle={() => navigate(R.THEORY_NEW)}
    />
  );
}

function TheoryArticleRoute() {
  const { articleId } = useParams();
  const navigate = useNavigate();
  return (
    <TheoryArticleView
      articleId={articleId}
      onBack={() => navigate(R.THEORY)}
      onEdit={(id) => navigate(route(R.THEORY_EDIT, { articleId: id }))}
    />
  );
}

function TheoryEditorRoute() {
  const { articleId } = useParams();
  const navigate = useNavigate();
  const { reloadData } = useReferenceData();
  return (
    <Suspense fallback={<LazyFallback />}>
      <TheoryEditor
        articleId={articleId ?? null}
        onBack={() => navigate(R.THEORY)}
        onSaved={(newId) => {
          reloadData();
          // После создания новой статьи — заменяем URL на edit-режим
          if (!articleId && newId) {
            navigate(route(R.THEORY_EDIT, { articleId: newId }), { replace: true });
          }
        }}
      />
    </Suspense>
  );
}

function TheoryPrintRoute() {
  const navigate = useNavigate();
  return <TheoryPrintBuilder onBack={() => navigate(R.THEORY)} />;
}

// ── AppLayout (шапка, боковое меню, контентная область) ─────────────────────

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isDesktop = !!screens.lg;
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState([]);

  useVersionSync();

  useEffect(() => {
    if (api.isStudentAuthenticated()) {
      api.logoutStudent();
    }
  }, []);

  const meta = getRouteMeta(location.pathname);
  const { menuKey = '', menuGroup, title = '', noMargin = false } = meta;

  // Хлебные крошки: группа (или явный родитель) → текущая страница
  const breadcrumbParent = (menuGroup ? GROUP_META[menuGroup] : null)
    ?? (menuKey ? PARENT_META[menuKey] : null);
  const breadcrumbItems = breadcrumbParent ? [
    breadcrumbParent.path
      ? { title: <a onClick={(e) => { e.preventDefault(); navigate(breadcrumbParent.path); }} style={{ cursor: 'pointer' }}>{breadcrumbParent.label}</a> }
      : { title: <span>{breadcrumbParent.label}</span> },
    { title },
  ] : null;

  // Авто-открываем группу меню при смене маршрута
  useEffect(() => {
    if (menuGroup) {
      setOpenKeys(prev => prev.includes(menuGroup) ? prev : [...prev, menuGroup]);
    }
  }, [menuGroup]);

  const handleMenuClick = ({ key }) => {
    const path = MENU_KEY_PATH[key];
    if (path) navigate(path);
    setMobileDrawerOpen(false);
  };

  const menuItems = [
    { key: 'tasks',  icon: <FileTextOutlined />,  label: 'Все задачи' },
    { key: 'stats',  icon: <PieChartOutlined />,   label: 'Аналитика' },
    {
      key: 'worksheets-group', icon: <AppstoreOutlined />, label: 'Рабочие листы',
      children: [
        { key: 'generator',       icon: <FileSearchOutlined />, label: 'Генератор' },
        { key: 'ege-variant',     icon: <FileAddOutlined />,    label: 'Варианты ЕГЭ' },
        { key: 'ege-score-calc',  icon: <BarChartOutlined />,   label: 'Калькулятор баллов' },
        { key: 'test-generator',  icon: <SnippetsOutlined />,   label: 'Контрольные работы' },
        { key: 'mc-test',         icon: <FormOutlined />,       label: 'Тесты с выбором' },
      ],
    },
    {
      key: 'gamification-group', icon: <BulbOutlined />, label: 'Геймификация',
      children: [
        { key: 'qr-worksheet',    icon: <QrcodeOutlined />,    label: 'QR-листы' },
        { key: 'pixel-art',       icon: <PictureOutlined />,   label: 'Пиксель-арт' },
        { key: 'pixel-art-team',  icon: <TeamOutlined />,      label: 'Командный пиксель-арт' },
        { key: 'cryptogram',      icon: <KeyOutlined />,       label: 'Шифровки' },
        { key: 'route-sheet',     icon: <BranchesOutlined />,  label: 'Маршрутный лист' },
        { key: 'marathon',        icon: <TrophyOutlined />,    label: 'Марафон' },
        { key: 'crossword',       icon: <AppstoreOutlined />,  label: 'Кроссворды' },
      ],
    },
    { key: 'work-manager', icon: <SolutionOutlined />, label: 'Мои работы' },
    { key: 'work-editor',  icon: <EditOutlined />,     label: 'Редактор работ' },
    {
      key: 'students-group', icon: <TeamOutlined />, label: 'Ученики',
      children: [
        { key: 'students',      icon: <BarChartOutlined />,  label: 'Прогресс' },
        { key: 'heatmap',       icon: <HeatMapOutlined />,   label: 'Тепловая карта' },
        { key: 'achievements',  icon: <TrophyOutlined />,    label: 'Достижения' },
      ],
    },
    { key: 'import', icon: <UploadOutlined />, label: 'Импорт задач' },
    {
      key: 'geometry', icon: <CompassOutlined />, label: 'Геометрия',
      children: [
        { key: 'geometry-tasks',   icon: <UnorderedListOutlined />, label: 'Задачи' },
        { key: 'geometry-topics',  icon: <FolderOutlined />,        label: 'Темы и подтемы' },
      ],
    },
    {
      key: 'tdf-group', icon: <FormOutlined />, label: 'ТДФ',
      children: [
        { key: 'tdf',           icon: <UnorderedListOutlined />, label: 'Наборы' },
        { key: 'tdf-flashcards', icon: <CreditCardOutlined />,  label: 'Карточки' },
        { key: 'formula-sheet', icon: <FunctionOutlined />,     label: 'Листы формул' },
      ],
    },
    {
      key: 'trig', icon: <RadarChartOutlined />, label: 'Тригонометрия',
      children: [
        { key: 'trig-mixed',              icon: <FunctionOutlined />,    label: 'Смешанная работа' },
        { key: 'unit-circle',             icon: <RadarChartOutlined />,  label: 'Единичная окружность' },
        { key: 'trig-values',             icon: <RadarChartOutlined />,  label: 'Значения функций' },
        { key: 'trig-expressions',        icon: <FunctionOutlined />,    label: 'Вычисление выражений' },
        { key: 'inverse-trig',            icon: <FunctionOutlined />,    label: 'Обратные функции' },
        { key: 'trig-equations',          icon: <FunctionOutlined />,    label: 'Уравнения' },
        { key: 'trig-equations-advanced', icon: <FunctionOutlined />,    label: 'Уравнения f(kx+b)=a' },
        { key: 'reduction-formulas',      icon: <FunctionOutlined />,    label: 'Формулы приведения' },
        { key: 'addition-formulas',       icon: <FunctionOutlined />,    label: 'Формулы сложения' },
        { key: 'double-angle',            icon: <FunctionOutlined />,    label: 'Двойной аргумент' },
        { key: 'trig-cryptogram',         icon: <KeyOutlined />,         label: 'Шифровки' },
      ],
    },
    {
      key: 'arith', icon: <CalculatorOutlined />, label: 'Устный счёт',
      children: [
        { key: 'oral-counting', icon: <CalculatorOutlined />, label: 'Арифметика' },
        { key: 'log-exp',       icon: <FunctionOutlined />,  label: 'Степени и логарифмы' },
        { key: 'powers-roots',  icon: <ExperimentOutlined />, label: 'Степени и корни' },
        { key: 'logarithms',    icon: <LineChartOutlined />,  label: 'Логарифмы' },
        { key: 'ege-base-oral', icon: <FieldNumberOutlined />, label: 'ЕГЭ база' },
      ],
    },
    {
      key: 'theory', icon: <BookOutlined />, label: 'Теория',
      children: [
        { key: 'theory-browser',    icon: <ReadOutlined />,    label: 'Библиотека' },
        { key: 'theory-editor',     icon: <EditOutlined />,    label: 'Редактор' },
        { key: 'theory-print',      icon: <SnippetsOutlined />, label: 'Конспекты' },
        { key: 'theory-categories', icon: <FolderOutlined />,  label: 'Категории' },
      ],
    },
    {
      key: 'lab', icon: <EditOutlined />, label: 'Лаборатория',
      children: [
        { key: 'excalidraw', icon: <EditOutlined />, label: 'Excalidraw' },
      ],
    },
  ];

  const menuEl = (
    <Menu
      mode="inline"
      selectedKeys={menuKey ? [menuKey] : []}
      openKeys={openKeys}
      onOpenChange={setOpenKeys}
      items={menuItems}
      onClick={handleMenuClick}
      style={{ borderRight: 0 }}
    />
  );

  const logo = (
    <div style={{
      height: 64, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '10px 16px', flexShrink: 0,
    }}>
      <img src="/lemma-logo-new.png" alt="Lemma"
        style={{ height: 38, width: 'auto', borderRadius: 6 }} />
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isDesktop && (
        <Sider width={220} style={{ background: '#fff', boxShadow: '2px 0 8px rgba(0,0,0,0.05)' }}>
          {logo}
          {menuEl}
        </Sider>
      )}

      {!isDesktop && (
        <Drawer
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          placement="left"
          width={260}
          styles={{ body: { padding: 0, overflowX: 'hidden' }, header: { display: 'none' } }}
          style={{ padding: 0 }}
        >
          {logo}
          {menuEl}
        </Drawer>
      )}

      <Layout>
        <Header style={{
          background: '#fff',
          padding: isDesktop ? '0 24px' : '0 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {!isDesktop && (
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: 20 }} />}
              onClick={() => setMobileDrawerOpen(true)}
              style={{ flexShrink: 0, width: 40, height: 40 }}
            />
          )}
          {breadcrumbItems ? (
            <Breadcrumb
              items={breadcrumbItems}
              style={{ flex: 1, fontSize: isDesktop ? 15 : 13 }}
            />
          ) : (
            <span style={{
              fontSize: isDesktop ? 20 : 16,
              fontWeight: 500, flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {title}
            </span>
          )}
        </Header>

        <Content style={{
          margin: noMargin ? 0 : (isDesktop ? '24px 16px 0' : '12px 8px 0'),
          overflow: 'hidden',
        }}>
          <div style={{
            padding: noMargin ? 0 : (isDesktop ? 24 : 16),
            minHeight: noMargin ? undefined : 360,
            height: noMargin ? '100%' : undefined,
            background: '#fff',
            borderRadius: noMargin ? 0 : 8,
          }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

// ── App (корень: провайдеры + роутер) ────────────────────────────────────────

function App() {
  return (
    <ConfigProvider theme={hybridTheme}>
      <BrowserRouter>
        <ReferenceDataProvider>
          <Routes>
            {/* Редирект с корня */}
            <Route path="/" element={<Navigate to={R.TASKS} replace />} />
            <Route path="/app" element={<Navigate to={R.TASKS} replace />} />

            {/* Все учительские страницы через AppLayout */}
            <Route element={<AppLayout />}>
              {/* Задачи */}
              <Route path={R.TASKS}   element={<TasksPage />} />
              <Route path={R.STATS}   element={<StatsPage />} />
              <Route path={R.CATALOG} element={<CatalogPage />} />

              {/* Рабочие листы */}
              <Route path={R.GENERATOR}      element={<TaskSheetGenerator />} />
              <Route path={R.EGE_VARIANT}    element={<EgeVariantGenerator />} />
              <Route path={R.EGE_SCORE_CALC} element={<EgeScoreCalculator />} />
              <Route path={R.TEST}           element={<TestWorkGenerator />} />
              <Route path={R.MC_TEST}        element={<MCTestPage />} />
              <Route path={R.MC_TEST_EDIT}   element={<MCTestPage />} />

              {/* Геймификация */}
              <Route path={R.QR}             element={<QRWorksheetGenerator />} />
              <Route path={R.PIXEL_ART}      element={<PixelArtWorksheet />} />
              <Route path={R.PIXEL_ART_TEAM} element={<TeamPixelArtWorksheet />} />
              <Route path={R.CRYPTOGRAM}     element={<CryptogramGenerator />} />
              <Route path={R.ROUTE_SHEET}    element={<RouteSheetGenerator />} />
              <Route path={R.MARATHON}       element={<MarathonGenerator />} />
              <Route path={R.CROSSWORD}     element={<CrosswordGenerator />} />

              {/* Работы */}
              <Route path={R.WORKS}       element={<WorksPage />} />
              <Route path={R.WORK_EDITOR} element={<WorkEditorRoute />} />

              {/* Ученики */}
              <Route path={R.STUDENTS}         element={<StudentsPage />} />
              <Route path={R.STUDENTS_HEATMAP} element={<ErrorHeatmap />} />
              <Route path={R.ACHIEVEMENTS}     element={<AchievementManager />} />
              <Route path={R.STUDENT_DETAIL}   element={<StudentDetailRoute />} />

              {/* Импорт */}
              <Route path={R.IMPORT} element={<TaskImporter />} />

              {/* Геометрия */}
              <Route path={R.GEOMETRY_TASKS}   element={<GeometryTaskList />} />
              <Route path={R.GEOMETRY_TOPICS}  element={<GeometryTopicManager />} />

              {/* ТДФ */}
              <Route path={R.TDF}          element={<TDFPage />} />
              <Route path={R.TDF_EDITOR}   element={<TDFEditorRoute />} />
              <Route path={R.TDF_VARIANTS} element={<TDFVariantsRoute />} />
              <Route path={R.TDF_FLASHCARDS} element={<TDFFlashcardsRoute />} />
              <Route path={R.FORMULA_SHEET}  element={<FormulaSheetGenerator />} />

              {/* Тригонометрия */}
              <Route path={R.TRIG_MIXED}         element={<TrigMixedGenerator />} />
              <Route path={R.UNIT_CIRCLE}        element={<UnitCircleGenerator />} />
              <Route path={R.TRIG_VALUES}        element={<TrigValuesGenerator />} />
              <Route path={R.TRIG_EXPRESSIONS}   element={<TrigExpressionsGenerator />} />
              <Route path={R.INVERSE_TRIG}       element={<InverseTrigGenerator />} />
              <Route path={R.TRIG_EQUATIONS}     element={<TrigEquationsGenerator />} />
              <Route path={R.TRIG_EQUATIONS_ADV} element={<TrigEquationsAdvancedGenerator />} />
              <Route path={R.REDUCTION}          element={<ReductionFormulasGenerator />} />
              <Route path={R.ADDITION}           element={<AdditionFormulasGenerator />} />
              <Route path={R.DOUBLE_ANGLE}       element={<DoubleAngleGenerator />} />
              <Route path={R.TRIG_CRYPTOGRAM}    element={<UnitCircleCryptogramGenerator />} />

              {/* Арифметика */}
              <Route path={R.ORAL_COUNTING} element={<OralCountingGenerator />} />
              <Route path={R.LOG_EXP_EQUATIONS} element={<LogExpEquationsGenerator />} />
              <Route path={R.POWERS_ROOTS} element={<OralPowersRootsGenerator />} />
              <Route path={R.LOGARITHMS} element={<OralLogarithmsGenerator />} />
              <Route path={R.EGE_BASE_ORAL} element={<OralEgeBaseGenerator />} />

              {/* Теория */}
              <Route path={R.THEORY}            element={<TheoryPage />} />
              <Route path={R.THEORY_NEW}        element={<TheoryEditorRoute />} />
              <Route path={R.THEORY_EDIT}       element={<TheoryEditorRoute />} />
              <Route path={R.THEORY_VIEW}       element={<TheoryArticleRoute />} />
              <Route path={R.THEORY_PRINT}      element={<TheoryPrintRoute />} />
              <Route path={R.THEORY_CATEGORIES} element={<TheoryCategoryManager />} />

              {/* Лаборатория */}
              <Route path={R.EXCALIDRAW} element={
                <Suspense fallback={<LazyFallback />}>
                  <ExcalidrawSection />
                </Suspense>
              } />
            </Route>

            {/* Fallback: любой /app/* который не совпал → задачи */}
            <Route path="/app/*" element={<Navigate to={R.TASKS} replace />} />
          </Routes>
        </ReferenceDataProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
