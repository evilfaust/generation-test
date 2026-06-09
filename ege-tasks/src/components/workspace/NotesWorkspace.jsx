import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  App, Button, DatePicker, Input, List, Popconfirm, Segmented, Select, Space, Tag, Tooltip, Typography,
} from 'antd';
import { DeleteOutlined, InboxOutlined, PlusOutlined, PaperClipOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import MaterialPickerModal from './MaterialPickerModal';
import { EmptyState, Chip, GroupChip } from './ui';
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems } from '@blocknote/core';
import { ru as bnRu } from '@blocknote/core/locales';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { MathBlock, mathSlashItem } from './notesMathBlock';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './NotesWorkspace.css';

const { Text } = Typography;

// Схема BlockNote с кастомным блоком-формулой (LaTeX → KaTeX).
const noteSchema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, math: MathBlock },
});

// Редактор одной заметки. Ключуется по note.id в родителе (полный remount при смене).
function NoteEditor({ note, onSaveBody, editable }) {
  const initialContent = useMemo(
    () => (Array.isArray(note.body) && note.body.length ? note.body : undefined),
    [note.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const editor = useCreateBlockNote({
    schema: noteSchema,
    initialContent,
    dictionary: bnRu,
  });

  const dirtyRef = useRef(null);
  const timer = useRef();

  const flush = useCallback(() => {
    if (dirtyRef.current) {
      onSaveBody(dirtyRef.current);
      dirtyRef.current = null;
    }
  }, [onSaveBody]);

  // Флаш при размонтировании (смена заметки/уход со страницы).
  useEffect(() => () => { clearTimeout(timer.current); flush(); }, [flush]);

  const handleChange = () => {
    dirtyRef.current = editor.document;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  };

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      onChange={editable ? handleChange : undefined}
      slashMenu={false}
    >
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) =>
          filterSuggestionItems(
            [...getDefaultReactSlashMenuItems(editor), mathSlashItem(editor)],
            query,
          )
        }
      />
    </BlockNoteView>
  );
}

