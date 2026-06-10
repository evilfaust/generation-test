/**
 * NoteAttachments — панель вложений заметки.
 *
 * Единый список: файлы самой заметки (teacher_notes.links, type='material') +
 * файлы привязанного урока (lessons.materials, read-only, чип «урок»).
 * Превью через FilePreviewModal, drag-drop загрузка прямо на панель
 * (файл уходит в Библиотеку pb-files и сразу прикрепляется), пикер из Библиотеки.
 */
import { useState } from 'react';
import { App, Button, Popconfirm, Tooltip, Typography, Upload } from 'antd';
import {
  DeleteOutlined, DownloadOutlined, FileImageOutlined, FileOutlined,
  FilePdfOutlined, FolderOpenOutlined, PaperClipOutlined,
} from '@ant-design/icons';
import { materialsApi } from '../../shared/services/pb/filesClient';
import MaterialPickerModal from './MaterialPickerModal';
import FilePreviewModal from './FilePreviewModal';
import { Chip } from './ui';

const { Text } = Typography;

function fileKind(f) {
  const s = `${f.title || ''} ${f.url || ''}`.toLowerCase();
  if (s.includes('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)/.test(s)) return 'image';
  return 'other';
}

const KIND_ICON = {
  pdf: <FilePdfOutlined style={{ color: '#d4380d' }} />,
  image: <FileImageOutlined style={{ color: '#389e0d' }} />,
  other: <FileOutlined style={{ color: '#1677ff' }} />,
};

function FileRow({ f, fromLesson, canEdit, onPreview, onDetach }) {
  return (
    <div className="note-att__row">
      <span className="note-att__icon">{KIND_ICON[fileKind(f)]}</span>
      <button type="button" className="note-att__title" title={f.title} onClick={() => onPreview(f)}>
        {f.title || 'Файл'}
      </button>
      {fromLesson && <Chip tone="violet" dot={false}>урок</Chip>}
      <span className="note-att__actions">
        <Tooltip title="Открыть / скачать">
          <a href={f.url} target="_blank" rel="noreferrer" className="note-att__action"><DownloadOutlined /></a>
        </Tooltip>
        {!fromLesson && canEdit && (
          <Popconfirm title="Открепить файл от заметки?" okText="Открепить" cancelText="Отмена"
            onConfirm={() => onDetach(f)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} className="note-att__action" />
          </Popconfirm>
        )}
      </span>
    </div>
  );
}

// Сколько файлов показывать в свёрнутом виде (дальше — «Показать все»).
const COLLAPSED_LIMIT = 6;

export default function NoteAttachments({ noteFiles = [], lessonFiles = [], canEdit, onSave }) {
  const { message } = App.useApp();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [preview, setPreview] = useState(null); // {title, url}
  const [uploading, setUploading] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const detach = (f) => onSave(noteFiles.filter((x) => x.id !== f.id));

  const attachPicked = (picked) => {
    const seen = new Set(noteFiles.map((x) => x.id));
    onSave([...noteFiles, ...picked.filter((p) => !seen.has(p.id))]);
  };

  // Drag-drop / выбор файла → загрузка в Библиотеку + мгновенное прикрепление.
  const customUpload = async ({ file, onSuccess, onError }) => {
    if (!materialsApi.isConnected()) {
      message.warning('Хранилище не подключено — войдите в Библиотеку материалов');
      setPickerOpen(true); // пикер покажет форму подключения
      onError?.(new Error('not connected'));
      return;
    }
    setUploading((n) => n + 1);
    try {
      const rec = await materialsApi.uploadMaterial({
        file,
        title: file.name.replace(/\.[^.]+$/, ''),
        category: 'other',
      });
      attachPicked([{ type: 'material', id: rec.id, title: rec.title, url: materialsApi.fileUrl(rec) }]);
      onSuccess?.(rec);
      message.success(`Прикреплено: ${file.name}`);
    } catch (e) {
      onError?.(e);
      message.error(`Ошибка загрузки ${file.name}: ${e?.message || ''}`);
    } finally {
      setUploading((n) => n - 1);
    }
  };

  // Единый список строк (файлы урока — read-only, сверху).
  const allRows = [
    ...lessonFiles.map((f) => ({ f, fromLesson: true, key: `l-${f.id}` })),
    ...noteFiles.map((f) => ({ f, fromLesson: false, key: f.id })),
  ];
  const isEmpty = allRows.length === 0;
  const overflow = allRows.length - COLLAPSED_LIMIT;
  const rows = expanded || overflow <= 0 ? allRows : allRows.slice(0, COLLAPSED_LIMIT);

  return (
    <div className="note-att">
      <div className="note-att__head">
        <Text type="secondary" style={{ fontSize: 12 }}>
          <PaperClipOutlined /> Вложения{isEmpty ? '' : ` (${allRows.length})`}
        </Text>
        {canEdit && (
          <Button size="small" type="text" icon={<FolderOpenOutlined />} onClick={() => setPickerOpen(true)}>
            Из Библиотеки
          </Button>
        )}
      </div>

      {!isEmpty && (
        <div className="note-att__list">
          {rows.map(({ f, fromLesson, key }) => (
            <FileRow key={key} f={f} fromLesson={fromLesson} canEdit={canEdit}
              onPreview={setPreview} onDetach={detach} />
          ))}
        </div>
      )}

      {overflow > 0 && (
        <Button size="small" type="link" style={{ padding: 0, fontSize: 12 }}
          onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Свернуть' : `Показать все (ещё ${overflow})`}
        </Button>
      )}

      {canEdit && (expanded || overflow <= 0) && (
        <Upload.Dragger multiple customRequest={customUpload} showUploadList={false} className="note-att__dropzone">
          <Text type="secondary" style={{ fontSize: 12 }}>
            {uploading > 0 ? `Загружается: ${uploading}…` : 'Перетащите файлы сюда — они попадут в Библиотеку и прикрепятся'}
          </Text>
        </Upload.Dragger>
      )}

      <MaterialPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        existingIds={noteFiles.map((f) => f.id)}
        onPick={attachPicked}
      />
      <FilePreviewModal
        open={!!preview}
        record={preview ? { title: preview.title, file: preview.url } : null}
        url={preview?.url || ''}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
