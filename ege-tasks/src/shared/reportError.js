// Единая точка учёта ошибок приложения. Сейчас — только консоль; это намеренный
// хук-поинт: когда появится мониторинг (Sentry/бэкенд, см. анализ «Горизонт 2»),
// достаточно дописать отправку здесь, и её подхватят все ErrorBoundary и
// глобальные обработчики разом.

export function reportError(error, context = {}) {
  try {
    console.error('[app-error]', context.source || 'unknown', error, context);
    // TODO(monitoring): отправлять в Sentry/бэкенд, когда появится мониторинг.
  } catch {
    // Отчёт об ошибке сам никогда не должен бросать исключение.
  }
}

// Глобальные обработчики ловят то, что не поймал ни один ErrorBoundary:
// ошибки вне React-рендера (в обработчиках событий, таймерах) и «повисшие»
// отклонённые промисы. Идемпотентно — повторный вызов ничего не делает.
let installed = false;

export function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (e) => {
    reportError(e.error || e.message, { source: 'window.onerror', kind: 'error' });
  });

  window.addEventListener('unhandledrejection', (e) => {
    reportError(e.reason, { source: 'unhandledrejection', kind: 'promise' });
  });
}
