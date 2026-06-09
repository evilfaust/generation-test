/**
 * MaterialPickerModal — выбор файлов из «Библиотеки» (pb-files) для прикрепления
 * к уроку (lessons.materials) или заметке (teacher_notes.links).
 *
 * Возвращает массив дескрипторов `{ type:'material', id, title, url }` через onPick.
 * Если хранилище не подключено — показывает форму подключения.
 */
import { useState, useEffect, useCallback } from 'react';
import { Modal, Input, Select, List, Checkbox, Tag, Spin, Empty, Space, Typography, Upload, Button, App } from 'antd';
import { SearchOutlined, FilePdfOutlined, FileOutlined, UploadOutlined } from '@ant-design/icons';
import { materialsApi, CATEGORY_LABELS } from '../../shared/services/pb/filesClient';
import { useAuth } from '../../contexts/AuthContext';
import ConnectForm from './StorageConnect';

const { Text } = Typography;
const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

function isPdf(rec) {
  return (rec.mime || '').includes('pdf') || /\.pdf$/i.test(rec.original_name || rec.file || '');
}

export default function MaterialPickerModal({ open, onClose, onPick, existingIds = [] }) {
  const { message } = App.useApp();
  const { canEdit } = useAuth();
  const [connected, setConnected] = useState(() => materialsApi.isConnected());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState({}); // id → record
  const [uploadCategory, setUploadCategory] = useState('other');
  const [uploading, setUploading] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await materialsApi.listMaterials({ search, category, perPage: 100 });
      setItems(res.items || []);
    } catch (e) {
      if (e?.status === 401) { materialsApi.disconnect(); setConnected(false); }
      else message.error(e?.message || 'Не удалось загрузить список');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    if (open && connected) load();
    if (open) setSelected({});
  }, [open, connected, load]);

  const existing = new Set(existingIds);

  const confirm = () => {
    const picked = Object.values(selected).map((rec) => ({
      type: 'material',
      id: rec.id,
      title: rec.title || rec.original_name || 'Файл',
      url: materialsApi.fileUrl(rec),
    }));
    onPick(picked);
    onClose();
  };

  // Загрузка с компьютера прямо из пикера → файл попадает в Библиотеку и сразу
  // выбирается для прикрепления.
  const customUpload = async ({ file, onSuccess, onError }) => {
    setUploading((n) => n + 1);
    try {
      const rec = await materialsApi.uploadMaterial({
        file,
        title: file.name.replace(/\.[^.]+$/, ''),
        category: uploadCategory,
      });
      setItems((prev) => [rec, ...prev]);
      setSelected((prev) => ({ ...prev, [rec.id]: rec }));
      onSuccess?.(rec);
      message.success(`Загружено: ${file.name}`);
    } catch (e) {
      onError?.(e);
      message.error(`Ошибка загрузки ${file.name}: ${e?.message || ''}`);
    } finally {
      setUploading((n) => n - 1);
    }
  };

  return (
    <Modal
      open={open}
      title="Прикрепить файл из Библиотеки"
      onCancel={onClose}
      onOk={confirm}
      okText={`Прикрепить${Object.keys(selected).length ? ` (${Object.keys(selected).length})` : ''}`}
      cancelText="Отмена"
      okButtonProps={{ disabled: !connected || Object.keys(selected).length === 0 }}
      width={640}
      destroyOnHidden
    >
      {!connected ? (
        <ConnectForm compact onConnected={() => setConnected(true)} />
      ) : (
        <>
          {canEdit && (
            <Space style={{ marginBottom: 12, width: '100%' }} wrap>
              <Upload multiple customRequest={customUpload} showUploadList={false}>
                <Button icon={<UploadOutlined />} loading={uploading > 0}>
                  Загрузить с компьютера{uploading > 0 ? `… (${uploading})` : ''}
                </Button>
              </Upload>
              <Select size="small" value={uploadCategory} onChange={setUploadCategory}
                options={CATEGORY_OPTIONS} style={{ width: 200 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>← категория для загружаемых</Text>
            </Space>
          )}
          <Space style={{ marginBottom: 12, width: '100%' }} wrap>
            <Input.Search allowClear placeholder="Поиск" prefix={<SearchOutlined />}
              style={{ width: 260 }} onSearch={setSearch}
              onChange={(e) => { if (!e.target.value) setSearch(''); }} />
            <Select allowClear placeholder="Все категории" value={category || undefined}
              onChange={(v) => setCategory(v || '')} options={CATEGORY_OPTIONS} style={{ width: 200 }} />
          </Space>
          <Spin spinning={loading}>
            {items.length === 0 ? (
              <Empty description="Нет файлов" />
            ) : (
              <List
                size="small"
                style={{ maxHeight: 360, overflow: 'auto' }}
                dataSource={items}
                renderItem={(rec) => {
                  const already = existing.has(rec.id);
                  const checked = !!selected[rec.id];
                  return (
                    <List.Item
                      style={{ cursor: already ? 'default' : 'pointer', opacity: already ? 0.5 : 1 }}
                      onClick={() => {
                        if (already) return;
                        setSelected((prev) => {
                          const next = { ...prev };
                          if (next[rec.id]) delete next[rec.id]; else next[rec.id] = rec;
                          return next;
                        });
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0 }}>
                        <Checkbox checked={checked || already} disabled={already} style={{ flexShrink: 0 }} />
                        <span style={{ flexShrink: 0, display: 'inline-flex' }}>
                          {isPdf(rec)
                            ? <FilePdfOutlined style={{ color: '#d4380d' }} />
                            : <FileOutlined style={{ color: '#1677ff' }} />}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={rec.title || rec.original_name}>
                          {rec.title || rec.original_name}
                        </span>
                        <Tag style={{ flexShrink: 0, marginInlineEnd: 0 }}>{CATEGORY_LABELS[rec.category] || 'Прочее'}</Tag>
                        {already && <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>прикреплён</Text>}
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </Spin>
        </>
      )}
    </Modal>
  );
}
