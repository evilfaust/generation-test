import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Modal, Form, Input, InputNumber, Checkbox, AutoComplete,
  List, Tag, Empty, Spin, Popconfirm, Tooltip, Switch, App,
} from 'antd';
import {
  SaveOutlined, FolderOpenOutlined, DeleteOutlined, PushpinFilled,
} from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import { sheetGeneratorLabel, sheetGeneratorRoute } from '../../utils/sheetRegistry';

const { TextArea } = Input;

// Кнопки «Сохранить лист» / «Загрузить» для генераторов + обе модалки.
// Ставится внутрь <TrigActions>; модалки уходят в портал, поэтому место
// в дереве значения не имеет.
//
// Лист сохраняется в `generator_sheets` целиком (настройки + задания + порядок),
// в банк задач при этом ничего не пишется.
export function SheetStorageActions({ storage, hasData, generator }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [saveOpen, setSaveOpen] = useState(false);
  const [form] = Form.useForm();
  const [folders, setFolders] = useState([]);
  const [allGenerators, setAllGenerators] = useState(false);

  const {
    sheetId, sheetTitle, saving, list, listLoading, listOpen, setListOpen,
    openList, loadList, loadSheet, save, saveAsNew, deleteSheet,
  } = storage;

  useEffect(() => {
    if (!saveOpen) return;
    api.getGeneratorSheetFolders().then(setFolders).catch(() => {});
  }, [saveOpen]);

  const handleQuickUpdate = async () => {
    try {
      await save();
      message.success('Лист обновлён');
    } catch (error) {
      message.error(`Не удалось сохранить: ${error?.message || 'ошибка'}`);
    }
  };

  const handleSaveNew = async () => {
    const values = await form.validateFields();
    try {
      await saveAsNew({
        title: values.title,
        folder: values.folder || '',
        note: values.note || '',
        classNumber: values.classNumber || 0,
        isPinned: !!values.isPinned,
      });
      setSaveOpen(false);
      message.success('Лист сохранён');
    } catch (error) {
      message.error(`Не удалось сохранить: ${error?.message || 'ошибка'}`);
    }
  };

  const handleOpen = async (item) => {
    if (item.generator !== generator) {
      // Лист другого генератора открываем на его же странице
      const route = sheetGeneratorRoute(item.generator);
      if (!route) {
        message.warning('Генератор этого листа больше не существует');
        return;
      }
      setListOpen(false);
      navigate(`${route}?sheet=${item.id}`);
      return;
    }
    try {
      await loadSheet(item.id);
      message.success(`Лист «${item.title}» загружен`);
    } catch (error) {
      message.error(`Не удалось открыть лист: ${error?.message || 'ошибка'}`);
    }
  };

  return (
    <>
      {sheetId ? (
        <>
          <Button
            block
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleQuickUpdate}
            disabled={!hasData}
          >
            Обновить «{sheetTitle || 'лист'}»
          </Button>
          <Button
            block
            size="small"
            type="text"
            onClick={() => setSaveOpen(true)}
            disabled={!hasData}
          >
            Сохранить как новый
          </Button>
        </>
      ) : (
        <Button
          block
          icon={<SaveOutlined />}
          onClick={() => setSaveOpen(true)}
          disabled={!hasData}
        >
          Сохранить лист
        </Button>
      )}

      <Button block icon={<FolderOpenOutlined />} onClick={openList}>
        Загрузить лист
      </Button>

      {/* ── Сохранение ── */}
      <Modal
        open={saveOpen}
        title="Сохранить лист"
        onCancel={() => setSaveOpen(false)}
        onOk={handleSaveNew}
        confirmLoading={saving}
        okText="Сохранить"
        cancelText="Отмена"
        destroyOnHidden
      >
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
          Сохраняются задания всех вариантов, настройки листа и порядок заданий.
          В банк задач ничего не добавляется.
        </div>
        <Form form={form} layout="vertical" initialValues={{ title: sheetTitle }}>
          <Form.Item
            name="title"
            label="Название"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Например: Линейные уравнения, 7А, входной" autoFocus />
          </Form.Item>
          <Form.Item name="folder" label="Папка">
            <AutoComplete
              allowClear
              placeholder="Необязательно: 7 класс, Осень 2026…"
              options={folders.map((f) => ({ value: f }))}
              filterOption={(input, option) =>
                option.value.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="classNumber" label="Класс">
            <InputNumber min={1} max={11} placeholder="—" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="note" label="Заметка">
            <TextArea
              rows={2}
              placeholder="Чем этот лист удачен, кому выдавался…"
              maxLength={2000}
            />
          </Form.Item>
          <Form.Item name="isPinned" valuePropName="checked">
            <Checkbox>Закрепить наверху списка</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Список сохранённых ── */}
      <Modal
        open={listOpen}
        title="Сохранённые листы"
        onCancel={() => setListOpen(false)}
        footer={null}
        width={640}
        destroyOnHidden
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        }}>
          <Switch
            size="small"
            checked={allGenerators}
            onChange={(v) => { setAllGenerators(v); loadList({ allGenerators: v }); }}
          />
          <span style={{ fontSize: 13 }}>Показать листы всех генераторов</span>
        </div>

        {listLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
        ) : list.length === 0 ? (
          <Empty description="Сохранённых листов пока нет" />
        ) : (
          <List
            size="small"
            dataSource={list}
            style={{ maxHeight: 420, overflowY: 'auto' }}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button key="open" type="link" size="small" onClick={() => handleOpen(item)}>
                    {item.generator === generator ? 'Открыть' : 'Перейти'}
                  </Button>,
                  <Popconfirm
                    key="del"
                    title="Удалить лист?"
                    description="Задания этого листа пропадут — восстановить будет нечем."
                    okText="Удалить"
                    cancelText="Отмена"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deleteSheet(item.id)}
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <span>
                      {item.is_pinned && (
                        <PushpinFilled style={{ color: 'var(--accent)', marginRight: 6 }} />
                      )}
                      {item.title}
                      {item.id === sheetId && (
                        <Tag color="green" style={{ marginLeft: 8 }}>открыт</Tag>
                      )}
                    </span>
                  }
                  description={
                    <span style={{ fontSize: 12 }}>
                      {allGenerators && (
                        <Tag style={{ marginRight: 6 }}>{sheetGeneratorLabel(item.generator)}</Tag>
                      )}
                      {item.variants_count || 0} вар. × {item.questions_count || 0} зад.
                      {item.folder && <Tag style={{ marginLeft: 6 }}>{item.folder}</Tag>}
                      {item.class_number ? ` · ${item.class_number} кл.` : ''}
                      {' · '}
                      <Tooltip title={new Date(item.created).toLocaleString('ru-RU')}>
                        {new Date(item.created).toLocaleDateString('ru-RU')}
                      </Tooltip>
                      {item.note ? ` · ${item.note.slice(0, 60)}` : ''}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </>
  );
}

export default SheetStorageActions;
