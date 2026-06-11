import { useState, useCallback, useRef } from 'react';
import { Tooltip, Modal, Input, Popover, Dropdown, Button, Divider, Segmented, Upload, Alert, Space, App } from 'antd';
import {
  BoldOutlined, ItalicOutlined, StrikethroughOutlined,
  OrderedListOutlined, UnorderedListOutlined,
  CodeOutlined, PictureOutlined, LinkOutlined,
  MinusOutlined, FunctionOutlined, ContainerOutlined, DownOutlined,
  InboxOutlined, ScissorOutlined, ReloadOutlined, BorderHorizontalOutlined
} from '@ant-design/icons';
import TableInsertPopover from './TableInsertPopover';
import FormulaPalette from './FormulaPalette';
import CropModal from '../shared/CropModal';
import { materialsApi } from '../../shared/services/pb/filesClient';
import { dataUrlToFile } from '../../utils/cropImage';
import './EditorToolbar.css';

// Вертикальный разделитель групп — как в тулбаре редактора геометрии.
const DIVIDER = <Divider type="vertical" className="tf-divider" />;

// Вставка/обёртка через императивный хэндл редактора (TheoryMarkdownEditor).
function insertIntoEditor(editor, opts) {
  editor?.insert?.(opts);
}

// Каллауты теории (тип → подпись по умолчанию)
const CALLOUTS = [
  { type: 'condition', label: 'Условие задачи' },
  { type: 'definition', label: 'Определение' },
  { type: 'theorem', label: 'Теорема' },
  { type: 'example', label: 'Пример' },
  { type: 'remark', label: 'Замечание' },
  { type: 'proof', label: 'Доказательство' },
  { type: 'answer', label: 'Ответ' },
  { type: 'qed', label: 'Что и требовалось доказать' },
  { type: 'note', label: 'Заметка' },
];

