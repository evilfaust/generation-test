import { useState } from 'react';
import { Button, Space, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import MathRenderer from '../../shared/components/MathRenderer';
import './MarathonTeacherSheet.css';

const { Text } = Typography;

/**
 * Лист ответов для учителя:
 * один A4, сетка карточек — номер + чертёж + ответ.
 * Условие не отображается.
 */
export default function MarathonTeacherSheet({ tasks, title, onBack }) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    const style = document.createElement('style');
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => style.remove(), 1500);
  };

  if (!tasks || !tasks.length) return null;

  const n = tasks.length;

  // Автовыбор числа колонок
  const cols = n <= 6 ? 2 : n <= 12 ? 3 : n <= 20 ? 4 : 5;

  // Высота картинки зависит от числа колонок и строк
  const rows = Math.ceil(n / cols);
  // A4 usable height ≈ 283mm (297 - 8 top - 6 bottom), minus title ≈ 12mm → ~271mm
  // gap 3mm × (rows-1), card height ≈ availH / rows
  const availH = 271;
  const gapsH  = 3 * (rows - 1);
  const cardH  = Math.floor((availH - gapsH) / rows); // mm
  // шапка №≈5mm + ответ≈12mm (крупный шрифт) + паддинги≈5mm → картинке остаётся ~55% высоты карточки
  const imgH   = Math.max(8, Math.floor(cardH * 0.55));

  return (
    <div className="mtas-root">
      {/* Панель управления */}
      {onBack && (
        <div className="mtas-toolbar">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
            <Text type="secondary">
              Лист ответов · {n} задач
            </Text>
          </Space>
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
            Печать (A4)
          </Button>
        </div>
      )}

      {/* A4 лист */}
      <div
        className="mtas-sheet"
        style={{
          '--mtas-cols': cols,
          '--mtas-img-h': `${imgH}mm`,
        }}
      >
        <div className="mtas-title">
          {title ? `${title} — Лист ответов` : 'Лист ответов'}
        </div>

        <div className="mtas-grid">
          {tasks.map((task, idx) => {
            const imageUrl = api.getTaskImageUrl(task);

            return (
              <div key={task.id} className="mtas-card">
                {/* Номер */}
                <div className="mtas-card__num">№{idx + 1}</div>

                {/* Картинка */}
                <div className="mtas-card__img-wrap">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt=""
                      crossOrigin="anonymous"
                      className="mtas-card__img"
                    />
                  ) : (
                    <div className="mtas-card__no-img">—</div>
                  )}
                </div>

                {/* Ответ */}
                <div className="mtas-card__answer">
                  {task.answer ? (
                    <MathRenderer content={task.answer} />
                  ) : (
                    <span className="mtas-card__no-answer">нет ответа</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
