import { useMemo, useState } from 'react';
import { Alert, Button, Card, Input, Modal, Select, Space, Typography, Upload, App } from 'antd';
import { CopyOutlined, FileTextOutlined, InboxOutlined, PictureOutlined, RobotOutlined } from '@ant-design/icons';
import { buildAiPrompt, EXAM_TYPES } from '../../utils/workImportFormat';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;
const { Dragger } = Upload;

const EXAM_TYPE_LABELS = {
  ege_base: 'ЕГЭ базовый',
  ege_profile: 'ЕГЭ профильный',
  oge: 'ОГЭ (9 кл.)',
  vpr: 'ВПР',
  trig: 'Тригонометрия',
  mordkovich: 'Мордкович',
  oral: 'Устный счёт',
  other: 'Прочее',
};

const EXAMPLE = `---
работа: Контрольная «Производная»
класс: 11
контекст: ege_profile
---

## Вариант 1

### 1
тема: Производная и первообразная
ответ: 3x^2-2

Найдите производную функции $f(x)=x^3-2x$.

### 2
тема: Геометрический смысл производной

На рисунке изображён график функции.

![](рис1)

Найдите значение производной в точке $x_0=3$.

## Вариант 2

### 1
ответ: 5x^4+1

Найдите производную функции $f(x)=x^5+x$.`;

/**
 * Шаг 1 мастера: откуда берём работу.
 *
 * Своей ИИ-ручки нет по решению от 03.09.2026 — вместо неё кнопка «Промпт для
 * ИИ»: учитель копирует промпт с актуальным каталогом тем во внешнюю модель
 * вместе с фото листка и вставляет сюда готовый markdown.
 */
export default function SourceStep({
  text,
  onTextChange,
  onParse,
  topics = [],
  examTypeHint,
  onExamTypeHintChange,
  originalFiles = [],
  onOriginalFilesChange,
}) {
  const { message } = App.useApp();
  const [promptOpen, setPromptOpen] = useState(false);

  const prompt = useMemo(
    () => buildAiPrompt({ topics, examType: examTypeHint || null }),
    [topics, examTypeHint],
  );

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      message.success('Промпт скопирован — вставьте его в ИИ вместе с фото листка');
    } catch {
      message.warning('Не удалось скопировать автоматически — выделите текст и скопируйте вручную');
    }
  };

  const readFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      onTextChange(String(e.target?.result || ''));
      message.success(`Файл «${file.name}» загружен`);
    };
    reader.onerror = () => message.error('Не удалось прочитать файл');
    reader.readAsText(file, 'utf-8');
    return false;
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="Как это работает"
        description={
          <div>
            <Paragraph style={{ marginBottom: 8 }}>
              Работа загружается целиком: задачи попадают в банк и распределяются по темам,
              а сама работа сохраняется в «Мои работы» с вариантами и порядком задач.
            </Paragraph>
            <Paragraph style={{ marginBottom: 0 }}>
              Листок от руки сначала переводится в текст любой ИИ — нажмите{' '}
              <Text strong>«Промпт для ИИ»</Text>, скопируйте промпт и отправьте его во внешнюю
              модель вместе с фото. В промпт уже вшит список ваших тем.
            </Paragraph>
          </div>
        }
      />

      <Card size="small" title="Подготовка текста">
        <Space wrap>
          <Select
            style={{ minWidth: 220 }}
            allowClear
            placeholder="Контекст работы (необязательно)"
            value={examTypeHint || undefined}
            onChange={(v) => onExamTypeHintChange?.(v || null)}
            options={EXAM_TYPES.map((value) => ({ value, label: EXAM_TYPE_LABELS[value] || value }))}
          />
          <Button icon={<RobotOutlined />} onClick={() => setPromptOpen(true)}>
            Промпт для ИИ
          </Button>
          <Button icon={<FileTextOutlined />} onClick={() => onTextChange(EXAMPLE)}>
            Вставить пример формата
          </Button>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">
            Контекст сужает список тем в промпте и помогает точнее подобрать тему при разборе.
          </Text>
        </div>
      </Card>

      <Dragger accept=".md,.markdown,.txt" beforeUpload={readFile} showUploadList={false} maxCount={1}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">Перетащите сюда .md-файл работы</p>
        <p className="ant-upload-hint">Или вставьте текст в поле ниже</p>
      </Dragger>

      <TextArea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Вставьте markdown работы…"
        autoSize={{ minRows: 12, maxRows: 26 }}
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}
      />

      <Card size="small" title={<span><PictureOutlined /> Оригинал работы (необязательно)</span>}>
        <Upload
          listType="picture"
          accept="image/*"
          multiple
          maxCount={6}
          fileList={originalFiles}
          beforeUpload={() => false}
          onChange={({ fileList }) => onOriginalFilesChange?.(fileList)}
        >
          <Button icon={<PictureOutlined />}>Добавить фото листка</Button>
        </Upload>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">
            Фото прикрепится к работе — если ИИ переврала формулу, всегда можно свериться с рукописью.
          </Text>
        </div>
      </Card>

      <Button type="primary" size="large" disabled={!text.trim()} onClick={onParse}>
        Разобрать работу
      </Button>

      <Modal
        open={promptOpen}
        title="Промпт для внешней ИИ"
        width={760}
        onCancel={() => setPromptOpen(false)}
        footer={[
          <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={copyPrompt}>Скопировать</Button>,
          <Button key="close" onClick={() => setPromptOpen(false)}>Закрыть</Button>,
        ]}
      >
        <Paragraph type="secondary">
          Скопируйте текст, вставьте в ИИ вместе с фото листка и верните полученный markdown сюда.
        </Paragraph>
        <TextArea value={prompt} readOnly autoSize={{ minRows: 14, maxRows: 22 }} style={{ fontSize: 12 }} />
      </Modal>
    </Space>
  );
}
