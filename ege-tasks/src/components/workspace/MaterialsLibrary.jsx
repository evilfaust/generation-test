/**
 * MaterialsLibrary — «Библиотека материалов» (учительское фло, файловое хранилище).
 *
 * Файлы лежат во втором PocketBase (pb-files на малине, files.l.oipav.ru), а не на
 * VPS. Запись закрыта логином в коллекцию `users` → при первом входе показываем
 * форму «Подключить хранилище» (токен 60 дней, SDK сам продлевает). Чтение публичное.
 *
 * MVP: загрузка с компьютера (drag-drop), поиск, фильтр по категории, удаление.
 * Прикрепление к урокам/заметкам — отдельная фаза (через lessons.materials / links).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Input, Select, Upload, Tag, Popconfirm, Empty, Spin, App,
  Row, Col, Typography, Space, Alert, Tooltip,
} from 'antd';
import {
  InboxOutlined, FileOutlined, FilePdfOutlined, DeleteOutlined, DownloadOutlined,
  SearchOutlined, CloudServerOutlined, DisconnectOutlined, ReloadOutlined, EditOutlined,
} from '@ant-design/icons';
import { materialsApi, CATEGORY_LABELS } from '../../shared/services/pb/filesClient';
import { useAuth } from '../../contexts/AuthContext';
import ConnectForm from './StorageConnect';
import MaterialEditModal from './MaterialEditModal';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

const CATEGORY_COLORS = {
  textbook: 'blue',
  worksheet: 'green',
  generated: 'purple',
  methodical: 'orange',
  reference: 'cyan',
  other: 'default',
};

function humanSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}

function isPdf(rec) {
  return (rec.mime || '').includes('pdf') || /\.pdf$/i.test(rec.original_name || rec.file || '');
}

export default function MaterialsLibrary() {
  const { message } = App.useApp();
  const { canEdit, canDelete } = useAuth();
  const [connected, setConnected] = useState(() => materialsApi.isConnected());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [uploadCategory, setUploadCategory] = useState('other');
  const [uploading, setUploading] = useState(0);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await materialsApi.listMaterials({ search, category, perPage: 100 });
      setItems(res.items || []);
    } catch (e) {
      if (e?.status === 401) {
        materialsApi.disconnect();
        setConnected(false);
      } else {
        message.error(e?.message || 'Не удалось загрузить список');
      }
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    if (connected) load();
  }, [connected, load]);

  if (!connected) {
    return <ConnectForm onConnected={() => setConnected(true)} />;
  }

  const handleDelete = async (rec) => {
    try {
      await materialsApi.deleteMaterial(rec.id);
      setItems((prev) => prev.filter((x) => x.id !== rec.id));
      message.success('Удалено');
    } catch (e) {
      message.error(e?.message || 'Не удалось удалить');
    }
  };

  const customUpload = async ({ file, onSuccess, onError }) => {
    setUploading((n) => n + 1);
    try {
      const rec = await materialsApi.uploadMaterial({
        file,
        title: file.name.replace(/\.[^.]+$/, ''),
        category: uploadCategory,
      });
      onSuccess?.(rec);
      message.success(`Загружено: ${file.name}`);
      setItems((prev) => [rec, ...prev]);
    } catch (e) {
      onError?.(e);
      message.error(`Ошибка загрузки ${file.name}: ${e?.message || ''}`);
    } finally {
      setUploading((n) => n - 1);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <CloudServerOutlined style={{ fontSize: 20 }} />
            <Title level={3} style={{ margin: 0 }}>Библиотека материалов</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Text type="secondary">{materialsApi.connectedEmail()}</Text>
            <Tooltip title="Отключить хранилище на этом устройстве">
              <Button size="small" icon={<DisconnectOutlined />}
                onClick={() => { materialsApi.disconnect(); setConnected(false); }}>
                Отключить
              </Button>
            </Tooltip>
          </Space>
        </Col>
      </Row>

      {canEdit && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space align="center" style={{ marginBottom: 8 }}>
            <Text>Категория при загрузке:</Text>
            <Select size="small" value={uploadCategory} onChange={setUploadCategory}
              options={CATEGORY_OPTIONS} style={{ width: 220 }} />
          </Space>
          <Dragger multiple customRequest={customUpload} showUploadList={false}
            disabled={!canEdit}>
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Перетащите файлы сюда или кликните для выбора</p>
            <p className="ant-upload-hint">
              PDF, учебники, методички — до 500 МБ. {uploading > 0 ? `Загружается: ${uploading}…` : ''}
            </p>
          </Dragger>
        </Card>
      )}

      <Space style={{ marginBottom: 16, width: '100%' }} wrap>
        <Input.Search allowClear placeholder="Поиск по названию / предмету / описанию"
          prefix={<SearchOutlined />} style={{ width: 320 }}
          onSearch={(v) => setSearch(v)} onChange={(e) => { if (!e.target.value) setSearch(''); }} />
        <Select allowClear placeholder="Все категории" value={category || undefined}
          onChange={(v) => setCategory(v || '')} options={CATEGORY_OPTIONS} style={{ width: 220 }} />
        <Button icon={<ReloadOutlined />} onClick={load}>Обновить</Button>
      </Space>

      <Spin spinning={loading}>
        {items.length === 0 ? (
          <Empty description="Пока пусто — загрузите первые материалы" />
        ) : (
          <Row gutter={[12, 12]}>
            {items.map((rec) => (
              <Col xs={24} sm={12} md={8} lg={6} key={rec.id}>
                <Card size="small" hoverable
                  styles={{ body: { padding: 12 } }}
                  actions={[
                    <Tooltip title="Открыть / скачать" key="dl">
                      <a href={materialsApi.fileUrl(rec)} target="_blank" rel="noreferrer">
                        <DownloadOutlined />
                      </a>
                    </Tooltip>,
                    ...(canEdit ? [
                      <Tooltip title="Редактировать" key="edit">
                        <EditOutlined onClick={() => setEditing(rec)} />
                      </Tooltip>,
                    ] : []),
                    ...(canDelete ? [
                      <Popconfirm key="del" title="Удалить файл?" okText="Удалить" cancelText="Отмена"
                        okButtonProps={{ danger: true }} onConfirm={() => handleDelete(rec)}>
                        <DeleteOutlined />
                      </Popconfirm>,
                    ] : []),
                  ]}>
                  {/* flex + minWidth:0 — иначе длинные имена не обрезаются ellipsis */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0, lineHeight: 1 }}>
                      {isPdf(rec)
                        ? <FilePdfOutlined style={{ fontSize: 26, color: '#d4380d' }} />
                        : <FileOutlined style={{ fontSize: 26, color: '#1677ff' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Tooltip title={rec.title || rec.original_name}>
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rec.title || rec.original_name || 'Без названия'}
                        </div>
                      </Tooltip>
                      <Space size={4} wrap style={{ marginTop: 4 }}>
                        <Tag color={CATEGORY_COLORS[rec.category] || 'default'} style={{ margin: 0 }}>
                          {CATEGORY_LABELS[rec.category] || 'Прочее'}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>{humanSize(rec.size)}</Text>
                      </Space>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {!canEdit && (
        <Alert style={{ marginTop: 16 }} type="info" showIcon
          message="Загрузка доступна только редакторам. Вы можете просматривать и скачивать материалы." />
      )}

      <MaterialEditModal
        open={!!editing}
        record={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
      />
    </div>
  );
}
