import { useMemo, useRef, useState } from 'react';
import { App, Button, Card, Space, Switch, Tooltip } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, FilePdfOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import html2pdf from 'html2pdf.js';
import MathRenderer from '../../MathRenderer';
import './SummerProgramPrintView.css';

const buildStudentUrl = (sessionId) => {
  const base = import.meta.env.VITE_STUDENT_URL || `${window.location.origin}/student`;
  return `${base}/${sessionId}`;
};

// Короткий вид ссылки под QR — без схемы, чтобы не загромождать лист.
const shortUrl = (url) => String(url || '').replace(/^https?:\/\//, '');

const ACCENTS = [
  { key: 'violet', label: 'Фиолет', color: '#6d5bd6' },
  { key: 'teal', label: 'Бирюза', color: '#0e9f8e' },
  { key: 'rose', label: 'Коралл', color: '#e0567a' },
  { key: 'blue', label: 'Море', color: '#2563eb' },
  { key: 'amber', label: 'Янтарь', color: '#d9820b' },
];

/**
 * Полноэкранный предпросмотр печати «Каникулярного задания».
 *
 * Делает из плана ученика серьёзный, графически оформленный лист:
 * шапка-обложка, напутствие, памятка «как выполнять», карточки недель
 * с заданиями и QR-кодом на каждую работу (ученик сканирует → открывает тест).
 *
 * Печать — по канону проекта: scoped print `body:has(.spp-overlay)`,
 * печатается только `.spp-print-root`. PDF — клиентский html2pdf.
 */
export default function SummerProgramPrintView({
  student, group, program, weeksInfo = [], byWeek, doneSessions, extra, leftover = [], campaignBlocks = [], onClose,
}) {
  const { message } = App.useApp();
  const printRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [showQR, setShowQR] = useState(true);
  const [showLinks, setShowLinks] = useState(true);
  const [accent, setAccent] = useState('violet');

  const accentColor = ACCENTS.find((a) => a.key === accent)?.color || ACCENTS[0].color;
  const studentName = student?.name || 'Ученик';
  const intro = (program?.config?.intro || '').trim();
  const printNote = (program?.config?.printNote || '').trim();
  const year = program?.year || new Date().getFullYear();

  // Дополнительное (творческое) задание: свободный текст + ссылки + файлы.
  const ex = extra || {};
  const exLinks = (ex.links || []).filter((l) => l?.url);
  const exFiles = (ex.files || []).filter((f) => f?.url);
  const hasExtra =
    leftover.length > 0 || !!ex.text?.trim() || exLinks.length > 0 || exFiles.length > 0;

  const gradeLine = useMemo(() => {
    const parts = [];
    if (group?.name) parts.push(group.name);
    if (group?.grade) parts.push(`${group.grade} класс`);
    return parts.join(' · ');
  }, [group]);

  const period = useMemo(() => {
    if (!weeksInfo.length) return '';
    const fmt = (d) => d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
    return `${fmt(weeksInfo[0].from)} — ${fmt(weeksInfo[weeksInfo.length - 1].to)}`;
  }, [weeksInfo]);

  // Недели, в которых реально есть задания (пустые на лист не выводим).
  const filledWeeks = useMemo(
    () => weeksInfo.filter((w) => (byWeek.get(w.week) || []).length > 0),
    [weeksInfo, byWeek],
  );

  const { total, done } = useMemo(() => {
    const all = [...[...byWeek.values()].flat(), ...leftover].filter((i) => i.session);
    return { total: all.length, done: all.filter((i) => doneSessions.has(i.session)).length };
  }, [byWeek, leftover, doneSessions]);

  const weekRange = (w) => {
    const fmt = (d) => d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }).replace('.', '');
    return `${fmt(w.from)} – ${fmt(w.to)}`;
  };

  // ── Печать: симметричные поля на каждой странице через инъекцию @page ──
  const handlePrint = () => {
    const styleId = 'spp-print-page-size';
    document.getElementById(styleId)?.remove();
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = '@media print { @page { size: A4 portrait; margin: 13mm 12mm 15mm; } }';
    document.head.appendChild(style);
    const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  };

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setExporting(true);
    message.loading({ content: 'Готовим PDF…', key: 'spp-pdf', duration: 0 });
    try {
      await html2pdf().set({
        margin: [12, 11, 14, 11],
        filename: `Каникулярное задание — ${studentName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2.5, useCORS: true, logging: false, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        enableLinks: true, // кликабельные <a> в PDF — ученик тапает ссылку/QR с телефона
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.spp-week', '.spp-task', '.spp-note', '.spp-intro'] },
      }).from(printRef.current).save();
      message.success({ content: 'PDF сохранён', key: 'spp-pdf', duration: 2 });
    } catch (e) {
      console.error(e);
      message.error({ content: 'Не удалось сделать PDF', key: 'spp-pdf', duration: 2 });
    } finally {
      setExporting(false);
    }
  };

  // Строка одного задания: чекбокс + название + кликабельная ссылка + QR-ссылка.
  const renderTaskRow = (it) => {
    const url = it.session ? buildStudentUrl(it.session) : '';
    const isDone = it.session && doneSessions.has(it.session);
    return (
      <li className="spp-task" key={it.id}>
        <span className={`spp-check${isDone ? ' is-done' : ''}`}>{isDone ? '✓' : ''}</span>
        <div className="spp-task-body">
          <div className="spp-task-title">{it.title}</div>
          {url && showLinks && (
            <a className="spp-task-url" href={url} target="_blank" rel="noreferrer">{shortUrl(url)}</a>
          )}
          {!it.session && <div className="spp-task-note">офлайн-задание</div>}
        </div>
        {url && showQR && (
          <a className="spp-qr" href={url} target="_blank" rel="noreferrer" aria-label="Открыть тест">
            <QRCodeSVG value={url} size={62} level="M" marginSize={0} />
          </a>
        )}
      </li>
    );
  };

  return (
    <div className="spp-overlay" style={{ '--spp-accent': accentColor }}>
      <Card size="small" className="spp-toolbar no-print" styles={{ body: { padding: '10px 14px' } }}>
        <Space wrap align="center" style={{ width: '100%' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={onClose}>Назад</Button>
          <span style={{ fontWeight: 600 }}>Печать · Каникулярное задание</span>

          <span style={{ fontSize: 13 }}>
            <Switch size="small" checked={showQR} onChange={setShowQR} /> QR-коды
          </span>
          <span style={{ fontSize: 13 }}>
            <Switch size="small" checked={showLinks} onChange={setShowLinks} /> ссылки
          </span>

          <Space size={6}>
            <span style={{ fontSize: 13, color: '#888' }}>Цвет:</span>
            {ACCENTS.map((a) => (
              <Tooltip key={a.key} title={a.label}>
                <button
                  type="button"
                  onClick={() => setAccent(a.key)}
                  className={`spp-swatch${accent === a.key ? ' is-active' : ''}`}
                  style={{ background: a.color }}
                  aria-label={a.label}
                />
              </Tooltip>
            ))}
          </Space>

          <Space style={{ marginLeft: 'auto' }}>
            <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>
            <Button icon={<FilePdfOutlined />} loading={exporting} onClick={handleExportPDF}>Скачать PDF</Button>
          </Space>
        </Space>
      </Card>

      <div className="spp-sheet">
        <div ref={printRef} className="spp-print-root">
          {/* ── Обложка-шапка ── */}
          <header className="spp-head">
            <div className="spp-head-main">
              <div className="spp-eyebrow">Каникулярное задание · лето {year}</div>
              <h1 className="spp-name">{studentName}</h1>
              {gradeLine && <div className="spp-sub">{gradeLine}</div>}
              {period && <div className="spp-period">{period}</div>}
            </div>
            <div className="spp-head-stats">
              <div className="spp-stat">
                <div className="spp-stat-num">{filledWeeks.length}</div>
                <div className="spp-stat-label">{filledWeeks.length === 1 ? 'неделя' : 'недель'}</div>
              </div>
              <div className="spp-stat">
                <div className="spp-stat-num">{total}</div>
                <div className="spp-stat-label">{total === 1 ? 'работа' : 'работ'}</div>
              </div>
            </div>
          </header>

          {/* ── Напутствие ── */}
          {intro && (
            <section className="spp-intro">
              <div className="spp-intro-mark">“</div>
              <div className="spp-intro-text">{intro}</div>
            </section>
          )}

          {/* ── Текст учителя ── */}
          {printNote && (
            <section className="spp-note">{printNote}</section>
          )}

          {/* ── Общее задание класса (блоки кампании) ── */}
          {campaignBlocks.map((b) => (
            <section key={b.id} className="spp-week">
              <div className="spp-week-head">
                <div className="spp-week-badge" style={{ background: 'var(--spp-accent)', opacity: 0.75 }}>📋</div>
                <div className="spp-week-titles">
                  <div className="spp-week-name">{b.title || 'Общее задание'}</div>
                  <div className="spp-week-label">Задание для всего класса</div>
                </div>
              </div>
              {b.description?.trim() && (
                <div className="spp-extra-text"><MathRenderer text={b.description.trim()} inline={false} /></div>
              )}
              <ul className="spp-links">
                {b.session_id && (
                  <li>
                    <a href={buildStudentUrl(b.session_id)} target="_blank" rel="noreferrer">
                      🔗 {b.work_title || 'Работа'}
                    </a>
                    {showQR && (
                      <a className="spp-qr" href={buildStudentUrl(b.session_id)} target="_blank" rel="noreferrer">
                        <QRCodeSVG value={buildStudentUrl(b.session_id)} size={62} level="M" marginSize={0} />
                      </a>
                    )}
                  </li>
                )}
                {b.url && (
                  <li><a href={b.url} target="_blank" rel="noreferrer">↗ {b.url_label || shortUrl(b.url)}</a></li>
                )}
                {(b.files || []).map((f) => (
                  <li key={f.id}><a href={f.url} target="_blank" rel="noreferrer">📎 {f.title || 'файл'}</a></li>
                ))}
              </ul>
            </section>
          ))}

          {/* ── Недели ── */}
          {filledWeeks.map((w) => {
            const list = byWeek.get(w.week) || [];
            const wDone = list.filter((i) => i.session && doneSessions.has(i.session)).length;
            const wTotal = list.filter((i) => i.session).length;
            return (
              <section className="spp-week" key={w.week}>
                <div className="spp-week-head">
                  <div className="spp-week-badge">{w.week}</div>
                  <div className="spp-week-titles">
                    <div className="spp-week-name">Неделя {w.week}</div>
                    {w.label && <div className="spp-week-label">{w.label}</div>}
                  </div>
                  <div className="spp-week-meta">
                    <span className="spp-week-dates">{weekRange(w)}</span>
                    {wTotal > 0 && <span className="spp-week-count">{wDone}/{wTotal}</span>}
                  </div>
                </div>

                <ul className="spp-tasks">
                  {list.map(renderTaskRow)}
                </ul>
              </section>
            );
          })}

          {/* ── Дополнительное задание ── */}
          {hasExtra && (
            <section className="spp-week spp-extra">
              <div className="spp-week-head">
                <div className="spp-week-badge spp-extra-badge">✦</div>
                <div className="spp-week-titles">
                  <div className="spp-week-name">Дополнительное задание</div>
                </div>
              </div>

              {ex.text?.trim() && (
                <div className="spp-extra-text"><MathRenderer text={ex.text.trim()} inline={false} /></div>
              )}

              {leftover.length > 0 && (
                <ul className="spp-tasks">{leftover.map(renderTaskRow)}</ul>
              )}

              {(exLinks.length > 0 || exFiles.length > 0) && (
                <ul className="spp-links">
                  {exLinks.map((l, i) => (
                    <li key={`l${i}`}>
                      <a href={l.url} target="_blank" rel="noreferrer">↗ {l.label || shortUrl(l.url)}</a>
                    </li>
                  ))}
                  {exFiles.map((f) => (
                    <li key={f.id}>
                      <a href={f.url} target="_blank" rel="noreferrer">📎 {f.title || 'файл'}</a>
                      {f.note && <span className="spp-link-note"> — {f.note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {filledWeeks.length === 0 && !hasExtra && (
            <div className="spp-empty">В программе пока нет заданий.</div>
          )}
        </div>
      </div>
    </div>
  );
}
