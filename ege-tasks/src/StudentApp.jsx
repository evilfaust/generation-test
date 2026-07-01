import { useState, useMemo, useEffect } from 'react';
import { ConfigProvider, Button, notification, theme } from 'antd';
import { ArrowLeftOutlined, TrophyOutlined, LogoutOutlined, QrcodeOutlined, LinkOutlined, BarChartOutlined, CalendarOutlined, HomeOutlined, SunOutlined, MoonOutlined, LoginOutlined, UserAddOutlined, UserOutlined, ReadOutlined } from '@ant-design/icons';

// Нижнее меню кабинета ученика (показывается залогиненному на всех экранах, кроме теста).
// go(key) — навигация: в кабинете меняет homeView, на странице сессии ведёт на /student/.
function StudentBottomNav({ active, go, onLogout }) {
  const Item = ({ k, icon, label, onClick }) => (
    <button
      type="button"
      className={`student-bnav-item${active === k ? ' is-active' : ''}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <nav className="student-bnav">
      <Item k="home" icon={<HomeOutlined />} label="Главная" onClick={() => go('home')} />
      <Item k="courses" icon={<ReadOutlined />} label="Курсы" onClick={() => go('courses')} />
      <Item k="program" icon={<CalendarOutlined />} label="Задание" onClick={() => go('program')} />
      <Item k="progress" icon={<BarChartOutlined />} label="Прогресс" onClick={() => go('progress')} />
      <Item k="gallery" icon={<TrophyOutlined />} label="Достижения" onClick={() => go('gallery')} />
      <Item k="logout" icon={<LogoutOutlined />} label="Выйти" onClick={onLogout} />
    </nav>
  );
}

// Кнопка смены темы в правом верхнем углу (на всех экранах ученика).
function ThemeCornerBtn({ isDark, onToggle }) {
  return (
    <button
      type="button"
      className="student-theme-toggle student-theme-corner"
      onClick={onToggle}
      title={isDark ? 'Светлая тема' : 'Тёмная тема'}
    >
      {isDark ? <SunOutlined /> : <MoonOutlined />}
    </button>
  );
}
import { useStudentSession } from './hooks/useStudentSession';
import StudentAuthPage from './components/student/StudentAuthPage';
import StudentEntryPage from './components/student/StudentEntryPage';
import StudentTestPage from './components/student/StudentTestPage';
import StudentMCTestPage from './components/student/StudentMCTestPage';
import StudentResultPage from './components/student/StudentResultPage';
import AchievementGallery from './components/student/AchievementGallery';
import StudentProgressPage from './components/student/StudentProgressPage';
import StudentSummerProgram from './components/student/StudentSummerProgram';
import StudentCoursePortal from './components/student/StudentCoursePortal';
import { api } from './services/pocketbase';
import { useVersionSync } from './shared/version/useVersionSync';
import MarathonLiveBoard from './components/marathon/MarathonLiveBoard';
import 'katex/dist/katex.min.css';
import './StudentApp.css';

function StudentHomeLanding({ isDark, onToggleTheme, student, authChecked, onAuthSuccess, onLogout }) {
  const [sessionCode, setSessionCode] = useState('');
  const [homeView, setHomeView] = useState(() => {
    const v = new URLSearchParams(window.location.search).get('v');
    return ['program', 'progress', 'gallery', 'courses'].includes(v) ? v : null;
  });

  // Минимальный псевдо-session для страниц прогресса/галереи
  const homeStudentSession = useMemo(() => ({ student, attempt: null, session: null }), [student]);

  const openSession = () => {
    const code = sessionCode.trim();
    if (!code) return;
    window.location.href = `/student/${encodeURIComponent(code)}`;
  };

  const handleAuthSuccess = (s) => {
    onAuthSuccess(s);
    setHomeView(null);
  };

  const go = (k) => setHomeView(k === 'home' ? null : k);
  const navBar = <StudentBottomNav active={homeView || 'home'} go={go} onLogout={onLogout} />;
  const themeCorner = <ThemeCornerBtn isDark={isDark} onToggle={onToggleTheme} />;

  // ---- Страница авторизации ----
  if (homeView === 'login' || homeView === 'register') {
    return (
      <div className={`student-app${isDark ? ' student-theme-dark' : ''}`}>
        <div className="student-top-bar">
          <div className="student-top-bar-left">
            <button
              className="student-theme-toggle student-top-bar-back"
              onClick={() => setHomeView(null)}
              title="Назад"
            >
              <ArrowLeftOutlined />
              <span className="student-top-bar-back-label">Назад</span>
            </button>
          </div>
          <div className="student-top-bar-right">{themeCorner}</div>
        </div>
        <StudentAuthPage onAuthSuccess={handleAuthSuccess} initialTab={homeView} />
      </div>
    );
  }

  // ---- Кабинет курса ----
  if (homeView === 'courses') {
    return (
      <div className={`student-app student-has-bnav${isDark ? ' student-theme-dark' : ''}`}>
        {themeCorner}
        <StudentCoursePortal student={student} />
        {navBar}
      </div>
    );
  }

  // ---- Каникулярное задание ----
  if (homeView === 'program') {
    return (
      <div className={`student-app student-has-bnav${isDark ? ' student-theme-dark' : ''}`}>
        {themeCorner}
        <StudentSummerProgram student={student} />
        {navBar}
      </div>
    );
  }

  // ---- Страница прогресса ----
  if (homeView === 'progress') {
    return (
      <div className={`student-app student-has-bnav${isDark ? ' student-theme-dark' : ''}`}>
        {themeCorner}
        <StudentProgressPage studentSession={homeStudentSession} />
        {navBar}
      </div>
    );
  }

  // ---- Страница достижений ----
  if (homeView === 'gallery') {
    return (
      <div className={`student-app student-has-bnav${isDark ? ' student-theme-dark' : ''}`}>
        {themeCorner}
        <AchievementGallery studentSession={homeStudentSession} />
        {navBar}
      </div>
    );
  }

  // ---- Главная карточка / личный кабинет ----
  return (
    <div className={`student-home${student ? ' student-has-bnav' : ''}${isDark ? ' student-theme-dark' : ''}`}>
      {themeCorner}
      <div className="student-home-card">

        {/* Логотип Леммы */}
        <div className="student-home-logo">
          <img src="/lemma-logo-new.png" alt="Лемма" />
        </div>

        <div className="student-home-icon">
          <QrcodeOutlined />
        </div>
        <h1 className="student-home-title">Тесты по математике</h1>
        <p className="student-home-subtitle">
          Отсканируйте QR-код с доски или введите код сессии, который дал учитель.
        </p>

        <div className="student-home-input-wrap">
          <input
            type="text"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value)}
            placeholder="Например: fyiezxczetf40ul"
            className="student-home-input"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter') openSession();
            }}
          />
          <Button
            type="primary"
            className="student-home-btn"
            icon={<LinkOutlined />}
            onClick={openSession}
            disabled={!sessionCode.trim()}
          >
            Открыть тест
          </Button>
        </div>

        <div className="student-home-hint">
          На телефоне удобнее заходить по QR-коду.
        </div>

        {/* Личный кабинет — не авторизован */}
        {authChecked && !student && (
          <div className="student-home-account-section">
            <div className="student-home-section-divider">
              <span>личный кабинет</span>
            </div>
            <div className="student-home-auth-btns">
              <Button
                className="student-home-auth-btn"
                icon={<LoginOutlined />}
                onClick={() => setHomeView('login')}
              >
                Войти
              </Button>
              <Button
                className="student-home-auth-btn"
                icon={<UserAddOutlined />}
                onClick={() => setHomeView('register')}
              >
                Регистрация
              </Button>
            </div>
          </div>
        )}

        {/* Личный кабинет — авторизован */}
        {student && (
          <div className="student-home-account-section">
            <div className="student-home-section-divider">
              <span>личный кабинет</span>
            </div>
            <div className="student-home-user-greeting">
              <UserOutlined />
              <span>{student.name}</span>
            </div>
            <Button
              block
              className="student-home-nav-btn"
              icon={<ReadOutlined />}
              onClick={() => setHomeView('courses')}
              style={{ marginBottom: 8 }}
            >
              Мои курсы
            </Button>
            <Button
              block
              className="student-home-nav-btn"
              icon={<CalendarOutlined />}
              onClick={() => setHomeView('program')}
            >
              Открыть каникулярное задание
            </Button>
          </div>
        )}
      </div>
      {student && navBar}
    </div>
  );
}

function StudentApp() {
  // Detect marathon-live route: /student/marathon-live/{marathonId}
  const marathonLiveMatch = useMemo(
    () => window.location.pathname.match(/\/student\/marathon-live\/([^/]+)/),
    []
  );

  const generateDeviceId = () => {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }

    if (globalThis.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      // RFC 4122 variant and version 4
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
      return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
    }

    return `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  // Извлекаем sessionId из URL: /student/{sessionId}
  // marathon-live — специальный маршрут, не является sessionId
  const sessionId = useMemo(() => {
    if (marathonLiveMatch) return '';
    const parts = window.location.pathname.split('/student/');
    return parts[1]?.split('/')[0] || '';
  }, [marathonLiveMatch]);

  // device_id: генерируем или берём из localStorage
  const [deviceId] = useState(() => {
    let id = localStorage.getItem('ege_device_id');
    if (!id) {
      id = generateDeviceId();
      localStorage.setItem('ege_device_id', id);
    }
    return id;
  });

  const [student, setStudent] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Тема: светлая / тёмная
  const [isDark, setIsDark] = useState(() => localStorage.getItem('student-theme') === 'dark');
  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('student-theme', next ? 'dark' : 'light');
      return next;
    });
  };

  useVersionSync();

  // Проверить авторизацию при загрузке
  useEffect(() => {
    if (api.isStudentAuthenticated()) {
      setStudent(api.getAuthStudent());
    }
    setAuthChecked(true);
  }, []);

  const studentSession = useStudentSession(sessionId, deviceId, student?.id || null);
  const { attempt, session } = studentSession;
  const [viewOverride, setViewOverride] = useState(null); // Для ручной смены экрана (например, галерея)
  const canOpenAchievements = !!attempt;

  const handleAuthSuccess = (authStudent) => {
    setStudent(authStudent);
  };

  const handleLogout = () => {
    api.logoutStudent();
    setStudent(null);
    window.location.reload(); // Перезагрузить для сброса состояния
  };

  // Определяем текущий экран на основе состояния attempt
  const currentView = useMemo(() => {
    if (!authChecked) return 'loading';
    if (!student) return 'auth';
    if (viewOverride) return viewOverride;
    if (!attempt) return 'entry';
    if (attempt.status === 'started') return 'test';
    return 'result'; // submitted или corrected
  }, [authChecked, student, attempt, viewOverride]);

  if (marathonLiveMatch) {
    return <MarathonLiveBoard marathonId={marathonLiveMatch[1]} />;
  }

  if (currentView === 'loading') {
    return null; // Или спиннер
  }

  const antdTheme = {
    token: { colorPrimary: '#4361ee', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' },
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
  };

  if (!sessionId) {
    return (
      <ConfigProvider theme={antdTheme}>
        <StudentHomeLanding
          isDark={isDark}
          onToggleTheme={toggleTheme}
          student={student}
          authChecked={authChecked}
          onAuthSuccess={handleAuthSuccess}
          onLogout={handleLogout}
        />
      </ConfigProvider>
    );
  }

  const showSessionNav = !!student && !['test', 'auth'].includes(currentView);
  const sessionNavActive = currentView === 'progress' ? 'progress' : currentView === 'gallery' ? 'gallery' : null;
  const goCabinet = (k) => {
    const map = { home: '/student/', program: '/student/?v=program', progress: '/student/?v=progress', gallery: '/student/?v=gallery' };
    window.location.href = map[k] || '/student/';
  };

  return (
    <ConfigProvider theme={antdTheme}>
      <div className={`student-app${showSessionNav ? ' student-has-bnav' : ''}${isDark ? ' student-theme-dark' : ''}`}>
        {/* Верхняя панель: «Назад» (для прогресса/галереи) + тема в углу */}
        {currentView !== 'auth' && (
          <div className="student-top-bar">
            <div className="student-top-bar-left">
              {(currentView === 'gallery' || currentView === 'progress') && (
                <button
                  className="student-theme-toggle student-top-bar-back"
                  onClick={() => setViewOverride(null)}
                  title="Назад"
                >
                  <ArrowLeftOutlined />
                  <span className="student-top-bar-back-label">Назад</span>
                </button>
              )}
            </div>
            <div className="student-top-bar-right">
              <button
                className="student-theme-toggle"
                onClick={toggleTheme}
                title={isDark ? 'Светлая тема' : 'Тёмная тема'}
              >
                {isDark ? <SunOutlined /> : <MoonOutlined />}
              </button>
            </div>
          </div>
        )}

        {currentView === 'auth' && (
          <StudentAuthPage
            onAuthSuccess={handleAuthSuccess}
            sessionTitle={session?.student_title}
          />
        )}

        {currentView === 'entry' && (
          <StudentEntryPage
            sessionId={sessionId}
            deviceId={deviceId}
            studentSession={studentSession}
          />
        )}

        {currentView === 'test' && (
          session?.mc_test
            ? <StudentMCTestPage studentSession={studentSession} />
            : <StudentTestPage studentSession={studentSession} />
        )}

        {currentView === 'result' && (
          <StudentResultPage
            studentSession={studentSession}
            sessionId={sessionId}
            deviceId={deviceId}
            onNavigateToGallery={() => setViewOverride('gallery')}
          />
        )}

        {currentView === 'gallery' && (
          <AchievementGallery
            studentSession={studentSession}
          />
        )}

        {currentView === 'progress' && (
          <StudentProgressPage
            studentSession={studentSession}
          />
        )}

        {showSessionNav && (
          <StudentBottomNav active={sessionNavActive} go={goCabinet} onLogout={handleLogout} />
        )}
      </div>
    </ConfigProvider>
  );
}

export default StudentApp;
