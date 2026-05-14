import { useState, useMemo, useEffect } from 'react';
import { ConfigProvider, Button, notification, theme } from 'antd';
import { ArrowLeftOutlined, TrophyOutlined, LogoutOutlined, QrcodeOutlined, LinkOutlined, BarChartOutlined, SunOutlined, MoonOutlined, LoginOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons';
import { useStudentSession } from './hooks/useStudentSession';
import StudentAuthPage from './components/student/StudentAuthPage';
import StudentEntryPage from './components/student/StudentEntryPage';
import StudentTestPage from './components/student/StudentTestPage';
import StudentMCTestPage from './components/student/StudentMCTestPage';
import StudentResultPage from './components/student/StudentResultPage';
import AchievementGallery from './components/student/AchievementGallery';
import StudentProgressPage from './components/student/StudentProgressPage';
import { api } from './services/pocketbase';
import { useVersionSync } from './shared/version/useVersionSync';
import MarathonLiveBoard from './components/marathon/MarathonLiveBoard';
import 'katex/dist/katex.min.css';
import './StudentApp.css';

function StudentHomeLanding({ isDark, onToggleTheme, student, authChecked, onAuthSuccess, onLogout }) {
  const [sessionCode, setSessionCode] = useState('');
  const [homeView, setHomeView] = useState(null); // null | 'login' | 'register' | 'progress' | 'gallery'

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

  const themeToggleBtn = (
    <button
      className="student-theme-toggle"
      onClick={onToggleTheme}
      title={isDark ? 'Светлая тема' : 'Тёмная тема'}
    >
      {isDark ? <SunOutlined /> : <MoonOutlined />}
    </button>
  );

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
          <div className="student-top-bar-right">
            {themeToggleBtn}
          </div>
        </div>
        <StudentAuthPage onAuthSuccess={handleAuthSuccess} initialTab={homeView} />
      </div>
    );
  }

  // ---- Страница прогресса ----
  if (homeView === 'progress') {
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
          <div className="student-top-bar-right">
            <button
              className="student-theme-toggle student-theme-toggle--trophy"
              onClick={() => setHomeView('gallery')}
              title="Мои достижения"
            >
              <TrophyOutlined />
            </button>
            {themeToggleBtn}
            <button
              className="student-theme-toggle"
              onClick={onLogout}
              title="Выйти"
            >
              <LogoutOutlined />
            </button>
          </div>
        </div>
        <StudentProgressPage studentSession={homeStudentSession} />
      </div>
    );
  }

  // ---- Страница достижений ----
  if (homeView === 'gallery') {
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
          <div className="student-top-bar-right">
            {themeToggleBtn}
            <button
              className="student-theme-toggle"
              onClick={onLogout}
              title="Выйти"
            >
              <LogoutOutlined />
            </button>
          </div>
        </div>
        <AchievementGallery studentSession={homeStudentSession} />
      </div>
    );
  }

  // ---- Главная карточка ----
  return (
    <div className={`student-home${isDark ? ' student-theme-dark' : ''}`}>
      <button
        className="student-theme-toggle student-theme-toggle--home"
        onClick={onToggleTheme}
        title={isDark ? 'Светлая тема' : 'Тёмная тема'}
      >
        {isDark ? <SunOutlined /> : <MoonOutlined />}
      </button>
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
            <div className="student-home-nav-btns">
              <Button
                className="student-home-nav-btn"
                icon={<BarChartOutlined />}
                onClick={() => setHomeView('progress')}
              >
                Мой прогресс
              </Button>
              <Button
                className="student-home-nav-btn student-home-nav-btn--trophy"
                icon={<TrophyOutlined />}
                onClick={() => setHomeView('gallery')}
              >
                Достижения
              </Button>
            </div>
            <button className="student-home-logout-btn" onClick={onLogout}>
              <LogoutOutlined /> Выйти
            </button>
          </div>
        )}
      </div>
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

  return (
    <ConfigProvider theme={antdTheme}>
      <div className={`student-app${isDark ? ' student-theme-dark' : ''}`}>
        {/* Верхняя панель навигации */}
        {student && currentView !== 'auth' && (
          <div className="student-top-bar">
            <div className="student-top-bar-left">
              {/* Кнопка "Назад" на экранах галереи и прогресса */}
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
              {/* Кнопка "Мой прогресс" */}
              {currentView !== 'progress' && currentView !== 'gallery' && (
                <button
                  className="student-theme-toggle"
                  onClick={() => setViewOverride('progress')}
                  title="Мой прогресс"
                >
                  <BarChartOutlined />
                </button>
              )}

              {/* Кнопка "Достижения" */}
              {canOpenAchievements && currentView !== 'gallery' && currentView !== 'progress' && (
                <button
                  className="student-theme-toggle student-theme-toggle--trophy"
                  onClick={() => setViewOverride('gallery')}
                  title="Мои достижения"
                >
                  <TrophyOutlined />
                </button>
              )}

              {/* Кнопка переключения темы */}
              <button
                className="student-theme-toggle"
                onClick={toggleTheme}
                title={isDark ? 'Светлая тема' : 'Тёмная тема'}
              >
                {isDark ? <SunOutlined /> : <MoonOutlined />}
              </button>

              {/* Кнопка выхода */}
              <button
                className="student-theme-toggle"
                onClick={handleLogout}
                title="Выйти"
              >
                <LogoutOutlined />
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
      </div>
    </ConfigProvider>
  );
}

export default StudentApp;
