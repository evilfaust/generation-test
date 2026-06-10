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
  Card, Button, Input, Select, Upload, Popconfirm, Spin, App,
  Row, Col, Typography, Space, Alert, Tooltip, Breadcrumb, Modal, Form,
} from 'antd';
import {
  InboxOutlined, FileOutlined, FilePdfOutlined, DeleteOutlined, DownloadOutlined,
  SearchOutlined, CloudServerOutlined, DisconnectOutlined, ReloadOutlined, EditOutlined,
  EyeOutlined, CopyOutlined, FolderOutlined, FolderAddOutlined, HomeOutlined,
} from '@ant-design/icons';
import { materialsApi, CATEGORY_LABELS } from '../../shared/services/pb/filesClient';
import { useAuth } from '../../contexts/AuthContext';
import ConnectForm from './StorageConnect';
import MaterialEditModal from './MaterialEditModal';
import FilePreviewModal from './FilePreviewModal';
import { childFolders, folderChain } from './folderTree';
import { WorkspacePageHeader, EmptyState, Chip } from './ui';

const { Text } = Typography;
const { Dragger } = Upload;

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

const CATEGORY_TONE = {
  textbook: 'blue',
  worksheet: 'teal',
  generated: 'violet',
  methodical: 'amber',
  reference: 'rose',
  other: 'neutral',
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
  const [previewRec, setPreviewRec] = useState(null);
  // Папки: null = коллекции нет (bootstrap-folders.sh не запускался) → UI без папок.
  const [folders, setFolders] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(''); // '' = корень
  const [folderModal, setFolderModal] = useState(null); // {mode:'create'|'rename', folder?}
  const [folderForm] = Form.useForm();
  const foldersEnabled = Array.isArray(folders);
  // Поиск/фильтр категории работают по всей библиотеке, навигация — внутри папки.
  const globalMode = !!(search || category);

  // Копировать прямой адрес файла в буфер обмена.
  const copyUrl = async (rec) => {
    const url = materialsApi.fileUrl(rec);
    if (!url) { message.error('Нет адреса файла'); return; }
    try {
      await navigator.clipboard.writeText(url);
      message.success('Адрес файла скопирован');
    } catch {
      // Фолбэк для контекстов без Clipboard API.
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        message.success('Адрес файла скопирован');
      } catch {
        message.error('Не удалось скопировать адрес');
      }
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const wantFolders = folders === null;
      const [res, f] = await Promise.all([
        materialsApi.listMaterials({
          search,
          category,
          perPage: 100,
          // Фильтр по папке — только в режиме навигации и если папки включены.
          ...(foldersEnabled && !globalMode ? { folder: currentFolder } : {}),
        }),
        wantFolders ? materialsApi.listFolders() : Promise.resolve(undefined),
      ]);
      setItems(res.items || []);
      if (wantFolders) setFolders(f); // null → папки не включены, array → включены
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
  }, [search, category, currentFolder, foldersEnabled, globalMode, folders]);

  useEffect(() => {
    if (connected) load();
  }, [connected, load]);

  const reloadFolders = async () => {
    try { setFolders(await materialsApi.listFolders()); } catch { /* тихо */ }
  };

  const submitFolderModal = async (v) => {
    try {
      if (folderModal?.mode === 'rename') await materialsApi.renameFolder(folderModal.folder.id, v.name.trim());
      else await materialsApi.createFolder(v.name.trim(), currentFolder);
      setFolderModal(null);
      reloadFolders();
    } catch (e) {
      message.error(e?.message || 'Не удалось сохранить папку');
    }
  };

  const handleDeleteFolder = async (f) => {
    try {
      await materialsApi.deleteFolder(f.id);
      message.success('Папка удалена');
      // PB вычищает ссылки: содержимое оказывается в корне.
      reloadFolders();
      load();
    } catch (e) {
      message.error(e?.message || 'Не удалось удалить папку');
    }
  };

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
        folder: foldersEnabled && !globalMode ? currentFolder : '',
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
      <WorkspacePageHeader
        icon={<CloudServerOutlined />}
        accent="teal"
        title="Библиотека материалов"
        subtitle="Учебники, методички и PDF — в одном месте, под рукой на уроке"
        extra={(
          <>
            <Text type="secondary">{materialsApi.connectedEmail()}</Text>
            <Tooltip title="Отключить хранилище на этом устройстве">
              <Button size="small" icon={<DisconnectOutlined />}
                onClick={() => { materialsApi.disconnect(); setConnected(false); }}>
                Отключить
              </Button>
            </Tooltip>
          </>
        )}
      />

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
        <Input.Search allowClear placeholder="Поиск по всей библиотеке"
          prefix={<SearchOutlined />} style={{ width: 320 }}
          onSearch={(v) => setSearch(v)} onChange={(e) => { if (!e.target.value) setSearch(''); }} />
        <Select allowClear placeholder="Все категории" value={category || undefined}
          onChange={(v) => setCategory(v || '')} options={CATEGORY_OPTIONS} style={{ width: 220 }} />
        <Button icon={<ReloadOutlined />} onClick={load}>Обновить</Button>
      </Space>

      {/* Папки: хлебные крошки + подпапки текущей (вне поиска/фильтра) */}
      {foldersEnabled && !globalMode && (
        <div style={{ marginBottom: 16 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }} wrap>
            <Breadcrumb
              items={[
                {
                  title: (
                    <a onClick={(e) => { e.preventDefault(); setCurrentFolder(''); }}>
                      <HomeOutlined /> Библиотека
                    </a>
                  ),
                },
                ...folderChain(folders, currentFolder).map((c) => ({
                  title: c.id === currentFolder
                    ? c.name
                    : <a onClick={(e) => { e.preventDefault(); setCurrentFolder(c.id); }}>{c.name}</a>,
                })),
              ]}
            />
            {canEdit && (
              <Button size="small" icon={<FolderAddOutlined />} onClick={() => { folderForm.setFieldsValue({ name: '' }); setFolderModal({ mode: 'create' }); }}>
                Новая папка
              </Button>
            )}
          </Space>
          {childFolders(folders, currentFolder).length > 0 && (
            <Row gutter={[12, 12]}>
              {childFolders(folders, currentFolder).map((f) => (
                <Col xs={24} sm={12} md={8} lg={6} key={f.id}>
                  <Card size="small" hoverable styles={{ body: { padding: '8px 12px' } }}
                    onClick={() => setCurrentFolder(f.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FolderOutlined style={{ fontSize: 20, color: 'var(--c-amber, #d48806)', flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }} title={f.name}>
                        {f.name}
                      </span>
                      {canEdit && (
                        <Tooltip title="Переименовать">
                          <Button size="small" type="text" icon={<EditOutlined />}
                            onClick={(e) => { e.stopPropagation(); folderForm.setFieldsValue({ name: f.name }); setFolderModal({ mode: 'rename', folder: f }); }} />
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Popconfirm title="Удалить папку?" description="Файлы и подпапки окажутся в корне"
                          okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }}
                          onConfirm={(e) => { e?.stopPropagation?.(); handleDeleteFolder(f); }}
                          onCancel={(e) => e?.stopPropagation?.()}>
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                        </Popconfirm>
                      )}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </div>
      )}
      {foldersEnabled && globalMode && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message="Поиск и фильтр категорий работают по всей библиотеке (вне папок)" />
      )}

      <Spin spinning={loading}>
        {items.length === 0 ? (
          <EmptyState
            title={foldersEnabled && !globalMode && currentFolder ? 'В этой папке пусто' : 'Пока пусто'}
            description={canEdit
              ? 'Перетащите файлы в область выше — учебники, методички, PDF'
              : 'Материалы ещё не загружены'}
          />
        ) : (
          <Row gutter={[12, 12]}>
            {items.map((rec) => (
              <Col xs={24} sm={12} md={8} lg={6} key={rec.id}>
                <Card size="small" hoverable
                  styles={{ body: { padding: 12 } }}
                  actions={[
                    <Tooltip title="Просмотр" key="prev">
                      <EyeOutlined onClick={() => setPreviewRec(rec)} />
                    </Tooltip>,
                    <Tooltip title="Открыть / скачать" key="dl">
                      <a href={materialsApi.fileUrl(rec)} target="_blank" rel="noreferrer">
                        <DownloadOutlined />
                      </a>
                    </Tooltip>,
                    <Tooltip title="Копировать адрес файла" key="copy">
                      <CopyOutlined onClick={() => copyUrl(rec)} />
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
                      <Tooltip title={`${rec.title || rec.original_name || ''} — нажмите для просмотра`}>
                        <div
                          onClick={() => setPreviewRec(rec)}
                          style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                        >
                          {rec.title || rec.original_name || 'Без названия'}
                        </div>
                      </Tooltip>
                      <Space size={6} wrap style={{ marginTop: 4 }}>
                        <Chip tone={CATEGORY_TONE[rec.category] || 'neutral'}>
                          {CATEGORY_LABELS[rec.category] || 'Прочее'}
                        </Chip>
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
        folders={foldersEnabled ? folders : null}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
          // Файл могли переместить в другую папку — перечитать текущий вид.
          if (foldersEnabled && !globalMode && (updated.folder || '') !== currentFolder) load();
        }}
      />

      {/* Создание / переименование папки */}
      <Modal
        open={!!folderModal}
        title={folderModal?.mode === 'rename' ? 'Переименовать папку' : 'Новая папка'}
        onCancel={() => setFolderModal(null)}
        onOk={() => folderForm.submit()}
        okText="Сохранить"
        cancelText="Отмена"
        destroyOnHidden
      >
        <Form form={folderForm} layout="vertical" onFinish={submitFolderModal} style={{ marginTop: 8 }}>
          <Form.Item name="name" label="Название"
            rules={[{ required: true, whitespace: true, message: 'Введите название' }]}>
            <Input maxLength={200} autoFocus placeholder="Например: 10 класс / Стереометрия" />
          </Form.Item>
        </Form>
      </Modal>

      <FilePreviewModal
        open={!!previewRec}
        record={previewRec}
        url={previewRec ? materialsApi.fileUrl(previewRec) : ''}
        onClose={() => setPreviewRec(null)}
      />
    </div>
  );
}
