import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App, Button, Empty, Input, List, Popconfirm, Segmented, Space, Tag, Tooltip, Typography,
} from 'antd';
import { DeleteOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { ru as bnRu } from '@blocknote/core/locales';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './NotesWorkspace.css';

const { Title, Text } = Typography;

// Редактор одной заметки. Ключуется по note.id в родителе (полный remount при смене).
function NoteEditor({ note, onSaveBody, editable }) {
  const initialContent = useMemo(
    () => (Array.isArray(note.body) && note.body.length ? note.body : undefined),
    [note.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const editor = useCreateBlockNote({
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
    />
  );
}

export default function NotesWorkspace() {
  const { message } = App.useApp();
  const { canEdit } = useAuth();

  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [filter, setFilter] = useState('all'); // all | inbox
  const [loading, setLoading] = useState(false);
  const [savedTick, setSavedTick] = useState(0);

  const load = useCallback(async (selectId) => {
    setLoading(true);
    try {
      const list = await api.getNotes();
      setNotes(list);
      if (selectId) setActiveId(selectId);
      else if (!activeId && list.length) setActiveId(list[0].id);
    } catch {
      message.error('Не удалось загрузить заметки');
    } finally {
      setLoading(false);
    }
  }, [activeId, message]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleNotes = useMemo(
    () => (filter === 'inbox' ? notes.filter((n) => n.is_inbox) : notes),
    [notes, filter],
  );

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

        <List
          size="small"
          loading={loading}
          dataSource={visibleNotes}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет заметок" /> }}
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
              <Space size={6}>
                {n.is_inbox && <InboxOutlined style={{ color: '#fa8c16' }} />}
                <span className="notes-item__title">{n.title?.trim() || 'Без названия'}</span>
              </Space>
            </List.Item>
          )}
        />
      </div>

      {/* Правая колонка — редактор */}
      <div className="notes-editor">
        {!active ? (
          <div className="notes-empty">
            <Empty description="Выберите заметку или создайте новую" />
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
            <div className="notes-editor__body">
              <NoteEditor key={active.id} note={active} onSaveBody={saveBody} editable={canEdit} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
