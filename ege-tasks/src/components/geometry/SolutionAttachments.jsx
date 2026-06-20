/**
 * SolutionAttachments — вложения к решению геометрической задачи.
 *
 * Простой список файлов (чаще всего — фото решения с бумаги), которые лежат в
 * файловом хранилище pb-files (files.l.oipav.ru). В geometry_tasks.solution_files
 * хранятся только ссылки `{ id, title, url, mime }`. Загрузка/превью/удаление.
 *
 * Управляемый компонент: `files` + `onChange(nextFiles)`. Реальная заливка идёт
 * на pb-files через materialsApi (как в NoteAttachments), требует подключённого
 * хранилища (логин в «Библиотеке материалов»).
 */
import { useState } from 'react';
import { App, Alert, Button, Popconfirm, Space, Tooltip, Typography, Upload } from 'antd';
import {
  DeleteOutlined, DownloadOutlined, FileImageOutlined, FileOutlined,
  FilePdfOutlined, InboxOutlined, PaperClipOutlined, UploadOutlined,
} from '@ant-design/icons';
import { materialsApi } from '../../shared/services/pb/filesClient';
import FilePreviewModal from '../workspace/FilePreviewModal';

const { Text } = Typography;

function fileKind(f) {
  const s = `${f.title || ''} ${f.url || ''} ${f.mime || ''}`.toLowerCase();
  if (s.includes('pdf')) return 'pdf';
  if (/(image\/|\.(png|jpe?g|gif|webp|svg|bmp|avif|heic))/.test(s)) return 'image';
  return 'other';
}

const KIND_ICON = {
  pdf: <FilePdfOutlined style={{ color: '#ff4d4f' }} />,
  image: <FileImageOutlined style={{ color: '#13c2c2' }} />,
  other: <FileOutlined style={{ color: '#1677ff' }} />,
};

export default function SolutionAttachments({ files = [], onChange }) {
  const { message } = App.useApp();
  const [uploading, setUploading] = useState(0);
  const [preview, setPreview] = useState(null); // { title, url, mime }

  const detach = (f) => onChange(files.filter((x) => x.id !== f.id));

  // Загрузка файла → pb-files + добавление ссылки.
  const customUpload = async ({ file, onSuccess, onError }) => {
    if (!materialsApi.isConnected()) {
      message.warning('Хранилище файлов не подключено — войдите в разделе «Библиотека материалов»');
      onError?.(new Error('not connected'));
      return;
    }
    setUploading((n) => n + 1);
    try {
      const rec = await materialsApi.uploadMaterial({
        file,
        title: file.name.replace(/\.[^.]+$/, ''),
        category: 'generated',
        subject: 'Геометрия',
      });
      const entry = {
        id: rec.id,
        title: rec.title || file.name,
        url: materialsApi.fileUrl(rec),
        mime: rec.mime || file.type || '',
      };
      onChange([...files.filter((x) => x.id !== entry.id), entry]);
      onSuccess?.(rec);
      message.success(`Прикреплено: ${file.name}`);
    } catch (e) {
      onError?.(e);
      message.error(`Ошибка загрузки ${file.name}: ${e?.message || ''}`);
    } finally {
      setUploading((n) => n - 1);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <PaperClipOutlined /> Файлы решения{files.length ? ` (${files.length})` : ''}
        </Text>
        <Upload multiple accept="image/*,application/pdf" customRequest={customUpload} showUploadList={false}>
          <Button size="small" type="text" icon={<UploadOutlined />} loading={uploading > 0}>
            Загрузить фото / PDF
          </Button>
        </Upload>
      </div>

      {!materialsApi.isConnected() && (
        <Alert
          type="warning"
          showIcon
          message="Хранилище файлов не подключено"
          description="Войдите в разделе «Библиотека материалов», чтобы прикреплять фото решений."
        />
      )}

      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map((f) => (
            <div
              key={f.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px', border: '1px solid #f0f0f0', borderRadius: 6,
              }}
            >
              <span>{KIND_ICON[fileKind(f)]}</span>
              <button
                type="button"
                title={f.title}
                onClick={() => setPreview(f)}
                style={{
                  flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 0,
                  cursor: 'pointer', color: '#1677ff', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: 0,
                }}
              >
                {f.title || 'Файл'}
              </button>
              <Tooltip title="Открыть / скачать">
                <a href={f.url} target="_blank" rel="noreferrer" style={{ color: '#8c8c8c' }}>
                  <DownloadOutlined />
                </a>
              </Tooltip>
              <Popconfirm
                title="Открепить файл от решения?"
                okText="Открепить"
                cancelText="Отмена"
                onConfirm={() => detach(f)}
              >
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          ))}
        </div>
      )}

      <Upload.Dragger
        multiple
        accept="image/*,application/pdf"
        customRequest={customUpload}
        showUploadList={false}
        style={{ padding: '8px 0' }}
      >
        <p style={{ margin: 0, color: '#8c8c8c', fontSize: 13 }}>
          <InboxOutlined style={{ marginRight: 6 }} />
          {uploading > 0 ? `Загружается: ${uploading}…` : 'Перетащите фото решения сюда или нажмите'}
        </p>
      </Upload.Dragger>

      <FilePreviewModal
        open={!!preview}
        record={preview ? { title: preview.title, mime: preview.mime, original_name: preview.title } : null}
        url={preview?.url || ''}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
