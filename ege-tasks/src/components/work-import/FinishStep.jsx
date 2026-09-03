import { Alert, Button, Card, Col, Collapse, Progress, Result, Row, Space, Statistic, Typography } from 'antd';
import { CheckCircleOutlined, DatabaseOutlined, FileAddOutlined, WarningOutlined } from '@ant-design/icons';
import { summarizeRows } from '../../utils/workImportPlan';

const { Text } = Typography;

/** Шаг 4 мастера: сводка, запуск импорта и итог. */
export default function FinishStep({
  rows = [],
  workMeta,
  issues = [],
  importing,
  progress,
  result,
  onImport,
  onOpenWork,
  onReset,
}) {
  if (result) {
    return (
      <Result
        status="success"
        title={`Работа «${result.work?.title}» сохранена`}
        subTitle={`Создано задач: ${result.created} · взято из базы: ${result.reused} · вариантов: ${result.variants}`}
        extra={[
          <Button key="open" type="primary" onClick={() => onOpenWork?.(result.work?.id)}>Открыть работу</Button>,
          <Button key="more" onClick={onReset}>Импортировать ещё</Button>,
        ]}
      >
        {result.failed > 0 && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message={`Не удалось создать задач: ${result.failed}`}
          />
        )}
        {result.warnings?.length > 0 && (
          <Collapse
            size="small"
            items={[{
              key: 'w',
              label: `Предупреждения: ${result.warnings.length}`,
              children: <ul style={{ margin: 0, paddingLeft: 18 }}>{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>,
            }]}
          />
        )}
      </Result>
    );
  }

  const summary = summarizeRows(rows);
  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card size="small" title={`Работа «${workMeta.title || 'без названия'}»`}>
        <Row gutter={16}>
          <Col xs={12} md={6}>
            <Statistic title="Новых задач" value={summary.create} prefix={<FileAddOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Из базы" value={summary.reuse} prefix={<DatabaseOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Вариантов" value={summary.variants} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic
              title="Без ответа"
              value={summary.withoutAnswer}
              prefix={summary.withoutAnswer > 0 ? <WarningOutlined /> : <CheckCircleOutlined />}
              valueStyle={{ color: summary.withoutAnswer > 0 ? '#faad14' : '#52c41a' }}
            />
          </Col>
        </Row>
        {summary.skip > 0 && (
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">Исключено из импорта: {summary.skip}</Text>
          </div>
        )}
      </Card>

      {issues.length > 0 && (
        <Alert
          type="error"
          showIcon
          message="Импорт пока недоступен"
          description={<ul style={{ margin: 0, paddingLeft: 18 }}>{issues.map((i, idx) => <li key={idx}>{i}</li>)}</ul>}
        />
      )}

      {importing && (
        <Card size="small">
          <Progress percent={percent} status="active" />
          <Text type="secondary">{progress.label} ({progress.current}/{progress.total})</Text>
        </Card>
      )}

      <Button
        type="primary"
        size="large"
        loading={importing}
        disabled={issues.length > 0}
        onClick={onImport}
      >
        Импортировать работу
      </Button>
    </Space>
  );
}
