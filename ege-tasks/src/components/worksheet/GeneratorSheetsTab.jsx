import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Input, Select, Tag, Tooltip, Spin, Modal, Form,
  AutoComplete, InputNumber, Checkbox, App,
} from 'antd';
import {
  DeleteOutlined, EditOutlined, SearchOutlined, ExperimentOutlined,
  PushpinOutlined, PushpinFilled, FolderOutlined, ExportOutlined,
} from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import {
  sheetGeneratorLabel, sheetGeneratorRoute, SHEET_GENERATORS,
} from '../../utils/sheetRegistry';

const { TextArea } = Input;

// Вкладка «Листы генераторов» в «Моих работах».
//
// Лист генератора — отдельная сущность (`generator_sheets`): снимок настроек и
// заданий устного счёта, уравнений, тригонометрии. В банке задач их нет
// намеренно — иначе каталог экзаменационных задач зарос бы «2x = 18».
// Открытие ведёт обратно в тот генератор, который лист сделал.
export function GeneratorSheetsTab() {
  const { message, modal } = App.useApp();
  const { canEdit, canDelete } = useAuth();
  const navigate = useNavigate();

  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [generatorFilter, setGeneratorFilter] = useState(null);
  const [folderFilter, setFolderFilter] = useState(null);
  const [editSheet, setEditSheet] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSheets(await api.getGeneratorSheets());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const folders = useMemo(
    () => [...new Set(sheets.map(s => s.folder).filter(Boolean))].sort(),
    [sheets],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sheets.filter(s => (
      (!generatorFilter || s.generator === generatorFilter)
      && (!folderFilter || s.folder === folderFilter)
      && (!q || (s.title || '').toLowerCase().includes(q)
             || (s.note || '').toLowerCase().includes(q))
    ));
  }, [sheets, search, generatorFilter, folderFilter]);

  const openSheet = (item) => {
    const route = sheetGeneratorRoute(item.generator);
    if (!route) {
      message.warning('Генератор этого листа больше не существует');
      return;
    }
    navigate(`${route}?sheet=${item.id}`);
  };

  const togglePin = async (item) => {
    try {
      await api.updateGeneratorSheet(item.id, { is_pinned: !item.is_pinned });
      setSheets(prev => prev
        .map(s => (s.id === item.id ? { ...s, is_pinned: !item.is_pinned } : s))
        .sort((a, b) => (Number(b.is_pinned) - Number(a.is_pinned))
          || (new Date(b.created) - new Date(a.created))));
    } catch (error) {
      message.error(`Не удалось изменить: ${error?.message || 'ошибка'}`);
    }
  };

  const handleDelete = (item) => {
    modal.confirm({
      title: `Удалить лист «${item.title}»?`,
      content: 'Задания этого листа пропадут — восстановить будет нечем.',
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        await api.deleteGeneratorSheet(item.id);
        setSheets(prev => prev.filter(s => s.id !== item.id));
        message.success('Лист удалён');
      },
    });
  };

  const openEdit = (item) => {
    setEditSheet(item);
    form.setFieldsValue({
      title: item.title,
      folder: item.folder || undefined,
      classNumber: item.class_number || undefined,
      note: item.note || '',
    });
  };

  const saveEdit = async () => {
    const values = await form.validateFields();
    try {
      const patch = {
        title: values.title,
        folder: values.folder || '',
        class_number: values.classNumber || 0,
        note: values.note || '',
      };
      await api.updateGeneratorSheet(editSheet.id, patch);
      setSheets(prev => prev.map(s => (s.id === editSheet.id ? { ...s, ...patch } : s)));
      setEditSheet(null);
      message.success('Сохранено');
    } catch (error) {
      message.error(`Не удалось сохранить: ${error?.message || 'ошибка'}`);
    }
  };

  return (
    <div className="wm-mc-list">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Поиск по названию и заметке"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <Select
          allowClear
          placeholder="Генератор"
          value={generatorFilter}
          onChange={setGeneratorFilter}
          style={{ minWidth: 220 }}
          options={[...new Set(sheets.map(s => s.generator))].map(g => ({
            value: g,
            label: `${sheetGeneratorLabel(g)}${SHEET_GENERATORS[g] ? '' : ' (неизвестный)'}`,
          }))}
        />
        {folders.length > 0 && (
          <Select
            allowClear
            placeholder="Папка"
            value={folderFilter}
            onChange={setFolderFilter}
            style={{ minWidth: 160 }}
            options={folders.map(f => ({ value: f, label: f }))}
          />
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : visible.length === 0 ? (
        <div className="wm-empty">
          <div className="wm-empty-icon"><ExperimentOutlined /></div>
          <div className="wm-empty-text">
            {sheets.length === 0 ? 'Сохранённых листов пока нет' : 'Ничего не найдено'}
          </div>
          <div className="wm-empty-hint">
            Сформируйте лист в генераторе (устный счёт, уравнения, тригонометрия)
            и нажмите «Сохранить лист»
          </div>
        </div>
      ) : (
        visible.map(item => (
          <div key={item.id} className="wm-work-card">
            <div className="wm-work-card-header" onClick={() => openSheet(item)}>
              <div className="wm-work-card-expand"><ExportOutlined /></div>
              <div className="wm-work-card-main">
                <div className="wm-work-card-title">
                  {item.is_pinned && (
                    <PushpinFilled style={{ color: 'var(--accent)', marginRight: 6 }} />
                  )}
                  {item.title || 'Без названия'}
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    {sheetGeneratorLabel(item.generator)}
                  </Tag>
                </div>
                <div className="wm-work-card-meta">
                  <span className="wm-work-card-date">
                    {new Date(item.created).toLocaleDateString('ru-RU', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                  <Tag style={{ margin: 0 }}>Вариантов: {item.variants_count || 0}</Tag>
                  <Tag style={{ margin: 0 }}>Заданий: {item.questions_count || 0}</Tag>
                  {item.class_number ? (
                    <Tag style={{ margin: 0 }}>{item.class_number} кл.</Tag>
                  ) : null}
                  {item.folder && (
                    <Tag style={{ margin: 0 }} icon={<FolderOutlined />}>{item.folder}</Tag>
                  )}
                  {item.note && (
                    <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                      {item.note.slice(0, 80)}
                    </span>
                  )}
                </div>
              </div>
              <div className="wm-work-card-actions" onClick={e => e.stopPropagation()}>
                <Tooltip title={item.is_pinned ? 'Открепить' : 'Закрепить наверху'}>
                  <Button
                    type="text" size="small"
                    icon={item.is_pinned ? <PushpinFilled /> : <PushpinOutlined />}
                    onClick={() => togglePin(item)}
                  />
                </Tooltip>
                {canEdit && (
                  <Tooltip title="Название, папка, заметка">
                    <Button
                      type="text" size="small" icon={<EditOutlined />}
                      onClick={() => openEdit(item)}
                    />
                  </Tooltip>
                )}
                {canDelete && (
                  <Tooltip title="Удалить">
                    <Button
                      type="text" size="small" danger icon={<DeleteOutlined />}
                      onClick={() => handleDelete(item)}
                    />
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      <Modal
        open={!!editSheet}
        title="Лист генератора"
        onCancel={() => setEditSheet(null)}
        onOk={saveEdit}
        okText="Сохранить"
        cancelText="Отмена"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="Название"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="folder" label="Папка">
            <AutoComplete
              allowClear
              options={folders.map(f => ({ value: f }))}
              placeholder="Необязательно"
            />
          </Form.Item>
          <Form.Item name="classNumber" label="Класс">
            <InputNumber min={1} max={11} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="note" label="Заметка">
            <TextArea rows={2} maxLength={2000} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default GeneratorSheetsTab;
