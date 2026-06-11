import { useState, useCallback } from 'react';
import { Tooltip, Modal, Input, Popover, Dropdown } from 'antd';
import {
  BoldOutlined, ItalicOutlined, StrikethroughOutlined,
  OrderedListOutlined, UnorderedListOutlined,
  CodeOutlined, PictureOutlined, LinkOutlined,
  MinusOutlined, FunctionOutlined, ContainerOutlined, DownOutlined
} from '@ant-design/icons';
import TableInsertPopover from './TableInsertPopover';
import FormulaPalette from './FormulaPalette';
import './EditorToolbar.css';

// Вставка/обёртка через императивный хэндл редактора (TheoryMarkdownEditor).
function insertIntoEditor(editor, opts) {
  editor?.insert?.(opts);
}

// Каллауты теории (тип → подпись по умолчанию)
const CALLOUTS = [
  { type: 'definition', label: 'Определение' },
  { type: 'theorem', label: 'Теорема' },
  { type: 'example', label: 'Пример' },
  { type: 'remark', label: 'Замечание' },
  { type: 'proof', label: 'Доказательство' },
  { type: 'note', label: 'Заметка' },
];

export default function EditorToolbar({ editorRef }) {
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const insert = useCallback((opts) => {
    insertIntoEditor(editorRef.current, opts);
  }, [editorRef]);

  const handleTableInsert = useCallback((tableMarkdown) => {
    insertIntoEditor(editorRef.current, { text: tableMarkdown });
  }, [editorRef]);

  const handleImageInsert = useCallback(() => {
    if (!imageUrl.trim()) return;
    const alt = imageAlt.trim() || 'Изображение';
    insertIntoEditor(editorRef.current, { text: `\n![${alt}](${imageUrl.trim()})\n` });
    setImageUrl('');
    setImageAlt('');
    setImageModalOpen(false);
  }, [editorRef, imageUrl, imageAlt]);

  const handleLinkInsert = useCallback(() => {
    if (!linkUrl.trim()) return;
    const text = linkText.trim() || linkUrl.trim();
    insertIntoEditor(editorRef.current, { text: `[${text}](${linkUrl.trim()})` });
    setLinkUrl('');
    setLinkText('');
    setLinkModalOpen(false);
  }, [editorRef, linkUrl, linkText]);

  // Вставка каллаута: курсор встаёт в пустую строку тела блока.
  const insertCallout = useCallback(({ type, label }) => {
    insertIntoEditor(editorRef.current, { before: `\n:::${type} ${label}\n`, after: '\n:::\n' });
  }, [editorRef]);

  const calloutMenu = {
    items: CALLOUTS.map((c) => ({ key: c.type, label: c.label })),
    onClick: ({ key }) => {
      const c = CALLOUTS.find((x) => x.type === key);
      if (c) insertCallout(c);
    },
  };

  return (
    <>
      <div className="theory-format-toolbar">
        {/* Заголовки */}
        <div className="toolbar-group">
          <Tooltip title="Заголовок 1">
            <button className="toolbar-btn heading-btn h1" type="button"
              onClick={() => insert({ before: '# ', after: '', newLine: true })}>H1</button>
          </Tooltip>
          <Tooltip title="Заголовок 2">
            <button className="toolbar-btn heading-btn h2" type="button"
              onClick={() => insert({ before: '## ', after: '', newLine: true })}>H2</button>
          </Tooltip>
          <Tooltip title="Заголовок 3">
            <button className="toolbar-btn heading-btn h3" type="button"
              onClick={() => insert({ before: '### ', after: '', newLine: true })}>H3</button>
          </Tooltip>
          <Tooltip title="Заголовок 4">
            <button className="toolbar-btn heading-btn h4" type="button"
              onClick={() => insert({ before: '#### ', after: '', newLine: true })}>H4</button>
          </Tooltip>
        </div>

        {/* Форматирование текста */}
        <div className="toolbar-group">
          <Tooltip title="Жирный">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '**', after: '**' })}>
              <BoldOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Курсив">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '*', after: '*' })}>
              <ItalicOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Зачёркнутый">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '~~', after: '~~' })}>
              <StrikethroughOutlined />
            </button>
          </Tooltip>
        </div>

        {/* Блочные элементы */}
        <div className="toolbar-group">
          <Tooltip title="Маркированный список">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '- ', after: '', newLine: true })}>
              <UnorderedListOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Нумерованный список">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '1. ', after: '', newLine: true })}>
              <OrderedListOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Цитата">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '> ', after: '', newLine: true })}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>"</span>
            </button>
          </Tooltip>
          <Tooltip title="Блок кода">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '```\n', after: '\n```', newLine: true })}>
              <CodeOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Разделитель">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ text: '\n---\n' })}>
              <MinusOutlined />
            </button>
          </Tooltip>
        </div>

        {/* Вставка */}
        <div className="toolbar-group">
          <TableInsertPopover onInsert={handleTableInsert} />
          <Tooltip title="Формула (inline) — Ctrl+I">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '$', after: '$' })}>
              <FunctionOutlined />
              <span className="formula-label">x</span>
            </button>
          </Tooltip>
          <Tooltip title="Формула (блок) — Ctrl+B">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '\n$$\n', after: '\n$$\n' })}>
              <FunctionOutlined />
              <span className="formula-label">∑</span>
            </button>
          </Tooltip>
          <Popover
            trigger="click"
            placement="bottomLeft"
            content={<FormulaPalette onInsert={insert} />}
            title="Палитра формул"
          >
            <Tooltip title="Палитра символов и шаблонов">
              <button className="toolbar-btn toolbar-btn--wide" type="button">
                <FunctionOutlined />
                <DownOutlined className="toolbar-caret" />
              </button>
            </Tooltip>
          </Popover>
          <Dropdown menu={calloutMenu} trigger={['click']} placement="bottomLeft">
            <Tooltip title="Блок теории (определение, теорема…)">
              <button className="toolbar-btn toolbar-btn--wide" type="button">
                <ContainerOutlined />
                <DownOutlined className="toolbar-caret" />
              </button>
            </Tooltip>
          </Dropdown>
          <Tooltip title="Изображение">
            <button className="toolbar-btn" type="button"
              onClick={() => setImageModalOpen(true)}>
              <PictureOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Ссылка">
            <button className="toolbar-btn" type="button"
              onClick={() => setLinkModalOpen(true)}>
              <LinkOutlined />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Modal: Вставка изображения */}
      <Modal
        title="Вставка изображения"
        open={imageModalOpen}
        onCancel={() => { setImageModalOpen(false); setImageUrl(''); setImageAlt(''); }}
        onOk={handleImageInsert}
        okText="Вставить"
        cancelText="Отмена"
        okButtonProps={{ disabled: !imageUrl.trim() }}
        width={450}
      >
        <div className="theory-image-insert">
          <Input
            placeholder="URL изображения"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            autoFocus
          />
          <Input
            placeholder="Описание (alt текст)"
            value={imageAlt}
            onChange={e => setImageAlt(e.target.value)}
          />
          {imageUrl.trim() && (
            <img
              src={imageUrl}
              alt="Превью"
              className="theory-image-insert-preview"
              onError={e => { e.target.style.display = 'none'; }}
              onLoad={e => { e.target.style.display = 'block'; }}
            />
          )}
        </div>
      </Modal>

      {/* Modal: Вставка ссылки */}
      <Modal
        title="Вставка ссылки"
        open={linkModalOpen}
        onCancel={() => { setLinkModalOpen(false); setLinkUrl(''); setLinkText(''); }}
        onOk={handleLinkInsert}
        okText="Вставить"
        cancelText="Отмена"
        okButtonProps={{ disabled: !linkUrl.trim() }}
        width={450}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            placeholder="URL"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            autoFocus
          />
          <Input
            placeholder="Текст ссылки (необязательно)"
            value={linkText}
            onChange={e => setLinkText(e.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}
