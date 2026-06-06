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
  PercentageOutlined,
} from '@ant-design/icons';
// ── Ленивая загрузка страниц-компонентов ────────────────────────────────────
// Все компоненты ниже используются ТОЛЬКО как элементы маршрутов (через page-
// wrapper'ы или напрямую в <Route element>). Грузим их по требованию, чтобы не
// раздувать главный бандл. Граница Suspense — вокруг <Outlet/> в AppLayout.
// Шелл-компоненты (LoginPage, ProtectedRoute, UserMenu, контексты) остаются
// статическими импортами — они нужны на каждом экране.
const TaskList = lazy(() => import('./components/TaskList'));
const TaskSheetGenerator = lazy(() => import('./components/OralWorksheetGenerator'));
const TestWorkGenerator = lazy(() => import('./components/TestWorkGenerator'));
const EgeVariantGenerator = lazy(() => import('./components/EgeVariantGenerator'));
const EgeProfileVariantGenerator = lazy(() => import('./components/EgeProfileVariantGenerator'));
const OgeVariantGenerator = lazy(() => import('./components/OgeVariantGenerator'));
const TaskStatsDashboard = lazy(() => import('./components/TaskStatsDashboard'));
const TaskCatalogManager = lazy(() => import('./components/TaskCatalogManager'));
const TheoryBrowser = lazy(() => import('./components/TheoryBrowser'));
const TheoryEditor = lazy(() => import('./components/TheoryEditor'));
const ExcalidrawSection = lazy(() => import('./components/ExcalidrawSection'));
const TheoryArticleView = lazy(() => import('./components/TheoryArticleView'));
const TheoryCategoryManager = lazy(() => import('./components/TheoryCategoryManager'));
const TheoryPrintBuilder = lazy(() => import('./components/TheoryPrintBuilder'));
const TaskImporter = lazy(() => import('./components/TaskImporter'));
const WorkManager = lazy(() => import('./components/WorkManager'));
const WorkEditorPage = lazy(() => import('./components/WorkEditorPage'));
const StudentProgressDashboard = lazy(() => import('./components/StudentProgressDashboard'));
const StudentDetailPage = lazy(() => import('./components/StudentDetailPage'));
const AchievementManager = lazy(() => import('./components/AchievementManager'));
const GeometryTaskList = lazy(() => import('./components/GeometryTaskList'));
const GeometryTopicManager = lazy(() => import('./components/geometry/GeometryTopicManager'));
const TDFManager = lazy(() => import('./components/tdf/TDFManager'));
const TDFEditor = lazy(() => import('./components/tdf/TDFEditor'));
const TDFVariantBuilder = lazy(() => import('./components/tdf/TDFVariantBuilder'));
const TDFFlashcards = lazy(() => import('./components/tdf/TDFFlashcards'));
const FormulaSheetGenerator = lazy(() => import('./components/FormulaSheetGenerator'));
const QRWorksheetGenerator = lazy(() => import('./components/QRWorksheetGenerator'));
const PixelArtWorksheet = lazy(() => import('./components/PixelArtWorksheet'));
const TeamPixelArtWorksheet = lazy(() => import('./components/TeamPixelArtWorksheet'));
const RouteSheetGenerator = lazy(() => import('./components/RouteSheetGenerator'));
const ErrorHeatmap = lazy(() => import('./components/ErrorHeatmap'));
const UnitCircleGenerator = lazy(() => import('./components/UnitCircleGenerator'));
const UnitCircleCryptogramGenerator = lazy(() => import('./components/UnitCircleCryptogramGenerator'));
const CryptogramGenerator = lazy(() => import('./components/CryptogramGenerator'));
const TrigValuesGenerator = lazy(() => import('./components/TrigValuesGenerator'));
const TrigExpressionsGenerator = lazy(() => import('./components/TrigExpressionsGenerator'));
const InverseTrigGenerator = lazy(() => import('./components/InverseTrigGenerator'));
const TrigEquationsGenerator = lazy(() => import('./components/TrigEquationsGenerator'));
const TrigEquationsAdvancedGenerator = lazy(() => import('./components/TrigEquationsAdvancedGenerator'));
const ReductionFormulasGenerator = lazy(() => import('./components/ReductionFormulasGenerator'));
const AdditionFormulasGenerator = lazy(() => import('./components/AdditionFormulasGenerator'));
const TrigMixedGenerator = lazy(() => import('./components/TrigMixedGenerator'));
const DoubleAngleGenerator = lazy(() => import('./components/DoubleAngleGenerator'));
const OralCountingGenerator = lazy(() => import('./components/OralCountingGenerator'));
const LogExpEquationsGenerator = lazy(() => import('./components/LogExpEquationsGenerator'));
const OralPowersRootsGenerator = lazy(() => import('./components/OralPowersRootsGenerator'));
const OralLogarithmsGenerator = lazy(() => import('./components/OralLogarithmsGenerator'));
const OralEgeBaseGenerator = lazy(() => import('./components/OralEgeBaseGenerator'));
const OralFractionsGenerator = lazy(() => import('./components/OralFractionsGenerator'));
const OralMixedGenerator = lazy(() => import('./components/OralMixedGenerator'));
const MarathonGenerator = lazy(() => import('./components/MarathonGenerator'));
const CrosswordGenerator = lazy(() => import('./components/CrosswordGenerator'));
const EgeScoreCalculator = lazy(() => import('./components/EgeScoreCalculator'));
const MCTestGenerator = lazy(() => import('./components/MCTestGenerator'));
import { api } from './services/pocketbase';
import { ReferenceDataProvider, useReferenceData } from './contexts/ReferenceDataContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import UserMenu from './components/auth/UserMenu';
const UserManager = lazy(() => import('./components/auth/UserManager'));
const AuditLogPage = lazy(() => import('./components/auth/AuditLogPage'));
import { useVersionSync } from './shared/version/useVersionSync';
import 'katex/dist/katex.min.css';
import './theme/tokens.css';
import './App.css';

