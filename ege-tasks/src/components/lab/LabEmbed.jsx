import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Space, Tooltip, Alert } from 'antd';
import {
  FullscreenOutlined, FullscreenExitOutlined, ExportOutlined, ReloadOutlined,
} from '@ant-design/icons';

/**
 * Обёртка для сторонних веб-инструментов «Лаборатории» (Grist, HedgeDoc).
 *
 * Сервисы живут на малине под своими субдоменами l.oipav.ru и встраиваются
 * через iframe. Cross-origin iframe не даёт узнать, загрузился он или нет
 * (onload срабатывает и на 401/503), поэтому вместо детекта ошибок даём
 * пользователю явный выход — «Открыть в новой вкладке».
 *
 * @param {string} title   — заголовок панели
 * @param {string} url     — адрес сервиса
 * @param {string} [hint]  — подсказка над фреймом (скрывается насовсем)
 * @param {string} [hintKey] — ключ localStorage для «больше не показывать»
 */
export default function LabEmbed({ title, url, hint, hintKey }) {
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [hintVisible, setHintVisible] = useState(() => {
    if (!hint) return false;
    try { return localStorage.getItem(`lab-hint-${hintKey}`) !== 'hidden'; } catch { return true; }
  });

  useEffect(() => {
    const handleFsChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(!!fsEl);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (fsEl) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else {
        // iPad Safari (iOS <16.4) не умеет Fullscreen API — включаем CSS-оверлей
        setIsFullscreen((v) => !v);
      }
    } catch {
      setIsFullscreen((v) => !v);
    }
  }, []);

  const handleHideHint = () => {
    setHintVisible(false);
    try { localStorage.setItem(`lab-hint-${hintKey}`, 'hidden'); } catch { /* private mode */ }
  };

  const rootStyle = isFullscreen
    ? { position: 'fixed', inset: 0, zIndex: 9999, background: '#fff', display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 12px' }
    : { display: 'flex', flexDirection: 'column', height: '100%', gap: 8, padding: '12px 16px' };

  return (
    <div ref={containerRef} style={rootStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>{title}</span>
        <Space>
          <Tooltip title="Перезагрузить">
            <Button icon={<ReloadOutlined />} onClick={() => setReloadNonce((n) => n + 1)} />
          </Tooltip>
          <Button icon={<ExportOutlined />} href={url} target="_blank" rel="noreferrer">
            В новой вкладке
          </Button>
          <Tooltip title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Во весь экран'}>
            <Button
              type={isFullscreen ? 'primary' : 'default'}
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={handleToggleFullscreen}
            >
              {isFullscreen ? 'Свернуть' : 'Во весь экран'}
            </Button>
          </Tooltip>
        </Space>
      </div>

      {hintVisible && (
        <Alert type="info" showIcon closable message={hint} onClose={handleHideHint} />
      )}

      <div style={{
        flex: 1, minHeight: 0,
        border: isFullscreen ? 'none' : '1px solid #d9d9d9',
        borderRadius: isFullscreen ? 0 : 8,
        overflow: 'hidden',
      }}>
        <iframe
          key={reloadNonce}
          ref={iframeRef}
          src={url}
          title={title}
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          allow="clipboard-write; fullscreen"
        />
      </div>
    </div>
  );
}