export default function EditorToolbar({ editorRef }) {
  const { message } = App.useApp();
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageMode, setImageMode] = useState('upload'); // 'upload' | 'url'
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageSize, setImageSize] = useState('M'); // S | M | L | XL — градация размера в превью/печати
  const [localDataUrl, setLocalDataUrl] = useState(null); // выбранный/обрезанный файл (data-url)
  const [localName, setLocalName] = useState('image.png');
  const [uploading, setUploading] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const insert = useCallback((opts) => {
    insertIntoEditor(editorRef.current, opts);
  }, [editorRef]);

  const handleTableInsert = useCallback((tableMarkdown) => {
    insertIntoEditor(editorRef.current, { text: tableMarkdown });
  }, [editorRef]);

  const insertImageMd = useCallback((url, altRaw, size) => {
    const alt = (altRaw || '').trim() || 'Изображение';
    const sizeTag = size ? `{${size}}` : '';
    insertIntoEditor(editorRef.current, { text: `\n![${alt}](${url})${sizeTag}\n` });
  }, [editorRef]);

  const resetImageModal = useCallback(() => {
    setImageModalOpen(false);
    setImageUrl('');
    setImageAlt('');
    setLocalDataUrl(null);
    setLocalName('image.png');
    setImageMode('upload');
  }, []);

  // Выбор файла (Upload.Dragger / клик) → читаем в data-url, без авто-загрузки.
  const handleFilePicked = useCallback((file) => {
    if (file && !file.type?.startsWith('image/')) {
      message.warning('Можно загружать только изображения');
      return false;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLocalDataUrl(String(reader.result));
      setLocalName(file.name || 'image.png');
    };
    reader.readAsDataURL(file);
    return false;
  }, [message]);

  // OK модалки: ветвление по режиму (ссылка / загрузка на files.l.oipav.ru).
  const handleImageOk = useCallback(async () => {
    if (imageMode === 'url') {
      if (!imageUrl.trim()) return;
      insertImageMd(imageUrl.trim(), imageAlt, imageSize);
      resetImageModal();
      return;
    }
    if (!localDataUrl) return;
    if (!materialsApi.isConnected()) {
      message.warning('Хранилище файлов не подключено — войдите в разделе «Библиотека материалов»');
      return;
    }
    setUploading(true);
    try {
      const file = dataUrlToFile(localDataUrl, localName || 'image.png');
      const rec = await materialsApi.uploadMaterial({
        file,
        title: imageAlt.trim() || localName,
        category: 'other',
      });
      const url = materialsApi.fileUrl(rec);
      insertImageMd(url, imageAlt, imageSize);
      message.success('Картинка загружена');
      resetImageModal();
    } catch {
      message.error('Не удалось загрузить картинку');
    } finally {
      setUploading(false);
    }
  }, [imageMode, imageUrl, imageAlt, imageSize, localDataUrl, localName, insertImageMd, resetImageModal, message]);

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
        <Tooltip title="Заголовок 1">
          <Button size="small" type="text" className="tf-btn tf-h"
            onClick={() => insert({ before: '# ', after: '', newLine: true })}>H1</Button>
        </Tooltip>
        <Tooltip title="Заголовок 2">
          <Button size="small" type="text" className="tf-btn tf-h"
            onClick={() => insert({ before: '## ', after: '', newLine: true })}>H2</Button>
        </Tooltip>
        <Tooltip title="Заголовок 3">
          <Button size="small" type="text" className="tf-btn tf-h"
            onClick={() => insert({ before: '### ', after: '', newLine: true })}>H3</Button>
        </Tooltip>
        <Tooltip title="Заголовок 4">
          <Button size="small" type="text" className="tf-btn tf-h tf-h4"
            onClick={() => insert({ before: '#### ', after: '', newLine: true })}>H4</Button>
        </Tooltip>

        {DIVIDER}

        {/* Форматирование текста */}
        <Tooltip title="Жирный">
          <Button size="small" type="text" className="tf-btn" icon={<BoldOutlined />}
            onClick={() => insert({ before: '**', after: '**' })} />
        </Tooltip>
        <Tooltip title="Курсив">
          <Button size="small" type="text" className="tf-btn" icon={<ItalicOutlined />}
            onClick={() => insert({ before: '*', after: '*' })} />
        </Tooltip>
        <Tooltip title="Зачёркнутый">
          <Button size="small" type="text" className="tf-btn" icon={<StrikethroughOutlined />}
            onClick={() => insert({ before: '~~', after: '~~' })} />
        </Tooltip>

        {DIVIDER}

        {/* Блочные элементы */}
        <Tooltip title="Маркированный список">
          <Button size="small" type="text" className="tf-btn" icon={<UnorderedListOutlined />}
            onClick={() => insert({ before: '- ', after: '', newLine: true })} />
        </Tooltip>
        <Tooltip title="Нумерованный список">
          <Button size="small" type="text" className="tf-btn" icon={<OrderedListOutlined />}
            onClick={() => insert({ before: '1. ', after: '', newLine: true })} />
        </Tooltip>
        <Tooltip title="Цитата">
          <Button size="small" type="text" className="tf-btn tf-quote"
            onClick={() => insert({ before: '> ', after: '', newLine: true })}>&ldquo;</Button>
        </Tooltip>
        <Tooltip title="Блок кода">
          <Button size="small" type="text" className="tf-btn" icon={<CodeOutlined />}
            onClick={() => insert({ before: '```\n', after: '\n```', newLine: true })} />
        </Tooltip>
        <Tooltip title="Разделитель">
          <Button size="small" type="text" className="tf-btn" icon={<MinusOutlined />}
            onClick={() => insert({ text: '\n---\n' })} />
        </Tooltip>
        <Tooltip title="Разрыв страницы (для печати)">
          <Button size="small" type="text" className="tf-btn" icon={<BorderHorizontalOutlined />}
            onClick={() => insert({ text: '\n:::pagebreak\n' })} />
        </Tooltip>

        {DIVIDER}

        {/* Вставка */}
        <TableInsertPopover onInsert={handleTableInsert} />
        <Tooltip title="Формула (inline) — Ctrl+I">
          <Button size="small" type="text" className="tf-btn tf-fx"
            onClick={() => insert({ before: '$', after: '$' })}>
            <FunctionOutlined /><span className="tf-fx__sub">x</span>
          </Button>
        </Tooltip>
        <Tooltip title="Формула (блок) — Ctrl+B">
          <Button size="small" type="text" className="tf-btn tf-fx"
            onClick={() => insert({ before: '\n$$\n', after: '\n$$\n' })}>
            <FunctionOutlined /><span className="tf-fx__sub">∑</span>
          </Button>
        </Tooltip>
        <Popover
          trigger="click"
          placement="bottomLeft"
          content={<FormulaPalette onInsert={insert} />}
          title="Палитра формул"
        >
          <Tooltip title="Палитра символов и шаблонов">
            <Button size="small" type="text" className="tf-btn tf-btn--menu">
              <FunctionOutlined /><DownOutlined className="tf-caret" />
            </Button>
          </Tooltip>
        </Popover>
        <Dropdown menu={calloutMenu} trigger={['click']} placement="bottomLeft">
          <Tooltip title="Блок теории (определение, теорема…)">
            <Button size="small" type="text" className="tf-btn tf-btn--menu">
              <ContainerOutlined /><DownOutlined className="tf-caret" />
            </Button>
          </Tooltip>
        </Dropdown>
        <Tooltip title="Изображение">
          <Button size="small" type="text" className="tf-btn" icon={<PictureOutlined />}
            onClick={() => setImageModalOpen(true)} />
        </Tooltip>
        <Tooltip title="Ссылка">
          <Button size="small" type="text" className="tf-btn" icon={<LinkOutlined />}
            onClick={() => setLinkModalOpen(true)} />
        </Tooltip>
      </div>

      {/* Modal: Вставка изображения */}
      <Modal
        title="Вставка изображения"
        open={imageModalOpen}
        onCancel={resetImageModal}
        onOk={handleImageOk}
        okText={imageMode === 'upload' ? 'Загрузить и вставить' : 'Вставить'}
        cancelText="Отмена"
        confirmLoading={uploading}
        okButtonProps={{ disabled: imageMode === 'url' ? !imageUrl.trim() : !localDataUrl }}
        width={520}
      >
        <div className="theory-image-insert">
          <Segmented
            block
            value={imageMode}
            onChange={setImageMode}
            options={[
              { value: 'upload', label: 'Загрузить файл' },
              { value: 'url', label: 'По ссылке' },
            ]}
          />

          {imageMode === 'upload' ? (
            <>
              {!materialsApi.isConnected() && (
                <Alert
                  type="warning"
                  showIcon
                  message="Хранилище файлов не подключено"
                  description="Войдите в разделе «Библиотека материалов», чтобы загружать картинки на сервер."
                />
              )}
              {!localDataUrl ? (
                <Upload.Dragger
                  accept="image/*"
                  multiple={false}
                  showUploadList={false}
                  beforeUpload={handleFilePicked}
                >
                  <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                  <p className="ant-upload-text">Перетащите картинку сюда или нажмите</p>
                  <p className="ant-upload-hint">PNG, JPG, GIF, WebP — загрузится на files.l.oipav.ru</p>
                </Upload.Dragger>
              ) : (
                <>
                  <img src={localDataUrl} alt="Превью" className="theory-image-insert-preview" />
                  <Space>
                    <Button icon={<ScissorOutlined />} onClick={() => setCropOpen(true)}>Кадрировать</Button>
                    <Button icon={<ReloadOutlined />} onClick={() => setLocalDataUrl(null)}>Заменить</Button>
                  </Space>
                </>
              )}
              <Input
                placeholder="Описание (alt текст)"
                value={imageAlt}
                onChange={e => setImageAlt(e.target.value)}
              />
            </>
          ) : (
            <>
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
            </>
          )}

          <div className="theory-image-size">
            <span className="theory-image-size__label">Размер на странице</span>
            <Segmented
              size="small"
              value={imageSize}
              onChange={setImageSize}
              options={[
                { value: 'S', label: 'S' },
                { value: 'M', label: 'M' },
                { value: 'L', label: 'L' },
                { value: 'XL', label: 'XL' },
              ]}
            />
          </div>
        </div>
      </Modal>

      <CropModal
        open={cropOpen}
        onCancel={() => setCropOpen(false)}
        onCropped={(cropped) => { setLocalDataUrl(cropped); setCropOpen(false); }}
        imageUrl={localDataUrl}
        title="Кадрирование картинки"
        messageApi={message}
      />

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