export default function NotesWorkspace() {
  const { message } = App.useApp();
  const { canEdit } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const [notes, setNotes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [filter, setFilter] = useState('all'); // all | inbox
  const [groupFilter, setGroupFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async (selectId) => {
    setLoading(true);
    try {
      const [list, g] = await Promise.all([api.getNotes(), api.getTeachingGroups()]);
      setNotes(list);
      setGroups(g);
      const wanted = selectId || searchParams.get('note');
      if (wanted && list.some((n) => n.id === wanted)) setActiveId(wanted);
      else if (!activeId && list.length) setActiveId(list[0].id);
    } catch {
      message.error('Не удалось загрузить заметки');
    } finally {
      setLoading(false);
    }
  }, [activeId, message, searchParams]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Если пришли с ?note=<id> из календаря — выбрать эту заметку.
  useEffect(() => {
    const wanted = searchParams.get('note');
    if (wanted && notes.some((n) => n.id === wanted)) setActiveId(wanted);
  }, [searchParams, notes]);

  const visibleNotes = useMemo(() => {
    let list = notes;
    if (filter === 'inbox') list = list.filter((n) => n.is_inbox);
    if (groupFilter) list = list.filter((n) => n.group === groupFilter);
    return list;
  }, [notes, filter, groupFilter]);

  const active = useMemo(() => notes.find((n) => n.id === activeId) || null, [notes, activeId]);

  const handleNew = async () => {
    try {
      const rec = await api.createNote({ title: '', is_inbox: filter === 'inbox' });
      setNotes((prev) => [rec, ...prev]);
      setActiveId(rec.id);
    } catch {
      message.error('Не удалось создать заметку');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (activeId === id) setActiveId(null);
    } catch {
      message.error('Не удалось удалить');
    }
  };

  // Сохранение тела (из BlockNote).
  const saveBody = useCallback(async (body) => {
    if (!activeId) return;
    try {
      await api.updateNote(activeId, { body });
      setNotes((prev) => prev.map((n) => (n.id === activeId ? { ...n, body } : n)));
      setSavedTick((t) => t + 1);
    } catch {
      message.error('Не удалось сохранить заметку');
    }
  }, [activeId, message]);

  // Заголовок — debounce.
  const titleTimer = useRef();
  const handleTitleChange = (e) => {
    const title = e.target.value;
    setNotes((prev) => prev.map((n) => (n.id === activeId ? { ...n, title } : n)));
    clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(async () => {
      try {
        await api.updateNote(activeId, { title });
        setSavedTick((t) => t + 1);
      } catch { /* тихо */ }
    }, 600);
  };

  const toggleInbox = async () => {
    if (!active) return;
    try {
      const v = !active.is_inbox;
      await api.updateNote(active.id, { is_inbox: v });
      setNotes((prev) => prev.map((n) => (n.id === active.id ? { ...n, is_inbox: v } : n)));
    } catch { message.error('Не удалось'); }
  };

  // Правка метаданных активной заметки (класс/дата).
  const patchActive = async (patch, optimisticExtra = {}) => {
    if (!active) return;
    setNotes((prev) => prev.map((n) => (n.id === active.id ? { ...n, ...patch, ...optimisticExtra } : n)));
    try {
      await api.updateNote(active.id, patch);
      setSavedTick((t) => t + 1);
    } catch { message.error('Не удалось сохранить'); }
  };

  const changeGroup = (gid) => {
    const g = groups.find((x) => x.id === gid);
    patchActive({ group: gid || '' }, { expand: { ...(active?.expand || {}), group: g || undefined } });
  };
  const changeDate = (d) => patchActive({ note_date: d ? d.toISOString() : '' });

  const groupName = (n) => n?.expand?.group?.name;

  return (
    <div className="notes-workspace">
      {/* Левая колонка — список */}
      <div className="notes-sidebar">
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
          <Segmented
            size="small"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Все' },
              { value: 'inbox', label: 'Инбокс' },
            ]}
          />
          {canEdit && (
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={handleNew}>
              Новая
            </Button>
          )}
        </Space>
        <Select
          allowClear
          size="small"
          style={{ width: '100%', marginBottom: 8 }}
          placeholder="Все классы"
          value={groupFilter}
          onChange={setGroupFilter}
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
        />

        <List
          size="small"
          loading={loading}
          dataSource={visibleNotes}
          locale={{ emptyText: <EmptyState title="Нет заметок" description={canEdit ? 'Нажмите «Новая», чтобы начать' : undefined} /> }}
          renderItem={(n) => (
            <List.Item
              className={`notes-item ${n.id === activeId ? 'notes-item--active' : ''}`}
              onClick={() => setActiveId(n.id)}
              actions={canEdit ? [
                <Popconfirm key="d" title="Удалить заметку?" okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }} onConfirm={(e) => { e?.stopPropagation?.(); handleDelete(n.id); }}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                </Popconfirm>,
              ] : []}
            >
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <Space size={6}>
                  {n.is_inbox && <InboxOutlined style={{ color: 'var(--c-amber)' }} />}
                  {n.lesson && <Chip tone="violet" dot={false}>урок</Chip>}
                  <span className="notes-item__title">{n.title?.trim() || 'Без названия'}</span>
                </Space>
                {(groupName(n) || n.note_date) && (
                  <Space size={6}>
                    {groupName(n) && <GroupChip id={n.group} name={groupName(n)} />}
                    {n.note_date && <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(n.note_date).format('DD.MM.YY')}</Text>}
                  </Space>
                )}
              </Space>
            </List.Item>
          )}
        />
      </div>

      {/* Правая колонка — редактор */}
      <div className="notes-editor">
        {!active ? (
          <div className="notes-empty">
            <EmptyState
              title="Ничего не выбрано"
              description="Выберите заметку слева или создайте новую"
              cta={canEdit ? 'Новая заметка' : undefined}
              ctaIcon={<PlusOutlined />}
              onCta={handleNew}
            />
          </div>
        ) : (
          <>
            <div className="notes-editor__header">
              <Input
                variant="borderless"
                className="notes-title-input"
                placeholder="Заголовок заметки"
                value={active.title}
                onChange={handleTitleChange}
                disabled={!canEdit}
                maxLength={200}
              />
              <Space>
                {savedTick > 0 && <Text type="secondary" style={{ fontSize: 12 }}>сохранено</Text>}
                <Tooltip title={active.is_inbox ? 'Убрать из инбокса' : 'В инбокс'}>
                  <Button
                    size="small"
                    type={active.is_inbox ? 'primary' : 'default'}
                    icon={<InboxOutlined />}
                    onClick={toggleInbox}
                    disabled={!canEdit}
                  />
                </Tooltip>
              </Space>
            </div>
            <div className="notes-editor__meta">
              <Select
                allowClear
                size="small"
                style={{ minWidth: 160 }}
                placeholder="Класс / группа"
                value={active.group || undefined}
                onChange={changeGroup}
                disabled={!canEdit}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
              />
              <DatePicker
                size="small"
                format="DD.MM.YYYY"
                placeholder="Дата"
                value={active.note_date ? dayjs(active.note_date) : null}
                onChange={changeDate}
                disabled={!canEdit}
              />
              {active.lesson && <Chip tone="violet" dot={false}>заметка урока</Chip>}
            </div>
            {(() => {
              const allLinks = Array.isArray(active.links) ? active.links : [];
              const files = allLinks.filter((l) => l.type === 'material');
              const saveLinks = (next) => patchActive({ links: [...allLinks.filter((l) => l.type !== 'material'), ...next] });
              return (
                <div className="notes-editor__meta" style={{ flexWrap: 'wrap' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}><PaperClipOutlined /> Файлы:</Text>
                  {files.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>нет</Text>}
                  {files.map((f) => (
                    <Tag key={f.id} closable={canEdit}
                      onClose={(e) => { e.preventDefault(); saveLinks(files.filter((x) => x.id !== f.id)); }}
                      style={{ marginInlineEnd: 0 }}>
                      <a href={f.url} target="_blank" rel="noreferrer"><DownloadOutlined /> {f.title}</a>
                    </Tag>
                  ))}
                  {canEdit && (
                    <Button size="small" type="dashed" icon={<PaperClipOutlined />} onClick={() => setPickerOpen(true)}>
                      Прикрепить
                    </Button>
                  )}
                  <MaterialPickerModal
                    open={pickerOpen}
                    onClose={() => setPickerOpen(false)}
                    existingIds={files.map((f) => f.id)}
                    onPick={(picked) => {
                      const seen = new Set(files.map((x) => x.id));
                      saveLinks([...files, ...picked.filter((p) => !seen.has(p.id))]);
                    }}
                  />
                </div>
              );
            })()}
            <div className="notes-editor__body">
              <NoteEditor key={active.id} note={active} onSaveBody={saveBody} editable={canEdit} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
