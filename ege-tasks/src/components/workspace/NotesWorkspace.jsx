import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  App, Button, DatePicker, Input, Popconfirm, Segmented, Select, Spin, Tooltip,
} from 'antd';
import {
  ContainerOutlined, DeleteOutlined, FileTextOutlined, InboxOutlined, PaperClipOutlined,
  PlusOutlined, PushpinFilled, PushpinOutlined, SearchOutlined, UndoOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import NoteAttachments from './NoteAttachments';
import { WorkspacePageHeader, EmptyState, Chip, GroupChip } from './ui';
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

// Схема BlockNote с кастомным блоком-формулой (LaTeX → KaTeX).
const noteSchema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, math: MathBlock },
});

// Компактная дата для списка: сегодня → ЧЧ:ММ, вчера, в этом году → ДД.ММ.
function shortDate(iso) {
  if (!iso) return '';
  const d = dayjs(iso);
  if (d.isSame(dayjs(), 'day')) return d.format('HH:mm');
  if (d.isSame(dayjs().subtract(1, 'day'), 'day')) return 'вчера';
  if (d.isSame(dayjs(), 'year')) return d.format('DD.MM');
  return d.format('DD.MM.YY');
}

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

  // Один проход по заметкам: поисковый индекс (lowercase) + сниппет для списка.
  const { textIndex, snippets } = useMemo(() => {
    const idx = new Map();
    const snip = new Map();
    notes.forEach((n) => {
      const body = extractNoteText(n.body);
      idx.set(n.id, `${n.title || ''} ${body}`.toLowerCase());
      snip.set(n.id, body.slice(0, 160));
    });
    return { textIndex: idx, snippets: snip };
  }, [notes]);

  const inboxCount = useMemo(
    () => notes.filter((n) => !n.is_archived && n.is_inbox).length,
    [notes],
  );

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

  // Плоский список для рендера: маркеры секций вперемешку с заметками.
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
      return <div key={n.id} className="notes-section-header">{n.__section}</div>;
    }
    const title = n.title?.trim();
    const snippet = snippets.get(n.id);
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
      <div
        key={n.id}
        className={`notes-item ${n.id === activeId ? 'notes-item--active' : ''}`}
        onClick={() => setActiveId(n.id)}
      >
        <div className="notes-item__titlerow">
          {n.is_pinned && view !== 'archive' && <PushpinFilled className="notes-item__flag" />}
          {n.is_inbox && !n.is_archived && <InboxOutlined className="notes-item__flag" />}
          <span className={`notes-item__title${title ? '' : ' notes-item__title--untitled'}`}>
            {title || 'Без названия'}
          </span>
          {hasFiles(n) && <PaperClipOutlined className="notes-item__clip" />}
        </div>
        {snippet && <div className="notes-item__snippet">{snippet}</div>}
        <div className="notes-item__meta">
          {n.lesson && <Chip tone="violet" dot={false}>урок</Chip>}
          {groupName(n) && <GroupChip id={n.group} name={groupName(n)} />}
          <span className="notes-item__date" title={n.note_date ? `Дата заметки: ${dayjs(n.note_date).format('DD.MM.YYYY')}` : undefined}>
            {n.note_date ? dayjs(n.note_date).format('DD.MM.YY') : shortDate(n.updated)}
          </span>
        </div>
        {actions.length > 0 && <div className="notes-item__actions">{actions}</div>}
      </div>
    );
  };

  const allLinks = Array.isArray(active?.links) ? active.links : [];
  const noteFiles = allLinks.filter((l) => l.type === 'material');

  const segmentedOptions = [
    { value: 'all', label: 'Все' },
    {
      value: 'inbox',
      label: (
        <span>
          Инбокс
          {inboxCount > 0 && <span className="notes-seg-count">{inboxCount}</span>}
        </span>
      ),
    },
    { value: 'archive', label: 'Архив' },
  ];

  return (
    <div>
      <WorkspacePageHeader
        icon={<FileTextOutlined />}
        accent="amber"
        title="Заметки"
        subtitle="Быстрые мысли, планы и заметки уроков — с формулами и вложениями"
        extra={canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleNew}>
            Новая заметка
          </Button>
        )}
      />

      <div className="notes-workspace">
        {/* Левая панель — список */}
        <div className="notes-sidebar">
          <div className="notes-sidebar__tools">
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: 'var(--ink-4)' }} />}
              placeholder="Поиск по заметкам"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            <Segmented block size="small" value={view} onChange={setView} options={segmentedOptions} />
            {groups.length > 0 && (
              <Select
                allowClear
                size="small"
                style={{ width: '100%' }}
                placeholder="Все классы"
                value={groupFilter}
                onChange={setGroupFilter}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
              />
            )}
          </div>

          <div className="notes-sidebar__list">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
            ) : flatList.length === 0 ? (
              <div className="notes-sidebar__empty">
                {view === 'archive'
                  ? <EmptyState title="Архив пуст" description="Сюда попадают заметки вместо удаления" />
                  : (
                    <EmptyState
                      title="Нет заметок"
                      description={canEdit ? 'Создайте первую — она появится здесь' : undefined}
                      cta={canEdit ? 'Новая заметка' : undefined}
                      ctaIcon={<PlusOutlined />}
                      onCta={handleNew}
                    />
                  )}
              </div>
            ) : (
              flatList.map(renderNoteItem)
            )}
          </div>
        </div>

        {/* Правая панель — «лист» заметки */}
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
                <div className="notes-editor__tools">
                  {savedTick > 0 && <span key={savedTick} className="notes-saved">✓ сохранено</span>}
                  <Tooltip title={active.is_pinned ? 'Открепить' : 'Закрепить сверху'}>
                    <Button
                      type="text"
                      icon={active.is_pinned
                        ? <PushpinFilled style={{ color: 'var(--c-amber)' }} />
                        : <PushpinOutlined />}
                      onClick={() => togglePin(active)}
                      disabled={!canEdit}
                    />
                  </Tooltip>
                  <Tooltip title={active.is_inbox ? 'Убрать из инбокса' : 'В инбокс'}>
                    <Button
                      type="text"
                      icon={<InboxOutlined style={active.is_inbox ? { color: 'var(--c-amber)' } : undefined} />}
                      onClick={() => patchActive({ is_inbox: !active.is_inbox })}
                      disabled={!canEdit}
                    />
                  </Tooltip>
                  <Tooltip title={active.is_archived ? 'Вернуть из архива' : 'В архив'}>
                    <Button
                      type="text"
                      icon={active.is_archived ? <UndoOutlined /> : <ContainerOutlined />}
                      onClick={() => archiveNote(active, !active.is_archived)}
                      disabled={!canEdit}
                    />
                  </Tooltip>
                </div>
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
    </div>
  );
}
