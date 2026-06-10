import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  App, Button, DatePicker, Input, List, Popconfirm, Segmented, Select, Space, Tooltip, Typography,
} from 'antd';
import {
  ContainerOutlined, DeleteOutlined, InboxOutlined, PaperClipOutlined, PlusOutlined,
  PushpinFilled, PushpinOutlined, SearchOutlined, UndoOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import NoteAttachments from './NoteAttachments';
import { EmptyState, Chip, GroupChip } from './ui';
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems } from '@blocknote/core';
import { ru as bnRu } from '@blocknote/core/locales';
import { api } from '../../shared/services/pocketbase';
import { materialsApi } from '../../shared/services/pb/filesClient';
import { useAuth } from '../../contexts/AuthContext';
import { MathBlock, mathSlashItem } from './notesMathBlock';
import { extractNoteText } from './notesText';
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
  const { message } = App.useApp();
  const initialContent = useMemo(
    () => (Array.isArray(note.body) && note.body.length ? note.body : undefined),
    [note.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const editor = useCreateBlockNote({
    schema: noteSchema,
    initialContent,
    dictionary: bnRu,
    // Картинки/файлы, вставленные в текст (drag-drop / paste / слеш-меню),
    // уходят в Библиотеку материалов (pb-files) — в body хранится только URL.
    uploadFile: async (file) => {
      if (!materialsApi.isConnected()) {
        message.warning('Хранилище не подключено — войдите в «Библиотеку материалов», чтобы вставлять файлы');
        throw new Error('pb-files not connected');
      }
      const rec = await materialsApi.uploadMaterial({
        file,
        title: file.name.replace(/\.[^.]+$/, ''),
        category: 'other',
      });
      return materialsApi.fileUrl(rec);
    },
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
  const { canEdit, canDelete } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const [notes, setNotes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState('all'); // all | inbox | archive
  const [searchQ, setSearchQ] = useState('');
  const [groupFilter, setGroupFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const [lessonFiles, setLessonFiles] = useState([]); // файлы, прикреплённые к уроку заметки

  const load = useCallback(async (selectId) => {
    setLoading(true);
    try {
      const [list, g] = await Promise.all([api.getNotes(), api.getTeachingGroups()]);
      setNotes(list);
      setGroups(g);
      const wanted = selectId || searchParams.get('note');
      if (wanted && list.some((n) => n.id === wanted)) setActiveId(wanted);
      else if (!activeId && list.length) setActiveId(list.find((n) => !n.is_archived)?.id || null);
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

  const groupName = (n) => n?.expand?.group?.name;

  // Поисковый индекс: id → "заголовок + плоский текст тела" (lowercase).
  const textIndex = useMemo(() => {
    const m = new Map();
    notes.forEach((n) => m.set(n.id, `${n.title || ''} ${extractNoteText(n.body)}`.toLowerCase()));
    return m;
  }, [notes]);

  const visibleNotes = useMemo(() => {
    let list = notes;
    if (view === 'archive') list = list.filter((n) => n.is_archived);
    else {
      list = list.filter((n) => !n.is_archived);
      if (view === 'inbox') list = list.filter((n) => n.is_inbox);
    }
    if (groupFilter) list = list.filter((n) => n.group === groupFilter);
    const q = searchQ.trim().toLowerCase();
    if (q) list = list.filter((n) => (textIndex.get(n.id) || '').includes(q));
    return list;
  }, [notes, view, groupFilter, searchQ, textIndex]);

  // Секции сайдбара: Закреплённые → Инбокс → по классам → Без класса.
  // При поиске/фильтре по классу/в инбоксе и архиве — плоский список (после пина).
  const sections = useMemo(() => {
    if (view === 'archive') return visibleNotes.length ? [{ key: 'arch', title: null, items: visibleNotes }] : [];
    const out = [];
    const pinned = visibleNotes.filter((n) => n.is_pinned);
    const rest = visibleNotes.filter((n) => !n.is_pinned);
    if (pinned.length) out.push({ key: 'pinned', title: 'Закреплённые', items: pinned });
    if (view === 'inbox' || groupFilter || searchQ.trim()) {
      if (rest.length) out.push({ key: 'rest', title: null, items: rest });
      return out;
    }
    const inbox = rest.filter((n) => n.is_inbox);
    if (inbox.length) out.push({ key: 'inbox', title: 'Инбокс', items: inbox });
    const byGroup = new Map();
    const none = [];
    rest.filter((n) => !n.is_inbox).forEach((n) => {
      if (n.group) {
        if (!byGroup.has(n.group)) byGroup.set(n.group, { name: groupName(n) || 'Группа', items: [] });
        byGroup.get(n.group).items.push(n);
      } else none.push(n);
    });
    [...byGroup.entries()].forEach(([gid, g]) => out.push({ key: gid, title: g.name, items: g.items }));
    if (none.length) out.push({ key: 'none', title: out.length ? 'Без класса' : null, items: none });
    return out;
  }, [visibleNotes, view, groupFilter, searchQ]);

  // Плоский dataSource для List: маркеры секций вперемешку с заметками.
  const flatList = useMemo(
    () => sections.flatMap((s) => [
      ...(s.title ? [{ __section: s.title, id: `__s_${s.key}` }] : []),
      ...s.items,
    ]),
    [sections],
  );

  const active = useMemo(() => notes.find((n) => n.id === activeId) || null, [notes, activeId]);

  // Если заметка привязана к уроку — подтянуть файлы, прикреплённые к самому уроку
  // (lesson.materials, тип 'material'). Read-only список рядом с файлами заметки.
  useEffect(() => {
    let cancelled = false;
    const lessonId = active?.lesson;
    if (!lessonId) { setLessonFiles([]); return undefined; }
    api.getLesson(lessonId)
      .then((l) => {
        if (cancelled) return;
        const mats = Array.isArray(l.materials) ? l.materials.filter((m) => m.type === 'material') : [];
        setLessonFiles(mats);
      })
      .catch(() => { if (!cancelled) setLessonFiles([]); });
    return () => { cancelled = true; };
  }, [active?.lesson]);

  const handleNew = async () => {
    try {
      const rec = await api.createNote({ title: '', is_inbox: view === 'inbox' });
      setNotes((prev) => [rec, ...prev]);
      setActiveId(rec.id);
      if (view === 'archive') setView('all');
    } catch {
      message.error('Не удалось создать заметку');
    }
  };

  // Точечный патч любой заметки (оптимистично).
  const patchNote = useCallback(async (id, patch) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    try {
      await api.updateNote(id, patch);
      setSavedTick((t) => t + 1);
    } catch { message.error('Не удалось сохранить'); }
  }, [message]);

  const togglePin = (n) => patchNote(n.id, { is_pinned: !n.is_pinned });

  const archiveNote = (n, archived = true) => {
    patchNote(n.id, { is_archived: archived });
    if (archived && activeId === n.id && view !== 'archive') setActiveId(null);
  };

  // Окончательное удаление — только из архива.
  const handleDeleteForever = async (id) => {
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

  // Правка метаданных активной заметки (класс/дата/инбокс/пин).
  const patchActive = (patch, optimisticExtra = {}) => {
    if (!active) return;
    setNotes((prev) => prev.map((n) => (n.id === active.id ? { ...n, ...optimisticExtra } : n)));
    patchNote(active.id, patch);
  };

  const changeGroup = (gid) => {
    const g = groups.find((x) => x.id === gid);
    patchActive({ group: gid || '' }, { expand: { ...(active?.expand || {}), group: g || undefined } });
  };
  const changeDate = (d) => patchActive({ note_date: d ? d.toISOString() : '' });

  const hasFiles = (n) => Array.isArray(n.links) && n.links.some((l) => l.type === 'material');

  const renderNoteItem = (n) => {
    if (n.__section) {
      return <li key={n.id} className="notes-section-header">{n.__section}</li>;
    }
    const actions = view === 'archive'
      ? [
        ...(canEdit ? [
          <Tooltip key="r" title="Вернуть из архива">
            <Button size="small" type="text" icon={<UndoOutlined />}
              onClick={(e) => { e.stopPropagation(); archiveNote(n, false); }} />
          </Tooltip>,
        ] : []),
        ...(canDelete ? [
          <Popconfirm key="d" title="Удалить заметку навсегда?" okText="Удалить" cancelText="Отмена"
            okButtonProps={{ danger: true }}
            onConfirm={(e) => { e?.stopPropagation?.(); handleDeleteForever(n.id); }}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
          </Popconfirm>,
        ] : []),
      ]
      : (canEdit ? [
        <Tooltip key="p" title={n.is_pinned ? 'Открепить' : 'Закрепить'}>
          <Button size="small" type="text"
            icon={n.is_pinned ? <PushpinFilled style={{ color: 'var(--c-amber)' }} /> : <PushpinOutlined />}
            onClick={(e) => { e.stopPropagation(); togglePin(n); }} />
        </Tooltip>,
        <Tooltip key="a" title="В архив">
          <Button size="small" type="text" icon={<ContainerOutlined />}
            onClick={(e) => { e.stopPropagation(); archiveNote(n); }} />
        </Tooltip>,
      ] : []);

    return (
      <List.Item
        className={`notes-item ${n.id === activeId ? 'notes-item--active' : ''}`}
        onClick={() => setActiveId(n.id)}
        actions={actions}
      >
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Space size={6}>
            {n.is_inbox && !n.is_archived && <InboxOutlined style={{ color: 'var(--c-amber)' }} />}
            {n.lesson && <Chip tone="violet" dot={false}>урок</Chip>}
            <span className="notes-item__title">{n.title?.trim() || 'Без названия'}</span>
            {hasFiles(n) && <PaperClipOutlined style={{ color: 'var(--ant-color-text-tertiary, #999)', fontSize: 12 }} />}
          </Space>
          {(groupName(n) || n.note_date) && (
            <Space size={6}>
              {groupName(n) && <GroupChip id={n.group} name={groupName(n)} />}
              {n.note_date && <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(n.note_date).format('DD.MM.YY')}</Text>}
            </Space>
          )}
        </Space>
      </List.Item>
    );
  };

  const allLinks = Array.isArray(active?.links) ? active.links : [];
  const noteFiles = allLinks.filter((l) => l.type === 'material');

  return (
    <div className="notes-workspace">
      {/* Левая колонка — список */}
      <div className="notes-sidebar">
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
          <Segmented
            size="small"
            value={view}
            onChange={setView}
            options={[
              { value: 'all', label: 'Все' },
              { value: 'inbox', label: 'Инбокс' },
              { value: 'archive', label: 'Архив' },
            ]}
          />
          {canEdit && (
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={handleNew}>
              Новая
            </Button>
          )}
        </Space>
        <Input
          allowClear
          size="small"
          style={{ marginBottom: 8 }}
          prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-tertiary, #999)' }} />}
          placeholder="Поиск по заметкам"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
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
          dataSource={flatList}
          locale={{
            emptyText: view === 'archive'
              ? <EmptyState title="Архив пуст" description="Сюда попадают заметки вместо удаления" />
              : <EmptyState title="Нет заметок" description={canEdit ? 'Нажмите «Новая», чтобы начать' : undefined} />,
          }}
          renderItem={renderNoteItem}
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
                <Tooltip title={active.is_pinned ? 'Открепить' : 'Закрепить сверху'}>
                  <Button
                    size="small"
                    type={active.is_pinned ? 'primary' : 'default'}
                    icon={active.is_pinned ? <PushpinFilled /> : <PushpinOutlined />}
                    onClick={() => togglePin(active)}
                    disabled={!canEdit}
                  />
                </Tooltip>
                <Tooltip title={active.is_inbox ? 'Убрать из инбокса' : 'В инбокс'}>
                  <Button
                    size="small"
                    type={active.is_inbox ? 'primary' : 'default'}
                    icon={<InboxOutlined />}
                    onClick={() => patchActive({ is_inbox: !active.is_inbox })}
                    disabled={!canEdit}
                  />
                </Tooltip>
                <Tooltip title={active.is_archived ? 'Вернуть из архива' : 'В архив'}>
                  <Button
                    size="small"
                    icon={active.is_archived ? <UndoOutlined /> : <ContainerOutlined />}
                    onClick={() => archiveNote(active, !active.is_archived)}
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
              {active.is_archived && <Chip tone="neutral" dot={false}>в архиве</Chip>}
            </div>
            <NoteAttachments
              noteFiles={noteFiles}
              lessonFiles={lessonFiles}
              canEdit={canEdit}
              onSave={(next) => patchActive({ links: [...allLinks.filter((l) => l.type !== 'material'), ...next] })}
            />
            <div className="notes-editor__body">
              <NoteEditor key={active.id} note={active} onSaveBody={saveBody} editable={canEdit} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
