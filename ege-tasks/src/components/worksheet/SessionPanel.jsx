import { useState, useEffect, useCallback, useRef } from 'react';
import { Switch, Input, Button, Typography, Spin, Alert, Divider, Modal, App, Tag, Tooltip } from 'antd';
import {
  CopyOutlined,
  QrcodeOutlined,
  DownloadOutlined,
  LinkOutlined,
  FullscreenOutlined,
  CheckCircleOutlined,
  StopOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../services/pocketbase';
import TeacherResultsDashboard from './TeacherResultsDashboard';
import './SessionPanel.css';

const { Text, Title } = Typography;

const SessionPanel = ({ workId, mcTestId }) => {
  const { message } = App.useApp();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studentTitle, setStudentTitle] = useState('Самостоятельная работа');
  const [qrFullscreen, setQrFullscreen] = useState(false);
  const qrRef = useRef();

  // Ссылка всегда ведёт на отдельный студенческий домен
  const buildStudentUrl = useCallback((sessionId) => {
    if (!sessionId) return '';
    const studentDomain = import.meta.env.VITE_STUDENT_URL || `${window.location.origin}/student`;
    return `${studentDomain}/${sessionId}`;
  }, []);

  useEffect(() => {
    if (!workId && !mcTestId) return;
    const init = async () => {
      setLoading(true);
      try {
        let existing;
        if (mcTestId) {
          const sessions = await api.getSessionsByMCTest(mcTestId);
          existing = sessions[0] || null;
          if (!existing) {
            existing = await api.createMCTestSession(mcTestId, {
              student_title: 'Тест с выбором ответа',
            });
            setStudentTitle('Тест с выбором ответа');
          } else {
            setStudentTitle(existing.student_title || 'Тест с выбором ответа');
          }
        } else {
          existing = await api.getSessionByWork(workId);
          if (!existing) {
            existing = await api.createSession({
              work: workId,
              is_open: true,
              achievements_enabled: false,
              student_title: 'Самостоятельная работа',
            });
            setStudentTitle('Самостоятельная работа');
          } else {
            setStudentTitle(existing.student_title || 'Самостоятельная работа');
          }
        }
        setSession(existing);
      } catch (err) {
        console.error('Error loading session:', err);
        message.error('Ошибка загрузки сессии выдачи');
      }
      setLoading(false);
    };
    init();
  }, [workId, mcTestId, message]);

  const studentUrl = session ? buildStudentUrl(session.id) : '';

  const toggleOpen = async (checked) => {
    if (!session) return;
    try {
      const updated = await api.updateSession(session.id, { is_open: checked });
      setSession({ ...session, ...updated });
      message.success(checked ? 'Приём открыт' : 'Приём закрыт');
    } catch {
      message.error('Ошибка обновления сессии');
    }
  };

  const toggleAchievements = async (checked) => {
    if (!session) return;
    try {
      const updated = await api.updateSession(session.id, { achievements_enabled: checked });
      setSession({ ...session, ...updated });
      message.success(checked ? 'Достижения включены' : 'Достижения отключены');
    } catch {
      message.error('Ошибка обновления сессии');
    }
  };

  const handleStudentTitleChange = useCallback((e) => {
    setStudentTitle(e.target.value);
  }, []);

  const handleStudentTitleBlur = useCallback(async (e) => {
    const title = e.target.value;
    if (!session) return;
    try {
      await api.updateSession(session.id, { student_title: title });
    } catch {
      message.error('Ошибка сохранения заголовка');
    }
  }, [session, message]);

  const copyText = async (text) => {
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  };

  const copyLink = async () => {
    const ok = await copyText(studentUrl);
    if (ok) message.success('Ссылка скопирована');
    else message.error('Не удалось скопировать');
  };

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const link = document.createElement('a');
      link.download = 'qr-student.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>;
  }

  if (!session) {
    return <Alert type="error" message="Не удалось создать сессию выдачи" />;
  }

  return (
    <div className="session-panel">

      {/* ── Топбар: статус + переключатели ── */}
      <div className="session-panel__topbar">
        <div className="session-panel__topbar-left">
          <Tag
            icon={session.is_open ? <CheckCircleOutlined /> : <StopOutlined />}
            color={session.is_open ? 'success' : 'default'}
            style={{ margin: 0 }}
          >
            {session.is_open ? 'Приём открыт' : 'Приём закрыт'}
          </Tag>
          <Tag icon={<QrcodeOutlined />} color="blue" style={{ margin: 0, fontFamily: 'monospace' }}>
            {session.id}
          </Tag>
        </div>

        <div className="session-panel__topbar-right">
          <span className="session-panel__toggle-label">Приём:</span>
          <Switch
            size="small"
            checked={session.is_open}
            onChange={toggleOpen}
            checkedChildren="Вкл"
            unCheckedChildren="Выкл"
          />
          <span className="session-panel__toggle-label">
            <TrophyOutlined style={{ color: '#faad14' }} /> Достижения:
          </span>
          <Switch
            size="small"
            checked={session.achievements_enabled || false}
            onChange={toggleAchievements}
            checkedChildren="Вкл"
            unCheckedChildren="Выкл"
          />
        </div>
      </div>

      {/* ── Основной блок: поля + QR ── */}
      <div className="session-panel__body">

        {/* Поля */}
        <div className="session-panel__fields">
          <div className="session-panel__field-row">
            <Text type="secondary" className="session-panel__field-label">Заголовок для учеников</Text>
            <Input
              value={studentTitle}
              onChange={handleStudentTitleChange}
              onBlur={handleStudentTitleBlur}
              onPressEnter={(e) => e.target.blur()}
              placeholder="Самостоятельная работа"
            />
          </div>

          <div className="session-panel__field-row">
            <Text type="secondary" className="session-panel__field-label">Ссылка для учеников</Text>
            <Input
              value={studentUrl}
              readOnly
              prefix={<LinkOutlined style={{ color: '#bfbfbf' }} />}
              suffix={
                <Tooltip title="Копировать ссылку">
                  <CopyOutlined
                    className="session-panel__copy-icon"
                    onClick={copyLink}
                  />
                </Tooltip>
              }
              className="session-panel__url-input"
            />
          </div>
        </div>

        {/* QR + кнопки сбоку */}
        <div className="session-panel__qr-col">
          <div className="session-panel__qr-wrap" ref={qrRef}>
            <QRCodeSVG value={studentUrl || 'https://example.com'} size={150} level="M" />
          </div>
          <div className="session-panel__qr-actions">
            <Tooltip title="Копировать ссылку" placement="left">
              <Button icon={<CopyOutlined />} onClick={copyLink} className="session-panel__qr-btn" />
            </Tooltip>
            <Tooltip title="На весь экран" placement="left">
              <Button icon={<FullscreenOutlined />} onClick={() => setQrFullscreen(true)} className="session-panel__qr-btn" />
            </Tooltip>
            <Tooltip title="Скачать QR" placement="left">
              <Button icon={<DownloadOutlined />} onClick={downloadQR} className="session-panel__qr-btn" />
            </Tooltip>
          </div>
        </div>

      </div>

      {/* ── Модал: QR на весь экран ── */}
      <Modal
        open={qrFullscreen}
        onCancel={() => setQrFullscreen(false)}
        footer={null}
        width="100vw"
        centered
        closable
        styles={{
          body: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '70vh',
            padding: 40,
          },
          mask: { background: 'rgba(0,0,0,0.88)' },
        }}
        style={{ top: 0, maxWidth: '100vw', padding: 0 }}
      >
        <div style={{ background: '#fff', padding: 36, borderRadius: 24, display: 'inline-block' }}>
          <QRCodeSVG
            value={studentUrl || 'https://example.com'}
            size={Math.min(window.innerWidth * 0.55, window.innerHeight * 0.55, 560)}
            level="M"
          />
        </div>
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Title level={3} style={{ color: '#fff', marginBottom: 8 }}>{studentTitle}</Title>
          <Text
            style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, fontFamily: 'monospace', cursor: 'pointer' }}
            onClick={copyLink}
          >
            {studentUrl}
          </Text>
        </div>
        <Button type="primary" icon={<CopyOutlined />} style={{ marginTop: 16 }} onClick={copyLink}>
          Скопировать ссылку
        </Button>
      </Modal>

      {/* ── Результаты ── */}
      <Divider style={{ margin: '4px 0 0' }}>Результаты учеников</Divider>
      <TeacherResultsDashboard sessionId={session.id} />
    </div>
  );
};

export default SessionPanel;
