import { Alert, Card, Col, Collapse, Empty, Form, Input, InputNumber, Row, Space, Tag, Typography, Upload, Button } from 'antd';
import { PictureOutlined, UploadOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';

const { Text, Paragraph } = Typography;

/**
 * Шаг 2 мастера: что распозналось. Здесь учитель видит задачи глазами (KaTeX),
 * правит шапку работы и прикладывает файлы к плейсхолдерам чертежей.
 */
export default function ReviewStep({
  parsed,
  rows = [],
  workMeta,
  onWorkMetaChange,
  placeholderFiles = {},
  onPlaceholderFile,
}) {
  if (!parsed) return <Empty description="Сначала разберите работу" />;

  const { errors = [], warnings = [], imagePlaceholders = [], internalDuplicates = [] } = parsed;
  const variants = [...new Set(rows.map((r) => r.variantNumber))].sort((a, b) => a - b);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {errors.length > 0 && (
        <Alert
          type="error"
          showIcon
          message={`Ошибки разбора: ${errors.length}`}
          description={<ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        />
      )}

      {warnings.length > 0 && (
        <Collapse
          size="small"
          items={[{
            key: 'w',
            label: <span style={{ color: '#d48806' }}>Предупреждения: {warnings.length}</span>,
            children: <ul style={{ margin: 0, paddingLeft: 18 }}>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>,
          }]}
        />
      )}

      {internalDuplicates.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message="Внутри файла есть повторяющиеся задачи"
          description={`Совпадений: ${internalDuplicates.length}. Обычно это ошибка распознавания вариантов — проверьте текст.`}
        />
      )}

      <Card size="small" title="Работа">
        <Form layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={10}>
              <Form.Item label="Название" style={{ marginBottom: 12 }}>
                <Input
                  value={workMeta.title}
                  onChange={(e) => onWorkMetaChange({ ...workMeta, title: e.target.value })}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item label="Класс" style={{ marginBottom: 12 }}>
                <InputNumber
                  min={1}
                  max={11}
                  style={{ width: '100%' }}
                  value={workMeta.classNumber}
                  onChange={(v) => onWorkMetaChange({ ...workMeta, classNumber: v })}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item label="Время, мин" style={{ marginBottom: 12 }}>
                <InputNumber
                  min={1}
                  max={300}
                  style={{ width: '100%' }}
                  value={workMeta.timeLimit}
                  onChange={(v) => onWorkMetaChange({ ...workMeta, timeLimit: v })}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Источник" style={{ marginBottom: 12 }}>
                <Input
                  placeholder="От кого работа"
                  value={workMeta.source}
                  onChange={(e) => onWorkMetaChange({ ...workMeta, source: e.target.value })}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {imagePlaceholders.length > 0 && (
        <Card size="small" title={<span><PictureOutlined /> Чертежи ({imagePlaceholders.length})</span>}>
          <Paragraph type="secondary" style={{ marginTop: 0 }}>
            В тексте есть плейсхолдеры картинок. Приложите к каждому файл — иначе задача
            сохранится без чертежа.
          </Paragraph>
          <Row gutter={[12, 12]}>
            {imagePlaceholders.map((key) => (
              <Col xs={24} sm={12} md={8} key={key}>
                <Card size="small" title={<Text code>{key}</Text>}>
                  <Upload
                    accept="image/*"
                    maxCount={1}
                    listType="picture"
                    fileList={placeholderFiles[key] ? [{
                      uid: key,
                      name: placeholderFiles[key].name,
                      status: 'done',
                      originFileObj: placeholderFiles[key],
                    }] : []}
                    beforeUpload={(file) => { onPlaceholderFile(key, file); return false; }}
                    onRemove={() => onPlaceholderFile(key, null)}
                  >
                    <Button size="small" icon={<UploadOutlined />}>Выбрать файл</Button>
                  </Upload>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Collapse
        defaultActiveKey={variants.map(String)}
        items={variants.map((number) => ({
          key: String(number),
          label: `Вариант ${number} — задач: ${rows.filter((r) => r.variantNumber === number).length}`,
          children: (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {rows.filter((r) => r.variantNumber === number).map((row) => (
                <Card key={row.key} size="small">
                  <Space wrap style={{ marginBottom: 8 }}>
                    <Tag color="blue">№ {row.task.number || row.position + 1}</Tag>
                    {row.task.topicName
                      ? <Tag color={row.topicId ? 'green' : 'orange'}>{row.task.topicName}</Tag>
                      : <Tag color="orange">тема не указана</Tag>}
                    {row.task.answer
                      ? <Tag>ответ: {row.task.answer}</Tag>
                      : <Tag color="orange">без ответа</Tag>}
                    {row.task.difficulty !== '1' && <Tag>сложность {row.task.difficulty}</Tag>}
                    {row.task.examPart === 2 && <Tag color="purple">часть 2</Tag>}
                    {row.task.images?.length > 0 && <Tag icon={<PictureOutlined />}>{row.task.images.length}</Tag>}
                  </Space>
                  <MathRenderer text={row.task.statement_md} />
                  {row.task.solution_md && (
                    <Collapse
                      size="small"
                      style={{ marginTop: 8 }}
                      items={[{ key: 's', label: 'Решение', children: <MathRenderer text={row.task.solution_md} /> }]}
                    />
                  )}
                </Card>
              ))}
            </Space>
          ),
        }))}
      />
    </Space>
  );
}
