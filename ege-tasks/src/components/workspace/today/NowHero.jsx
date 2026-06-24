import { CheckSquareOutlined, FileOutlined, EditOutlined } from '@ant-design/icons';

/**
 * Hero-карточка «Идёт сейчас» / «Далее».
 * data: { live, startStr, endStr, groupName, groupColor, subject, topic, mats, progressPct }
 */
export default function NowHero({ data, onAttendance, onMaterials, onNote, onFinish }) {
  const { live, startStr, endStr, groupName, groupColor, subject, topic, mats, progressPct } = data;
  return (
    <div className="td-hero">
      <div className="td-hero__glow" />
      <div className="td-hero__inner">
        <div className="td-hero__top">
          {live
            ? <span className="td-hero__pulse" />
            : <span className="td-hero__pulse" style={{ background: '#9FB4FF', boxShadow: 'none', animation: 'none' }} />}
          <span className="td-hero__eyebrow">
            {live ? `Идёт сейчас · до ${endStr}` : `Далее в ${startStr}`}
          </span>
          <span className="td-hero__time">{startStr}–{endStr}</span>
        </div>

        <div className="td-hero__chiprow">
          {groupName && (
            <span className="td-hero__group" style={{ color: groupColor }}>
              <span style={{ color: '#fff' }}>{groupName}</span>
            </span>
          )}
          {subject && <span className="td-hero__subject">{subject}</span>}
        </div>

        <div className="td-hero__topic">{topic || subject || 'Урок'}</div>

        {live && (
          <div className="td-hero__progress">
            <div className="td-hero__progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        )}

        <div className="td-hero__actions" style={live ? undefined : { marginTop: 4 }}>
          <button type="button" className="td-hero__btn td-hero__btn--primary" onClick={onAttendance}>
            <CheckSquareOutlined /> Посещаемость
          </button>
          <button type="button" className="td-hero__btn td-hero__btn--ghost" onClick={onMaterials}>
            <FileOutlined /> Материалы · {mats}
          </button>
          <button type="button" className="td-hero__btn td-hero__btn--ghost" onClick={onNote}>
            <EditOutlined /> Заметка
          </button>
          {live && (
            <button type="button" className="td-hero__btn td-hero__btn--text" onClick={onFinish}>
              Завершить →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
