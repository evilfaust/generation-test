import React from 'react';
import { Button, Result } from 'antd';
import { reportError } from '../shared/reportError';

// Сравнение массивов resetKeys поверхностно (по ссылкам элементов).
function shallowEqualArrays(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((v, i) => Object.is(v, b[i]));
}

/**
 * Граница ошибок. Ловит ошибку рендера в своём поддереве и показывает
 * дружелюбный фолбэк вместо белого экрана на всё приложение — одна битая
 * формула/задача/чертёж больше не роняет весь интерфейс.
 *
 * props:
 *  - children                              — защищаемое поддерево
 *  - source?:   string                     — метка для логов
 *  - resetKeys?: any[]                      — при изменении сбрасывает ошибку
 *                                            (напр. смена роута → страница оживает)
 *  - fallback?: (error, reset) => ReactNode — кастомный фолбэк
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportError(error, {
      source: this.props.source || 'ErrorBoundary',
      componentStack: info?.componentStack,
    });
  }

  componentDidUpdate(prevProps) {
    // Пользователь ушёл на другой роут (или сменились resetKeys) — гасим ошибку,
    // чтобы новый экран отрисовался, а не оставался в состоянии фолбэка.
    if (this.state.error && !shallowEqualArrays(prevProps.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <Result
          status="error"
          title="Что-то пошло не так"
          subTitle="Произошла ошибка на этой странице. Остальное приложение работает — можно перейти в другой раздел или обновить страницу."
          extra={[
            <Button type="primary" key="retry" onClick={this.reset}>
              Попробовать снова
            </Button>,
            <Button key="reload" onClick={() => window.location.reload()}>
              Обновить страницу
            </Button>,
          ]}
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
