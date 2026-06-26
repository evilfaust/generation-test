import { Button, Checkbox, Progress, Tooltip } from 'antd';
import {
  DoubleRightOutlined, CalendarOutlined, TeamOutlined, PlusOutlined,
  ExportOutlined, LinkOutlined, FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import NoteAttachments from '../NoteAttachments';
import { GroupChip } from '../ui';

// Инициалы из имени для аватара ученика.
function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function Eyebrow({ children, extra }) {
  return (
    <div className="nc-eyebrow">
      <span>{children}</span>
      {extra}
    </div>
  );
}

export default function NoteContextPanel({
  note, lesson, lessonFiles, noteFiles, backlinks, checkItems, canEdit,
  wordCount, readMin, onCollapse, onOpenLesson, onAddStudents, onToggleCheck,
  onExportTasks, onSaveAttachments, onOpenNote,
}) {
  const studentLinks = Array.isArray(note.links)
    ? note.links.filter((l) => l.type === 'student')
    : [];
  const doneCount = checkItems.filter((c) => c.checked).length;
  const openItems = checkItems.filter((c) => !c.checked);

  return (
    <div className="notes-context">
      <div className="notes-context__head">
        <span className="notes-context__title">Контекст</span>
        <Tooltip title="Свернуть панель">
          <Button type="text" size="small" icon={<DoubleRightOutlined />} onClick={onCollapse} />
        </Tooltip>
      </div>

      <div className="notes-context__body">
        {/* 4.1 Урок */}
        <section className="nc-section">
          <Eyebrow>Урок</Eyebrow>
          {note.lesson && lesson ? (
            <div className="nc-lesson">
              <div className="nc-lesson__row">
                {(lesson.expand?.group?.name || lesson._groupName)
                  ? <GroupChip id={lesson.group} name={lesson.expand?.group?.name || lesson._groupName} />
                  : <span className="nc-muted">{lesson.title || 'Урок'}</span>}
              </div>
              {lesson.date_plan && (
                <div className="nc-lesson__date">
                  <CalendarOutlined /> {dayjs(lesson.date_plan).format('DD.MM.YYYY')}
                </div>
              )}
              <Button size="small" type="link" className="nc-lesson__open"
                onClick={() => onOpenLesson(note.lesson)}>
                Открыть урок →
              </Button>
            </div>
          ) : (
            <div className="nc-muted">Не привязана к уроку</div>
          )}
        </section>

        {/* 4.2 Ученики группы */}
        {note.group && (
          <section className="nc-section">
            <Eyebrow extra={canEdit && (
              <Button type="text" size="small" icon={<PlusOutlined />} onClick={onAddStudents}>
                отметить
              </Button>
            )}>
              Ученики
            </Eyebrow>
            {studentLinks.length ? (
              <div className="nc-students">
                {studentLinks.map((s) => (
                  <span key={s.id} className="nc-student" title={s.name}>
                    <span className="nc-student__ava">{initials(s.name)}</span>
                    <span className="nc-student__name">{s.name}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="nc-muted">Никто не отмечен</div>
            )}
          </section>
        )}

        {/* 4.3 Задачи из заметки */}
        {checkItems.length > 0 && (
          <section className="nc-section">
            <Eyebrow extra={(
              <span className="nc-progress-label">{doneCount} / {checkItems.length}</span>
            )}>
              Задачи из заметки
            </Eyebrow>
            <Progress
              percent={Math.round((doneCount / checkItems.length) * 100)}
              showInfo={false}
              size="small"
              strokeColor="var(--c-teal)"
            />
            <div className="nc-tasks">
              {checkItems.map((c) => (
                <label key={c.blockId} className={`nc-task${c.checked ? ' nc-task--done' : ''}`}>
                  <Checkbox
                    checked={c.checked}
                    disabled={!canEdit}
                    onChange={() => onToggleCheck(c.blockId)}
                  />
                  <span className="nc-task__text">{c.text || '(пусто)'}</span>
                </label>
              ))}
            </div>
            {canEdit && openItems.length > 0 && (
              <Button size="small" icon={<ExportOutlined />} block onClick={onExportTasks}
                className="nc-tasks__export">
                В «Дела» ({openItems.length})
              </Button>
            )}
          </section>
        )}

        {/* 4.4 Вложения (NoteAttachments рисует свою шапку с заголовком и счётчиком) */}
        <section className="nc-section nc-section--attach">
          <NoteAttachments
            noteFiles={noteFiles}
            lessonFiles={lessonFiles}
            canEdit={canEdit}
            onSave={onSaveAttachments}
          />
        </section>

        {/* 4.5 Связанные / бэклинки */}
        {backlinks.length > 0 && (
          <section className="nc-section">
            <Eyebrow>Связанные</Eyebrow>
            <div className="nc-links">
              {backlinks.map((b) => (
                <button key={b.id} type="button" className="nc-link" onClick={() => onOpenNote(b.id)}>
                  <LinkOutlined /> {b.title?.trim() || 'Без названия'}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 4.6 История */}
        <section className="nc-section">
          <Eyebrow>История</Eyebrow>
          <div className="nc-history">
            {note.updated && <div>Изменено {dayjs(note.updated).format('DD.MM.YYYY HH:mm')}</div>}
            {note.created && <div>Создано {dayjs(note.created).format('DD.MM.YYYY')}</div>}
            {wordCount > 0 && <div className="nc-muted">{wordCount} слов · ~{readMin} мин чтения</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
