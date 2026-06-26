import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  App, Button, DatePicker, Dropdown, Input, Popconfirm, Segmented, Select, Spin, Tooltip,
} from 'antd';
import {
  ContainerOutlined, DeleteOutlined, FileTextOutlined, InboxOutlined, PaperClipOutlined,
  PlusOutlined, PushpinFilled, PushpinOutlined, SearchOutlined, UndoOutlined, TeamOutlined,
  ThunderboltOutlined, DownOutlined, BoldOutlined, FontSizeOutlined, UnorderedListOutlined,
  CheckSquareOutlined, FunctionOutlined, PictureOutlined, TableOutlined, ExportOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import InsertStudentsModal from './InsertStudentsModal';
import { WorkspacePageHeader, EmptyState, Chip, GroupChip } from './ui';
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems, insertOrUpdateBlock } from '@blocknote/core';
import { ru as bnRu } from '@blocknote/core/locales';
import { api } from '../../shared/services/pocketbase';
import { materialsApi } from '../../shared/services/pb/filesClient';
import { useAuth } from '../../contexts/AuthContext';
import { MathBlock, mathSlashItem } from './notesMathBlock';
import { extractNoteText, extractCheckItems } from './notesText';
import { NOTE_TYPES, noteTypeMeta } from './notes/noteTypes';
import NoteContextPanel from './notes/NoteContextPanel';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './NotesWorkspace.css';

const noteSchema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, math: MathBlock },
});

const RAIL_KEY = 'notes.railCollapsed';

// Компактная дата для списка.
function shortDate(iso) {
  if (!iso) return '';
  const d = dayjs(iso);
  if (d.isSame(dayjs(), 'day')) return d.format('HH:mm');
  if (d.isSame(dayjs().subtract(1, 'day'), 'day')) return 'вчера';
  if (d.isSame(dayjs(), 'year')) return d.format('DD.MM');
  return d.format('DD.MM.YY');
}

// Стартовый шаблон тела по типу заметки (для split-button «Новая заметка»).
function starterBody(type) {
  if (type === 'plan') {
    return [
      { type: 'heading', props: { level: 3 }, content: 'План' },
      { type: 'checkListItem', props: { checked: false }, content: 'Первый пункт' },
    ];
  }
  if (type === 'call') {
    return [
      { type: 'heading', props: { level: 3 }, content: 'Кому' },
      { type: 'paragraph', content: '' },
      { type: 'heading', props: { level: 3 }, content: 'Итог' },
      { type: 'paragraph', content: '' },
    ];
  }
  return undefined;
}