const { Header, Content, Sider } = Layout;

// Версия приложения (впекается при сборке из package.json через vite define)
/* global __APP_VERSION__ */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';

// ── Route path constants ────────────────────────────────────────────────────
export const R = {
  TASKS:               '/app/tasks',
  STATS:               '/app/stats',
  CATALOG:             '/app/catalog',
  // Рабочие листы
  GENERATOR:           '/app/worksheets/oral',
  EGE_VARIANT:         '/app/worksheets/ege-variant',
  EGE_PROFILE_VARIANT: '/app/worksheets/ege-profile-variant',
  OGE_VARIANT:         '/app/worksheets/oge-variant',
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
  FRACTIONS_ORAL:      '/app/arith/fractions',
  ORAL_MIXED:          '/app/arith/mixed',
  // Теория
  THEORY:              '/app/theory',
  THEORY_NEW:          '/app/theory/articles/new',
  THEORY_VIEW:         '/app/theory/articles/:articleId',
  THEORY_EDIT:         '/app/theory/articles/:articleId/edit',
  THEORY_PRINT:        '/app/theory/print',
  THEORY_CATEGORIES:   '/app/theory/categories',
  // Лаборатория
  EXCALIDRAW:          '/app/lab/excalidraw',
  // Администрирование
  ADMIN_USERS:         '/app/admin/users',
  ADMIN_AUDIT:         '/app/admin/audit',
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
  { re: /^\/app\/worksheets\/ege-profile-variant/, menuKey: 'ege-profile-variant', menuGroup: 'worksheets-group', title: 'Варианты ЕГЭ (профильный уровень)' },
  { re: /^\/app\/worksheets\/oge-variant/, menuKey: 'oge-variant',       menuGroup: 'worksheets-group', title: 'Варианты ОГЭ (9 класс)' },
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
  { re: /^\/app\/arith\/ege-base/,        menuKey: 'ege-base-oral',    menuGroup: 'arith', title: 'Устный счёт — Действия с десятичными' },
  { re: /^\/app\/arith\/fractions/,       menuKey: 'fractions-oral',   menuGroup: 'arith', title: 'Устный счёт — Действия с обыкновенными дробями' },
  { re: /^\/app\/arith\/mixed/,           menuKey: 'oral-mixed',       menuGroup: 'arith', title: 'Устный счёт — Смешанная работа' },
  { re: /^\/app\/theory\/print/,           menuKey: 'theory-print',     menuGroup: 'theory', title: 'Теория — Конспекты', noMargin: true },
  { re: /^\/app\/theory\/categories/,      menuKey: 'theory-categories', menuGroup: 'theory', title: 'Теория — Категории' },
  { re: /^\/app\/theory$/,                 menuKey: 'theory-browser',   menuGroup: 'theory', title: 'Теория — Библиотека' },
  { re: /^\/app\/lab\/excalidraw/,         menuKey: 'excalidraw',       menuGroup: 'lab', title: 'Excalidraw', noMargin: true },
  { re: /^\/app\/admin\/users/,            menuKey: 'admin-users',      menuGroup: 'admin-group', title: 'Управление пользователями' },
  { re: /^\/app\/admin\/audit/,            menuKey: 'admin-audit',      menuGroup: 'admin-group', title: 'Журнал действий' },
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
  'ege-profile-variant':    R.EGE_PROFILE_VARIANT,
  'oge-variant':            R.OGE_VARIANT,
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
  'fractions-oral':         R.FRACTIONS_ORAL,
  'oral-mixed':             R.ORAL_MIXED,
  'theory-browser':         R.THEORY,
  'theory-editor':          R.THEORY_NEW,
  'theory-print':           R.THEORY_PRINT,
  'theory-categories':      R.THEORY_CATEGORIES,
  excalidraw:               R.EXCALIDRAW,
  'admin-users':            R.ADMIN_USERS,
  'admin-audit':            R.ADMIN_AUDIT,
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
  'admin-group':        { label: 'Администрирование' },
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
      onOpenWork={(workId) => navigate(route(R.WORK_EDITOR, { workId }))}
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

  const { hasSection, canEdit } = useAuth();

  // Полный список пунктов меню с маркировкой секции.
  // section: ключ из ALL_SECTIONS (см. contexts/AuthContext). Если пользователь
  // не имеет доступа к этой секции — пункт скрывается из меню.
  const allMenuItems = [
    { key: 'tasks',  icon: <FileTextOutlined />,  label: 'Все задачи', section: 'tasks' },
    { key: 'stats',  icon: <PieChartOutlined />,   label: 'Аналитика',  section: 'tasks' },
    {
      key: 'worksheets-group', icon: <AppstoreOutlined />, label: 'Рабочие листы', section: 'worksheets',
      children: [
        { key: 'generator',       icon: <FileSearchOutlined />, label: 'Генератор' },
        { key: 'ege-variant',     icon: <FileAddOutlined />,    label: 'Варианты ЕГЭ (база)' },
        { key: 'ege-profile-variant', icon: <FileAddOutlined />, label: 'Варианты ЕГЭ (профиль)' },
        { key: 'oge-variant',     icon: <FileAddOutlined />,    label: 'Варианты ОГЭ (9 класс)' },
        { key: 'ege-score-calc',  icon: <BarChartOutlined />,   label: 'Калькулятор баллов' },
        { key: 'test-generator',  icon: <SnippetsOutlined />,   label: 'Контрольные работы' },
        { key: 'mc-test',         icon: <FormOutlined />,       label: 'Тесты с выбором' },
      ],
    },
    {
      key: 'gamification-group', icon: <BulbOutlined />, label: 'Геймификация', section: 'gamification',
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
    { key: 'work-manager', icon: <SolutionOutlined />, label: 'Мои работы', section: 'works' },
    { key: 'work-editor',  icon: <EditOutlined />,     label: 'Редактор работ', section: 'works', editOnly: true },
    {
      key: 'students-group', icon: <TeamOutlined />, label: 'Ученики', section: 'students',
      children: [
        { key: 'students',      icon: <BarChartOutlined />,  label: 'Прогресс' },
        { key: 'heatmap',       icon: <HeatMapOutlined />,   label: 'Тепловая карта' },
        { key: 'achievements',  icon: <TrophyOutlined />,    label: 'Достижения', editOnly: true },
      ],
    },
    { key: 'import', icon: <UploadOutlined />, label: 'Импорт задач', section: 'import', editOnly: true },
    {
      key: 'geometry', icon: <CompassOutlined />, label: 'Геометрия', section: 'geometry',
      children: [
        { key: 'geometry-tasks',   icon: <UnorderedListOutlined />, label: 'Задачи' },
        { key: 'geometry-topics',  icon: <FolderOutlined />,        label: 'Темы и подтемы', editOnly: true },
      ],
    },
    {
      key: 'tdf-group', icon: <FormOutlined />, label: 'ТДФ', section: 'tdf',
      children: [
        { key: 'tdf',           icon: <UnorderedListOutlined />, label: 'Наборы' },
        { key: 'tdf-flashcards', icon: <CreditCardOutlined />,  label: 'Карточки' },
        { key: 'formula-sheet', icon: <FunctionOutlined />,     label: 'Листы формул' },
      ],
    },
    {
      key: 'trig', icon: <RadarChartOutlined />, label: 'Тригонометрия', section: 'trig',
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
      key: 'arith', icon: <CalculatorOutlined />, label: 'Устный счёт', section: 'arith',
      children: [
        { key: 'oral-counting', icon: <CalculatorOutlined />, label: 'Арифметика' },
        { key: 'log-exp',       icon: <FunctionOutlined />,  label: 'Степени и логарифмы' },
        { key: 'powers-roots',  icon: <ExperimentOutlined />, label: 'Степени и корни' },
        { key: 'logarithms',    icon: <LineChartOutlined />,  label: 'Логарифмы' },
        { key: 'ege-base-oral', icon: <FieldNumberOutlined />, label: 'Действия с десятичными' },
        { key: 'fractions-oral', icon: <PercentageOutlined />, label: 'Действия с обыкновенными дробями' },
        { key: 'oral-mixed',     icon: <AppstoreOutlined />,   label: 'Смешанная работа' },
      ],
    },
    {
      key: 'theory', icon: <BookOutlined />, label: 'Теория', section: 'theory',
      children: [
        { key: 'theory-browser',    icon: <ReadOutlined />,    label: 'Библиотека' },
        { key: 'theory-editor',     icon: <EditOutlined />,    label: 'Редактор', editOnly: true },
        { key: 'theory-print',      icon: <SnippetsOutlined />, label: 'Конспекты' },
        { key: 'theory-categories', icon: <FolderOutlined />,  label: 'Категории', editOnly: true },
      ],
    },
    {
      key: 'lab', icon: <EditOutlined />, label: 'Лаборатория', section: 'lab',
      children: [
        { key: 'excalidraw', icon: <EditOutlined />, label: 'Excalidraw' },
      ],
    },
    {
      key: 'admin-group', icon: <KeyOutlined />, label: 'Администрирование', section: 'admin',
      children: [
        { key: 'admin-users', icon: <TeamOutlined />, label: 'Пользователи' },
        { key: 'admin-audit', icon: <FileSearchOutlined />, label: 'Журнал действий' },
      ],
    },
  ];

  // Фильтрация меню по доступным секциям + правам на редактирование.
  // editOnly: true → пункт виден только editor/superadmin (не viewer).
  // Свойства `section`/`editOnly` удаляем из объекта, чтобы они не попали
  // в DOM (Ant Design ругается на неизвестные пропсы).
  const filterMenuItem = (item) => {
    if (item.section && !hasSection(item.section)) return null;
    if (item.editOnly && !canEdit) return null;
    const { section: _s, editOnly: _e, children, ...rest } = item;
    if (children) {
      const filteredChildren = children.map(filterMenuItem).filter(Boolean);
      if (filteredChildren.length === 0) return null;
      return { ...rest, children: filteredChildren };
    }
    return rest;
  };
  const menuItems = allMenuItems.map(filterMenuItem).filter(Boolean);

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
      minHeight: 64, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '8px 16px 6px', flexShrink: 0, gap: 2,
    }}>
      <img src="/lemma-logo-new.png" alt="Lemma"
        style={{ height: 38, width: 'auto', borderRadius: 6 }} />
      {APP_VERSION && (
        <span style={{ fontSize: 10, lineHeight: 1, color: '#bfbfbf', letterSpacing: 0.2 }}>
          v{APP_VERSION}
        </span>
      )}
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
          <UserMenu compact={!isDesktop} />
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
            <Suspense fallback={<LazyFallback />}>
              <Outlet />
            </Suspense>
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
        <AuthProvider>
        <ReferenceDataProvider>
          <Routes>
            {/* Страница входа — не требует авторизации */}
            <Route path="/login" element={<LoginPage />} />

            {/* Редирект с корня */}
            <Route path="/" element={<Navigate to={R.TASKS} replace />} />
            <Route path="/app" element={<Navigate to={R.TASKS} replace />} />

            {/* Все учительские страницы — за защитой авторизации */}
            <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Задачи */}
              <Route path={R.TASKS}   element={<TasksPage />} />
              <Route path={R.STATS}   element={<StatsPage />} />
              <Route path={R.CATALOG} element={<CatalogPage />} />

              {/* Рабочие листы */}
              <Route path={R.GENERATOR}      element={<TaskSheetGenerator />} />
              <Route path={R.EGE_VARIANT}    element={<EgeVariantGenerator />} />
              <Route path={R.EGE_PROFILE_VARIANT} element={<EgeProfileVariantGenerator />} />
              <Route path={R.OGE_VARIANT}    element={<OgeVariantGenerator />} />
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

              {/* Работы — список */}
              <Route path={R.WORKS}       element={<WorksPage />} />

              {/* Ученики (viewer тоже видит) */}
              <Route path={R.STUDENTS}         element={<StudentsPage />} />
              <Route path={R.STUDENTS_HEATMAP} element={<ErrorHeatmap />} />
              <Route path={R.STUDENT_DETAIL}   element={<StudentDetailRoute />} />

              {/* Геометрия — список (viewer тоже видит) */}
              <Route path={R.GEOMETRY_TASKS}   element={<GeometryTaskList />} />

              {/* ТДФ — viewer тоже видит */}
              <Route path={R.TDF}          element={<TDFPage />} />
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
              <Route path={R.FRACTIONS_ORAL} element={<OralFractionsGenerator />} />
              <Route path={R.ORAL_MIXED} element={<OralMixedGenerator />} />

              {/* Теория — просмотр (viewer тоже) */}
              <Route path={R.THEORY}            element={<TheoryPage />} />
              <Route path={R.THEORY_VIEW}       element={<TheoryArticleRoute />} />
              <Route path={R.THEORY_PRINT}      element={<TheoryPrintRoute />} />

              {/* Лаборатория */}
              <Route path={R.EXCALIDRAW} element={
                <Suspense fallback={<LazyFallback />}>
                  <ExcalidrawSection />
                </Suspense>
              } />
            </Route>
            </Route>

            {/* Маршруты ТОЛЬКО для editor/superadmin — viewer редиректится на /app/tasks */}
            <Route element={<ProtectedRoute requireEdit />}>
              <Route element={<AppLayout />}>
                <Route path={R.WORK_EDITOR}      element={<WorkEditorRoute />} />
                <Route path={R.IMPORT}           element={<TaskImporter />} />
                <Route path={R.ACHIEVEMENTS}     element={<AchievementManager />} />
                <Route path={R.GEOMETRY_TOPICS}  element={<GeometryTopicManager />} />
                <Route path={R.TDF_EDITOR}       element={<TDFEditorRoute />} />
                <Route path={R.TDF_VARIANTS}     element={<TDFVariantsRoute />} />
                <Route path={R.THEORY_NEW}       element={<TheoryEditorRoute />} />
                <Route path={R.THEORY_EDIT}      element={<TheoryEditorRoute />} />
                <Route path={R.THEORY_CATEGORIES} element={<TheoryCategoryManager />} />
              </Route>
            </Route>

            {/* Администрирование — только superadmin */}
            <Route element={<ProtectedRoute requireSuperAdmin />}>
              <Route element={<AppLayout />}>
                <Route path={R.ADMIN_USERS} element={<UserManager />} />
                <Route path={R.ADMIN_AUDIT} element={<AuditLogPage />} />
              </Route>
            </Route>

            {/* Fallback: любой /app/* который не совпал → задачи (тоже под защитой) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/app/*" element={<Navigate to={R.TASKS} replace />} />
            </Route>
          </Routes>
        </ReferenceDataProvider>
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
