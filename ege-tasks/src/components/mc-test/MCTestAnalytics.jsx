import { useState, useEffect } from 'react';
import { Spin, Empty, Statistic, Row, Col, Tag, Tooltip, Progress } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function TaskRow({ taskData, taskIndex, stats, shuffleMode }) {
  if (!stats) return null;

  const correctPct = stats.total > 0 ? Math.round(stats.correctCount / stats.total * 100) : 0;
  const isFixed = shuffleMode === 'fixed';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 0',
      borderBottom: '1px solid #f5f5f5',
    }}>
      <div style={{ width: 24, textAlign: 'center', color: '#8c8c8c', fontSize: 12, flexShrink: 0 }}>
        {taskIndex + 1}
      </div>

      <div style={{ flex: 1 }}>
        {isFixed ? (
          // Фиксированный порядок: показываем распределение по буквам
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(taskData.options || []).map((opt, oi) => {
              const count = stats.choices[String(oi)] || 0;
              const pct = stats.total > 0 ? Math.round(count / stats.total * 100) : 0;
              return (
                <Tooltip key={oi} title={`${count} из ${stats.total} (${pct}%)`}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '2px 7px',
                    borderRadius: 4,
                    fontSize: 12,
                    background: opt.is_correct ? '#f6ffed' : '#fafafa',
                    border: `1px solid ${opt.is_correct ? '#b7eb8f' : '#e8e8e8'}`,
                    color: opt.is_correct ? '#389e0d' : '#595959',
                    minWidth: 36,
                  }}>
                    <span style={{ fontWeight: 600 }}>{LETTERS[oi]}</span>
                    <span>{count > 0 ? count : '–'}</span>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        ) : (
          // Перемешанный порядок: только правильно/неправильно
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#52c41a', fontSize: 12 }}>
              <CheckCircleOutlined />
              <span>{stats.correctCount}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ff4d4f', fontSize: 12 }}>
              <CloseCircleOutlined />
              <span>{stats.total - stats.correctCount}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: 80, flexShrink: 0 }}>
        <Progress
          percent={correctPct}
          size="small"
          showInfo={false}
          strokeColor={correctPct >= 70 ? '#52c41a' : correctPct >= 40 ? '#faad14' : '#ff4d4f'}
        />
      </div>
      <div style={{ width: 36, textAlign: 'right', fontSize: 12, color: '#595959', flexShrink: 0 }}>
        {correctPct}%
      </div>
    </div>
  );
}

export default function MCTestAnalytics({ mcTestId, variants = [], shuffleMode = 'fixed' }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!mcTestId) return;
    setLoading(true);
    api.getMCTestAnalytics(mcTestId)
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [mcTestId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>;
  if (!data) return null;
  if (!data.attempts.length) {
    return <Empty description="Нет сданных попыток" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const totalAttempts = data.attempts.length;
  const avgScorePct = Math.round(
    data.attempts.reduce((s, a) => s + (a.total > 0 ? a.score / a.total : 0), 0) / totalAttempts * 100
  );
  const maxScore = data.attempts.reduce((m, a) => Math.max(m, a.total > 0 ? a.score / a.total : 0), 0);

  return (
    <div>
      <Row gutter={24} style={{ marginBottom: 16 }}>
        <Col>
          <Statistic title="Попыток" value={totalAttempts} />
        </Col>
        <Col>
          <Statistic title="Средний результат" value={avgScorePct} suffix="%" />
        </Col>
        <Col>
          <Statistic title="Лучший результат" value={Math.round(maxScore * 100)} suffix="%" />
        </Col>
      </Row>

      {shuffleMode === 'per_student' && (
        <div style={{
          fontSize: 12, color: '#8c8c8c', marginBottom: 12,
          padding: '4px 8px', background: '#fafafa', borderRadius: 4,
        }}>
          Распределение по вариантам ответа недоступно при режиме «Перемешивать» — показываем только правильно/неправильно
        </div>
      )}

      {variants.map((variant, vi) => {
        const tasks = variant.tasks || [];
        if (!tasks.length) return null;
        return (
          <div key={vi} style={{ marginBottom: 16 }}>
            {variants.length > 1 && (
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                <Tag color="blue">Вариант {variant.number}</Tag>
              </div>
            )}
            <div>
              {tasks.map((taskData, ti) => (
                <TaskRow
                  key={taskData.task_id || ti}
                  taskData={taskData}
                  taskIndex={ti}
                  stats={data.answerStats[taskData.task_id]}
                  shuffleMode={shuffleMode}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
