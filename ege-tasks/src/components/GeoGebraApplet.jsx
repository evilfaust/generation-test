import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Spin, Typography } from 'antd';

const DEPLOY_SCRIPT_URL = 'https://www.geogebra.org/apps/deployggb.js';
const DEPLOY_SCRIPT_ID = 'geogebra-deployggb-script';
const MIN_HEIGHT = 280;
const MAX_HEIGHT = 1200;
let geogebraScriptPromise = null;

function loadGeoGebraScript() {
  if (window.GGBApplet) {
    return Promise.resolve();
  }
  if (geogebraScriptPromise) {
    return geogebraScriptPromise;
  }

  geogebraScriptPromise = new Promise((resolve, reject) => {
    const done = () => {
      if (window.GGBApplet) {
        resolve();
        return;
      }
      reject(
        new Error('Не удалось инициализировать GeoGebra script.'),
      );
    };

    const existing = document.getElementById(DEPLOY_SCRIPT_ID);
    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        done();
        return;
      }
      existing.remove();
    }

    const script = document.createElement('script');
    script.id = DEPLOY_SCRIPT_ID;
    script.src = DEPLOY_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      script.setAttribute('data-loaded', 'true');
      done();
    };
    script.onerror = () =>
      reject(
        new Error(
          'Не удалось загрузить GeoGebra (проверьте доступ к geogebra.org).',
        ),
      );
    document.body.appendChild(script);
  });

  geogebraScriptPromise.catch(() => {
    geogebraScriptPromise = null;
  });

  return geogebraScriptPromise;
}

/**
 * Переиспользуемый GeoGebra-апплет с drag-to-resize.
 *
 * Props:
 *   appName       - 'geometry' | 'graphing' | 'classic' | '3d'  (default: 'geometry')
 *   readOnly      - bool  — скрывает toolbar/menu/правый клик     (default: false)
 *   initialBase64 - string — загружает состояние при монтировании (default: '')
 *   onApiReady    - (api) => void — callback с GGBApplet API      (default: null)
 *   height        - number — начальная высота апплета в px        (default: 520)
 *   width         - number — ширина в px, 0 = 100%               (default: 0)
 *   resizable     - bool  — показывать drag handle                (default: true)
 */
export default function GeoGebraApplet({
  appName = 'geometry',
  readOnly = false,
  initialBase64 = '',
  onApiReady = null,
  height = 520,
  width = 0,
  resizable = true,
}) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [currentHeight, setCurrentHeight] = useState(height);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const overlayRef = useRef(null);
  const apiRef = useRef(null);
  const isDraggingRef = useRef(false);

  const containerId = useMemo(
    () => `ggb-applet-${Math.random().toString(36).slice(2)}`,
    [],
  );

  useEffect(() => {
    let disposed = false;

    const mountApplet = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new Error('Нет подключения к интернету.');
        }

        setStatus('loading');
        setError('');

        await loadGeoGebraScript();
        if (disposed || !containerRef.current || !window.GGBApplet) return;

        const waitForVisibleWidth = () => {
          if (width) return Promise.resolve(width);
          const el = containerRef.current;
          if (el?.offsetWidth > 0) return Promise.resolve(el.offsetWidth);

          return new Promise((resolve) => {
            const observer = new ResizeObserver((entries) => {
              if (disposed) {
                observer.disconnect();
                resolve(0);
                return;
              }
              const w = entries[0]?.contentRect?.width || 0;
              if (w > 0) {
                observer.disconnect();
                resolve(w);
              }
            });
            observer.observe(el);

            setTimeout(() => {
              observer.disconnect();
              resolve(el?.offsetWidth || 0);
            }, 5000);
          });
        };

        const measuredWidth = await waitForVisibleWidth();
        if (disposed || !containerRef.current) return;

        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        const params = {
          appName,
          width: measuredWidth || containerRef.current?.offsetWidth || 1280,
          height: currentHeight,
          showToolBar: !readOnly,
          showMenuBar: !readOnly,
          showAlgebraInput: false,
          enableLabelDrags: !readOnly,
          enableShiftDragZoom: true,
          enableRightClick: !readOnly,
          appletOnLoad: (ggbApi) => {
            if (disposed) return;
            apiRef.current = ggbApi;
            setStatus('ready');

            if (initialBase64) {
              ggbApi.setBase64(initialBase64);
            }

            if (onApiReady) onApiReady(ggbApi);
          },
        };

        const applet = new window.GGBApplet(params, true);
        applet.inject(containerId);
      } catch (err) {
        if (!disposed) {
          setError(err.message || 'Ошибка инициализации GeoGebra.');
          setStatus('error');
        }
      }
    };

    mountApplet();
    return () => {
      disposed = true;
      apiRef.current = null;
    };
  }, [containerId, reloadToken, appName, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // Вызываем setSize на живом апплете при изменении высоты — чертёж не теряется
  useEffect(() => {
    const api = apiRef.current;
    if (!api || typeof api.setSize !== 'function') return;
    const w = wrapperRef.current?.offsetWidth || 800;
    api.setSize(w, currentHeight);
  }, [currentHeight]);

  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const startY = e.clientY;
    const startHeight = currentHeight;

    if (overlayRef.current) overlayRef.current.style.display = 'block';

    const onMove = (ev) => {
      if (!isDraggingRef.current) return;
      const delta = ev.clientY - startY;
      setCurrentHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + delta)));
    };

    const onUp = () => {
      isDraggingRef.current = false;
      if (overlayRef.current) overlayRef.current.style.display = 'none';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [currentHeight]);

  return (
    <div style={{ width: '100%' }}>
      {status === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: '#888' }}>
          <Spin size="small" />
          <Typography.Text type="secondary">Загрузка GeoGebra...</Typography.Text>
        </div>
      )}

      {status === 'error' && (
        <Alert
          type="error"
          showIcon
          message="Ошибка загрузки GeoGebra"
          description={error}
          style={{ marginBottom: 8 }}
          action={
            <Button size="small" onClick={() => setReloadToken((t) => t + 1)}>
              Повторить
            </Button>
          }
        />
      )}

      <div ref={wrapperRef} style={{ position: 'relative' }}>
        {/* Прозрачный оверлей — перехватывает мышь во время drag, чтобы iframe не блокировал события */}
        <div
          ref={overlayRef}
          style={{ display: 'none', position: 'absolute', inset: 0, zIndex: 10, cursor: 'ns-resize' }}
        />
        <div
          id={containerId}
          ref={containerRef}
          style={{
            width: '100%',
            minHeight: currentHeight,
            border: status === 'ready' ? '1px solid #f0f0f0' : 'none',
            borderRadius: resizable ? '8px 8px 0 0' : 8,
            overflow: 'hidden',
            display: status === 'error' ? 'none' : 'block',
          }}
        />
      </div>

      {resizable && (
        <div
          onMouseDown={handleDragStart}
          title="Потяни, чтобы изменить высоту"
          style={{
            height: 14,
            background: '#f5f5f5',
            border: '1px solid #d9d9d9',
            borderTop: 'none',
            borderRadius: '0 0 6px 6px',
            cursor: 'ns-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
          }}
        >
          <div style={{ width: 36, height: 3, background: '#ccc', borderRadius: 2 }} />
        </div>
      )}
    </div>
  );
}
