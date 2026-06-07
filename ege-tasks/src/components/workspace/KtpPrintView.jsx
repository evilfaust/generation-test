import { Button, Space } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import './KtpPrintView.css';

function fmtDate(iso) {
  if (!iso) return '';
  try { return dayjs(iso).format('DD.MM.YYYY'); } catch { return ''; }
}

export default function KtpPrintView({ course, entries = [], group, totalHours, onBack }) {
  const doPrint = () => {
    const style = document.createElement('style');
    style.textContent = '@page { size: A4 landscape; margin: 12mm; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => style.remove(), 1500);
  };

  const subtitle = [
    group?.name ? `Класс: ${group.name}` : null,
    course?.year ? `Учебный год: ${course.year}` : null,
    totalHours ? `Всего часов: ${totalHours}` : null,
  ].filter(Boolean).join('    ·    ');

  let n = 0;

  return (
    <div className="ktp-print-root">
      <div className="ktp-print-toolbar">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={doPrint}>Печать / PDF</Button>
        </Space>
      </div>

      <div className="ktp-print-page">
        <h2 className="ktp-print-title">{course?.title || 'КТП'}</h2>
        {subtitle && <div className="ktp-print-subtitle">{subtitle}</div>}

        <table className="ktp-print-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>№</th>
              <th style={{ width: '38%' }}>Тема</th>
              <th style={{ width: '7%' }}>Часы</th>
              <th style={{ width: '8%' }}>Неделя</th>
              <th style={{ width: '12%' }}>Дата</th>
              <th style={{ width: '30%' }}>Планируемые результаты</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              if (e.is_section) {
                return (
                  <tr key={e.id} className="ktp-print-section">
                    <td colSpan={6}>{e.title}</td>
                  </tr>
                );
              }
              n += 1;
              const topicTitle = e.expand?.topic?.title;
              return (
                <tr key={e.id}>
                  <td className="ktp-c">{n}</td>
                  <td>
                    {e.title}
                    {topicTitle && topicTitle !== e.title && (
                      <div className="ktp-print-topic">↳ {topicTitle}</div>
                    )}
                  </td>
                  <td className="ktp-c">{e.hours ?? ''}</td>
                  <td className="ktp-c">{e.week_no ?? ''}</td>
                  <td className="ktp-c">{fmtDate(e.planned_date)}</td>
                  <td>{e.planned_results || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
