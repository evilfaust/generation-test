import { Button, Space, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import MathRenderer from '../../shared/components/MathRenderer';
import './MarathonTeacherSheetFull.css';

const { Text } = Typography;

/**
 * Полный лист учителя — таблица «условие + ответ + решение».
 * Для сложных задач, где нужно видеть условие при проверке.
 * Разбивается на страницы A4 автоматически (break-inside: avoid на строках).
 */
export default function MarathonTeacherSheetFull({ tasks, title, onBack }) {
  if (!tasks || !tasks.length) return null;

  const handlePrint = () => {
    const style = document.createElement('style');
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => style.remove(), 1500);
  };

  return (
    <div className="mtsf-root">
      {/* Тулбар */}
      <div className="mtsf-toolbar">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
          <Text type="secondary">
            Полный лист учителя · {tasks.length} задач
          </Text>
        </Space>
        <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
          Печать (A4)
        </Button>
      </div>

      {/* Страницы */}
      <div className="mtsf-pages">
        <div className="mtsf-sheet">
          <div className="mtsf-title">
            {title ? `${title} — Лист учителя` : 'Лист учителя'}
          </div>

          <table className="mtsf-table">
            <thead>
              <tr>
                <th className="mtsf-col-num">№</th>
                <th className="mtsf-col-statement">Условие и ответ</th>
                <th className="mtsf-col-answer">Решение / Подсказка</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, idx) => {
                const imageUrl = api.getTaskImageUrl(task);
                return (
                  <tr key={task.id}>
                    <td className="mtsf-col-num">{idx + 1}</td>

                    <td>
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt=""
                          crossOrigin="anonymous"
                          className="mtsf-task-img"
                        />
                      )}
                      <div className="mtsf-task-text">
                        <MathRenderer content={task.statement_md || ''} />
                      </div>
                      {task.answer && (
                        <div className="mtsf-answer" style={{ marginTop: '1.5mm' }}>
                          <strong>Ответ:</strong>{' '}
                          <MathRenderer content={task.answer} />
                        </div>
                      )}
                    </td>

                    <td>
                      {task.solution_md ? (
                        <div className="mtsf-solution">
                          <MathRenderer content={task.solution_md} />
                        </div>
                      ) : (
                        <span className="mtsf-no-answer">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