// Рекурсивная инверсия checked у чек-айтема по id (иммутабельно).
function flipCheck(blocks, blockId) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((b) => {
    if (b.id === blockId && b.type === 'checkListItem') {
      return { ...b, props: { ...(b.props || {}), checked: !b.props?.checked } };
    }
    if (Array.isArray(b.children)) {
      const children = flipCheck(b.children, blockId);
      if (children !== b.children) return { ...b, children };
    }
    return b;
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

// ── Редактор одной заметки (BlockNote) + тулбар форматирования. ──
const NoteEditor = forwardRef(function NoteEditor(
  { note, onSaveBody, editable, onTagStudents, wordCount, readMin }, ref,
) {
  const { message } = App.useApp();
  const [studentsModalOpen, setStudentsModalOpen] = useState(false);
  const initialContent = useMemo(
    () => (Array.isArray(note.body) && note.body.length ? note.body : undefined),
    [note.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const editor = useCreateBlockNote({
    schema: noteSchema,
    initialContent,
    dictionary: bnRu,
    uploadFile: async (file) => {
      if (!materialsApi.isConnected()) {
        message.warning('Хранилище не подключено — войдите в «Библиотеку материалов», чтобы вставлять файлы');
        throw new Error('pb-files not connected');
      }
      const rec = await materialsApi.uploadMaterial({
        file, title: file.name.replace(/\.[^.]+$/, ''), category: 'other',
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

  useEffect(() => () => { clearTimeout(timer.current); flush(); }, [flush]);

  const handleChange = () => {
    dirtyRef.current = editor.document;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  };

  // Вставка/конвертация блока по позиции курсора.
  const insert = (spec, convertIfEmpty = true) => {
    if (!editor) return;
    const cur = editor.getTextCursorPosition().block;
    const isEmpty = cur.type === 'paragraph'
      && (!cur.content || (Array.isArray(cur.content) && cur.content.length === 0));
    if (convertIfEmpty && isEmpty) editor.updateBlock(cur, spec);
    else editor.insertBlocks([spec], cur, 'after');
    editor.focus();
  };

  const insertStudents = (selected) => {
    setStudentsModalOpen(false);
    if (!selected.length) return;
    const blocks = [];
    selected.forEach((s) => {
      blocks.push({ type: 'heading', props: { level: 3 }, content: s.name || s.username });
      blocks.push({ type: 'paragraph', content: '' });
    });
    const doc = editor.document;
    const refBlock = doc[doc.length - 1];
    editor.insertBlocks(blocks, refBlock, 'after');
    onSaveBody(editor.document);
    onTagStudents?.(selected);
    message.success(`Добавлено учеников: ${selected.length}`);
  };

  // API наружу — для контекст-панели (отметить учеников) и шапки (экспорт PDF).
  useImperativeHandle(ref, () => ({
    requestInsertStudents: () => setStudentsModalOpen(true),
    exportPdf: async () => {
      try {
        const html = await editor.blocksToHTMLLossy(editor.document);
        const wrap = document.createElement('div');
        wrap.style.cssText = 'padding:24px;max-width:780px;font-family:Geist,system-ui,sans-serif;color:#0D1321';
        wrap.innerHTML = `<h1 style="font-size:24px">${escapeHtml(note.title || 'Заметка')}</h1>${html}`;
        const mod = await import('html2pdf.js');
        const html2pdf = mod.default || mod;
        await html2pdf().set({
          margin: 12,
          filename: `${(note.title || 'note').slice(0, 40) || 'note'}.pdf`,
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        }).from(wrap).save();
      } catch {
        message.error('Не удалось экспортировать заметку');
      }
    },
  }), [editor, note.title]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="note-editor-wrap">
      {editable && (
        <div className="note-editor-toolbar">
          <Tooltip title="Подзаголовок">
            <Button size="small" type="text" icon={<FontSizeOutlined />}
              onClick={() => insert({ type: 'heading', props: { level: 2 } })} />
          </Tooltip>
          <Tooltip title="Жирный">
            <Button size="small" type="text" icon={<BoldOutlined />}
              onClick={() => { editor.toggleStyles({ bold: true }); editor.focus(); }} />
          </Tooltip>
          <Tooltip title="Список">
            <Button size="small" type="text" icon={<UnorderedListOutlined />}
              onClick={() => insert({ type: 'bulletListItem' })} />
          </Tooltip>
          <Tooltip title="Чек-лист">
            <Button size="small" type="text" icon={<CheckSquareOutlined />}
              onClick={() => insert({ type: 'checkListItem', props: { checked: false } })} />
          </Tooltip>
          <Tooltip title="Формула (LaTeX)">
            <Button size="small" type="text" icon={<FunctionOutlined />}
              onClick={() => { insertOrUpdateBlock(editor, { type: 'math', props: { formula: '' } }); editor.focus(); }} />
          </Tooltip>
          <Tooltip title="Изображение">
            <Button size="small" type="text" icon={<PictureOutlined />}
              onClick={() => insert({ type: 'image' })} />
          </Tooltip>
          <Tooltip title="Таблица">
            <Button size="small" type="text" icon={<TableOutlined />}
              onClick={() => insert({
                type: 'table',
                content: { type: 'tableContent', rows: [{ cells: [[], []] }, { cells: [[], []] }] },
              }, false)} />
          </Tooltip>
          <span className="note-editor-toolbar__sep" />
          <Tooltip title={note.group ? 'Разделы по ученикам группы' : 'У заметки не указана группа'}>
            <Button size="small" type="text" icon={<TeamOutlined />} disabled={!note.group}
              onClick={() => setStudentsModalOpen(true)}>
              Ученики
            </Button>
          </Tooltip>
          <span className="note-editor-toolbar__count">
            {wordCount} слов · ~{readMin} мин · «/» команды
          </span>
        </div>
      )}
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
      <InsertStudentsModal
        open={studentsModalOpen}
        groupId={note.group}
        onCancel={() => setStudentsModalOpen(false)}
        onConfirm={insertStudents}
      />
    </div>
  );
});

export default function NotesWorkspace() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { canEdit, canDelete } = useAuth();

  const [searchParams] = useSearchParams();
  const [notes, setNotes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState('all'); // all | inbox | archive
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [groupFilter, setGroupFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const [lessonFiles, setLessonFiles] = useState([]);
  const [lessonObj, setLessonObj] = useState(null);
  const [backlinks, setBacklinks] = useState([]);
  const [quickDraft, setQuickDraft] = useState('');
  const [flashId, setFlashId] = useState(null);
  const [editorRev, setEditorRev] = useState(0);
  const [railCollapsed, setRailCollapsed] = useState(
    () => localStorage.getItem(RAIL_KEY) === '1',
  );
  const editorRef = useRef(null);

  const toggleRail = () => setRailCollapsed((v) => {
    const next = !v;
    localStorage.setItem(RAIL_KEY, next ? '1' : '0');
    return next;
  });

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

  useEffect(() => {
    const wanted = searchParams.get('note');
    if (wanted && notes.some((n) => n.id === wanted)) setActiveId(wanted);
  }, [searchParams, notes]);

  const groupName = (n) => n?.expand?.group?.name;

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
    if (typeFilter !== 'all') list = list.filter((n) => noteTypeMeta(n).value === typeFilter);
    const q = searchQ.trim().toLowerCase();
    if (q) list = list.filter((n) => (textIndex.get(n.id) || '').includes(q));
    return list;
  }, [notes, view, groupFilter, typeFilter, searchQ, textIndex]);

  const sections = useMemo(() => {
    if (view === 'archive') return visibleNotes.length ? [{ key: 'arch', title: null, items: visibleNotes }] : [];
    const out = [];
    const pinned = visibleNotes.filter((n) => n.is_pinned);
    const rest = visibleNotes.filter((n) => !n.is_pinned);
    if (pinned.length) out.push({ key: 'pinned', title: 'Закреплённые', items: pinned });
    if (rest.length) out.push({ key: 'rest', title: pinned.length ? 'Недавние' : null, items: rest });
    return out;
  }, [visibleNotes, view]);

  const flatList = useMemo(
    () => sections.flatMap((s) => [
      ...(s.title ? [{ __section: s.title, id: `__s_${s.key}` }] : []),
      ...s.items,
    ]),
    [sections],
  );

  const active = useMemo(() => notes.find((n) => n.id === activeId) || null, [notes, activeId]);

  const checkItems = useMemo(() => extractCheckItems(active?.body), [active?.body]);
  const wordCount = useMemo(() => {
    const t = extractNoteText(active?.body);
    return t ? t.split(/\s+/).filter(Boolean).length : 0;
  }, [active?.body]);
  const readMin = Math.max(1, Math.round(wordCount / 180));

  // Файлы + объект привязанного урока (для контекст-панели).
  useEffect(() => {
    let cancelled = false;
    const lessonId = active?.lesson;
    if (!lessonId) { setLessonFiles([]); setLessonObj(null); return undefined; }
    api.getLesson(lessonId)
      .then((l) => {
        if (cancelled) return;
        const mats = Array.isArray(l.materials) ? l.materials.filter((m) => m.type === 'material') : [];
        setLessonFiles(mats);
        setLessonObj({ ...l, _groupName: groups.find((g) => g.id === l.group)?.name });
      })
      .catch(() => { if (!cancelled) { setLessonFiles([]); setLessonObj(null); } });
    return () => { cancelled = true; };
  }, [active?.lesson, groups]);

  // Бэклинки активной заметки.
  useEffect(() => {
    let cancelled = false;
    if (!activeId) { setBacklinks([]); return undefined; }
    api.getNoteBacklinks(activeId)
      .then((b) => { if (!cancelled) setBacklinks(b); })
      .catch(() => { if (!cancelled) setBacklinks([]); });
    return () => { cancelled = true; };
  }, [activeId]);

  const handleNew = async (type) => {
    try {
      const rec = await api.createNote({
        title: '',
        is_inbox: type === 'idea' ? true : view === 'inbox',
        ...(type ? { type, body: starterBody(type) } : {}),
      });
      setNotes((prev) => [rec, ...prev]);
      setActiveId(rec.id);
      if (view === 'archive') setView('all');
    } catch {
      message.error('Не удалось создать заметку');
    }
  };

  const handleQuickCapture = async () => {
    const text = quickDraft.trim();
    if (!text) return;
    try {
      const rec = await api.createNote({ title: text, type: 'idea', is_inbox: true });
      setNotes((prev) => [rec, ...prev]);
      setQuickDraft('');
      setFlashId(rec.id);
      setTimeout(() => setFlashId((id) => (id === rec.id ? null : id)), 1600);
    } catch {
      message.error('Не удалось записать мысль');
    }
  };

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

  const handleDeleteForever = async (id) => {
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (activeId === id) setActiveId(null);
    } catch {
      message.error('Не удалось удалить');
    }
  };

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

  const tagStudents = useCallback((students) => {
    if (!active) return;
    const existing = Array.isArray(active.links) ? active.links : [];
    const seen = new Set(existing.filter((l) => l.type === 'student').map((l) => l.id));
    const additions = students
      .filter((s) => !seen.has(s.id))
      .map((s) => ({ type: 'student', id: s.id, name: s.name || s.username }));
    if (!additions.length) return;
    patchNote(active.id, { links: [...existing, ...additions] });
  }, [active, patchNote]);

  // Тоггл чек-айтема из контекст-панели → правка тела + ремоунт редактора.
  const toggleCheck = useCallback((blockId) => {
    if (!active) return;
    const newBody = flipCheck(active.body || [], blockId);
    setNotes((prev) => prev.map((n) => (n.id === active.id ? { ...n, body: newBody } : n)));
    setEditorRev((r) => r + 1);
    api.updateNote(active.id, { body: newBody })
      .then(() => setSavedTick((t) => t + 1))
      .catch(() => message.error('Не удалось сохранить'));
  }, [active, message]);

  const exportTasks = useCallback(async () => {
    if (!active) return;
    const open = extractCheckItems(active.body).filter((c) => !c.checked);
    if (!open.length) return;
    try {
      const created = await api.exportNoteTasks(active, open);
      message.success(created.length ? `В «Дела» добавлено: ${created.length}` : 'Все пункты уже выгружены');
    } catch {
      message.error('Не удалось выгрузить в «Дела»');
    }
  }, [active, message]);

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
    const m = noteTypeMeta(n);
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
        className={`notes-item ${n.id === activeId ? 'notes-item--active' : ''}${n.id === flashId ? ' notes-item--flash' : ''}`}
        onClick={() => setActiveId(n.id)}
      >
        <div className="notes-item__titlerow">
          <m.Icon className="notes-item__typeicon" style={{ color: `var(--c-${m.tone})` }} />
          {n.is_pinned && view !== 'archive' && <PushpinFilled className="notes-item__flag" />}
          {n.is_inbox && !n.is_archived && <InboxOutlined className="notes-item__flag" />}
          <span className={`notes-item__title${title ? '' : ' notes-item__title--untitled'}`}>
            {title || 'Без названия'}
          </span>
          {hasFiles(n) && <PaperClipOutlined className="notes-item__clip" />}
        </div>
        {snippet && <div className="notes-item__snippet">{snippet}</div>}
        <div className="notes-item__meta">
          <Chip tone={m.tone} dot={false}>{m.label}</Chip>
          {groupName(n) && <GroupChip id={n.group} name={groupName(n)} />}
          <span className="notes-item__date">
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

  const typeChips = [{ value: 'all', label: 'Все', tone: 'neutral' }, ...NOTE_TYPES];

  const newMenuItems = NOTE_TYPES.map((t) => ({ key: t.value, icon: <t.Icon />, label: `${t.label}` }));

  const activeMeta = active ? noteTypeMeta(active) : null;

  return (
    <div className="notes-page">
      <WorkspacePageHeader
        icon={<FileTextOutlined />}
        accent="amber"
        title="Заметки"
        subtitle="Быстрые мысли, планы и заметки уроков — с формулами и вложениями"
        extra={canEdit && (
          <Dropdown.Button
            type="primary"
            icon={<DownOutlined />}
            onClick={() => handleNew()}
            menu={{ items: newMenuItems, onClick: ({ key }) => handleNew(key) }}
          >
            <PlusOutlined /> Новая заметка
          </Dropdown.Button>
        )}
      />

      <div className="notes-workspace">
        {/* ── Панель 1 — список ── */}
        <div className="notes-sidebar">
          <div className="notes-sidebar__tools">
            {canEdit && (
              <div className="notes-quick">
                <ThunderboltOutlined className="notes-quick__icon" />
                <Input
                  variant="borderless"
                  className="notes-quick__input"
                  placeholder="Быстро записать мысль…"
                  value={quickDraft}
                  onChange={(e) => setQuickDraft(e.target.value)}
                  onPressEnter={handleQuickCapture}
                />
                <span className="notes-quick__hint">↵ инбокс</span>
              </div>
            )}
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: 'var(--ink-4)' }} />}
              placeholder="Поиск по заметкам"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            <Segmented block size="small" value={view} onChange={setView} options={segmentedOptions} />
            <div className="notes-typechips">
              {typeChips.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`notes-typechip${typeFilter === t.value ? ' notes-typechip--active' : ''}`}
                  onClick={() => setTypeFilter(t.value)}
                >
                  {t.value !== 'all' && <span className="notes-typechip__dot" style={{ background: `var(--c-${t.tone})` }} />}
                  {t.label}
                </button>
              ))}
            </div>
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
                      onCta={() => handleNew()}
                    />
                  )}
              </div>
            ) : (
              flatList.map(renderNoteItem)
            )}
          </div>
        </div>

        {/* ── Панель 2 — редактор ── */}
        <div className="notes-editor">
          {!active ? (
            <div className="notes-empty">
              <EmptyState
                title="Ничего не выбрано"
                description="Выберите заметку слева или создайте новую"
                cta={canEdit ? 'Новая заметка' : undefined}
                ctaIcon={<PlusOutlined />}
                onCta={() => handleNew()}
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
                    <Button type="text"
                      icon={active.is_pinned ? <PushpinFilled style={{ color: 'var(--c-amber)' }} /> : <PushpinOutlined />}
                      onClick={() => togglePin(active)} disabled={!canEdit} />
                  </Tooltip>
                  <Tooltip title={active.is_inbox ? 'Убрать из инбокса' : 'В инбокс'}>
                    <Button type="text"
                      icon={<InboxOutlined style={active.is_inbox ? { color: 'var(--c-amber)' } : undefined} />}
                      onClick={() => patchActive({ is_inbox: !active.is_inbox })} disabled={!canEdit} />
                  </Tooltip>
                  <Tooltip title="Экспорт в PDF">
                    <Button type="text" icon={<ExportOutlined />}
                      onClick={() => editorRef.current?.exportPdf()} />
                  </Tooltip>
                  <Tooltip title={active.is_archived ? 'Вернуть из архива' : 'В архив'}>
                    <Button type="text"
                      icon={active.is_archived ? <UndoOutlined /> : <ContainerOutlined />}
                      onClick={() => archiveNote(active, !active.is_archived)} disabled={!canEdit} />
                  </Tooltip>
                  <Tooltip title={railCollapsed ? 'Показать контекст' : 'Скрыть контекст'}>
                    <Button type="text"
                      icon={railCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                      onClick={toggleRail} />
                  </Tooltip>
                </div>
              </div>
              <div className="notes-editor__meta">
                {activeMeta && (
                  <Dropdown
                    trigger={['click']}
                    disabled={!canEdit}
                    menu={{
                      items: NOTE_TYPES.map((t) => ({ key: t.value, icon: <t.Icon />, label: t.label })),
                      onClick: ({ key }) => patchActive({ type: key }),
                    }}
                  >
                    <button type="button" className="notes-type-pill" data-tone={activeMeta.tone} disabled={!canEdit}>
                      <activeMeta.Icon /> {activeMeta.label} <DownOutlined style={{ fontSize: 9 }} />
                    </button>
                  </Dropdown>
                )}
                <Select
                  allowClear size="small" style={{ minWidth: 160 }}
                  placeholder="Класс / группа"
                  value={active.group || undefined}
                  onChange={changeGroup} disabled={!canEdit}
                  options={groups.map((g) => ({ value: g.id, label: g.name }))}
                />
                <DatePicker
                  size="small" format="DD.MM.YYYY" placeholder="Дата"
                  value={active.note_date ? dayjs(active.note_date) : null}
                  onChange={changeDate} disabled={!canEdit}
                />
                {active.is_archived && <Chip tone="neutral" dot={false}>в архиве</Chip>}
              </div>
              <div className="notes-editor__body">
                <NoteEditor
                  key={`${active.id}:${editorRev}`}
                  ref={editorRef}
                  note={active}
                  onSaveBody={saveBody}
                  editable={canEdit}
                  onTagStudents={tagStudents}
                  wordCount={wordCount}
                  readMin={readMin}
                />
              </div>
            </>
          )}
        </div>

        {/* ── Панель 3 — контекст ── */}
        {active && !railCollapsed && (
          <NoteContextPanel
            note={active}
            lesson={lessonObj}
            lessonFiles={lessonFiles}
            noteFiles={noteFiles}
            backlinks={backlinks}
            checkItems={checkItems}
            canEdit={canEdit}
            wordCount={wordCount}
            readMin={readMin}
            onCollapse={toggleRail}
            onOpenLesson={() => navigate('/app/calendar')}
            onAddStudents={() => editorRef.current?.requestInsertStudents()}
            onToggleCheck={toggleCheck}
            onExportTasks={exportTasks}
            onSaveAttachments={(next) => patchActive({ links: [...allLinks.filter((l) => l.type !== 'material'), ...next] })}
            onOpenNote={(id) => setActiveId(id)}
          />
        )}
      </div>
    </div>
  );
}
