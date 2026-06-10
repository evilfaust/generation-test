/**
 * Просмотр файла из Библиотеки материалов прямо в приложении.
 * PDF — во встроенном iframe, изображения — <img>, остальное — кнопка «Скачать».
 */
import { Modal, Button, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

const { Text } = Typography;

function fileKind(rec) {
  const mime = (rec?.mime || '').toLowerCase();
  const name = (rec?.original_name || rec?.file || '').toLowerCase();
  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(name)) return 'image';
  return 'other';
}

export default function FilePreviewModal({ open, record, url, onClose }) {
  const kind = record ? fileKind(record) : 'other';
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={920}
      title={record?.title || record?.original_name || 'Просмотр'}
      styles={{ body: { padding: 0, height: '78vh' } }}
      destroyOnHidden
    >
      {kind === 'pdf' && url && (
        <iframe title="preview" src={url} style={{ width: '100%', height: '100%', border: 0 }} />
      )}
      {kind === 'image' && url && (
        <div style={{
          height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'auto', background: 'var(--bg-sunken)',
        }}
        >
          <img src={url} alt={record?.title || ''} style={{ maxWidth: '100%', maxHeight: '100%' }} />
        </div>
      )}
      {(kind === 'other' || !url) && (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Text type="secondary">Предпросмотр недоступен для этого типа файла.</Text>
          {url && (
            <div style={{ marginTop: 12 }}>
              <Button type="primary" icon={<DownloadOutlined />} href={url} target="_blank" rel="noreferrer">
                Скачать
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
