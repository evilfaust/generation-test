import { Button, Card, Col, Collapse, Progress, Row, Statistic } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';

// Шаг «Импорт» из TaskImporter (god-компонент): прогресс импорта + итоговая
// статистика (добавлено/пропущено/ошибки) + подробный лог + кнопка повтора.
export default function ImportStep({ importing, importProgress, importResults, onReset }) {
  const percent = importProgress.total > 0
    ? Math.round((importProgress.current / importProgress.total) * 100)
    : 0;

  return (
    <div>
      {importing && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Progress
            type="circle"
            percent={percent}
            format={() => `${importProgress.current}/${importProgress.total}`}
          />
          <div style={{ marginTop: 16, color: '#666' }}>
            Импортируем задачи...
          </div>
        </div>
      )}

      {importResults && (
        <div>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Добавлено"
                  value={importResults.added}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Пропущено (дубли)"
                  value={importResults.skipped}
                  valueStyle={{ color: '#faad14' }}
                  prefix={<WarningOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Ошибки"
                  value={importResults.errors}
                  valueStyle={{ color: importResults.errors > 0 ? '#ff4d4f' : '#999' }}
                  prefix={<CloseCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {importResults.details.length > 0 && (
            <Collapse
              items={[{
                key: 'log',
                label: `Подробный лог (${importResults.details.length} записей)`,
                children: (
                  <div style={{ maxHeight: 300, overflowY: 'auto', fontSize: 13 }}>
                    {importResults.details.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '4px 0',
                          borderBottom: '1px solid #f5f5f5',
                          color: d.status === 'added' ? '#52c41a'
                            : d.status === 'skipped' ? '#faad14'
                            : '#ff4d4f',
                        }}
                      >
                        {d.status === 'added' && '+ '}
                        {d.status === 'skipped' && '~ '}
                        {d.status === 'error' && '! '}
                        {d.message}
                      </div>
                    ))}
                  </div>
                ),
              }]}
            />
          )}

          <div style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={onReset}
            >
              Импортировать ещё
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
