import { Input, Checkbox } from 'antd';
import { SplitLayout, ConfigLabel } from '../../ui';

export function TrigGeneratorLayout({
  icon,
  title,
  onTitleChange,
  titlePlaceholder = 'Название листа',
  left,
  right,
  leftWidth = 340,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingBottom: 12,
        borderBottom: '1px solid var(--rule)',
        marginBottom: 16,
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <Input
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder={titlePlaceholder}
          style={{ flex: 1, fontWeight: 500 }}
        />
      </div>

      <SplitLayout
        leftWidth={leftWidth}
        gap={20}
        style={{ flex: 1 }}
        left={left}
        right={right}
      />
    </div>
  );
}

export function TrigSettingsSection({ label, children, style }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: 'var(--bg-sunken)',
      border: '1px solid var(--rule-soft)',
      borderRadius: 'var(--radius)',
      ...style,
    }}>
      {label ? <ConfigLabel>{label}</ConfigLabel> : null}
      {children}
    </div>
  );
}

/**
 * Заголовок блока категорий с чекбоксом на весь блок. Когда категорий много и
 * они разложены по блокам сложности, учителю чаще нужен блок целиком, а не
 * отдельная категория. Передаётся в `label` у TrigSettingsSection.
 */
export function TrigBlockToggle({ label, keys, categories, onToggleBlock }) {
  const on = keys.filter(k => categories[k]).length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Checkbox
        checked={on === keys.length}
        indeterminate={on > 0 && on < keys.length}
        onChange={e => onToggleBlock(keys, e.target.checked)}
      />
      <span>{label}</span>
    </div>
  );
}

export function TrigActions({ children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {children}
    </div>
  );
}

export function TrigPreviewPane({
  hasData,
  emptyIcon,
  emptyTitle,
  emptyHint,
  summary,
  children,
}) {
  if (!hasData) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--ink-3)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12, color: 'var(--ink-4)' }}>
          {emptyIcon}
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-3)' }}>
          {emptyTitle}
        </div>
        {emptyHint ? (
          <div style={{ fontSize: 12, marginTop: 8, color: 'var(--ink-4)' }}>
            {emptyHint}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
      }}>
        <h2 style={{
          fontSize: 18,
          fontWeight: 600,
          margin: 0,
          letterSpacing: '-0.025em',
          color: 'var(--ink)',
        }}>
          Предпросмотр
        </h2>
        {summary ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
            {summary}
          </div>
        ) : null}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

export function TrigStatBadge({ children, tone = 'default' }) {
  const tones = {
    default: {
      color: 'var(--ink-3)',
      background: 'var(--bg-sunken)',
      border: '1px solid var(--rule)',
    },
    accent: {
      color: 'var(--accent)',
      background: 'var(--accent-soft)',
      border: '1px solid transparent',
    },
    success: {
      color: 'var(--lvl-1)',
      background: 'var(--c-teal-soft)',
      border: '1px solid transparent',
    },
  };

  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 11.5,
      padding: '2px 8px',
      borderRadius: 'var(--radius-sm)',
      whiteSpace: 'nowrap',
      ...tones[tone],
    }}>
      {children}
    </span>
  );
}

export function TrigPreviewCard({ title, meta, children }) {
  return (
    <div style={{
      border: '1px solid var(--rule-soft)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      background: 'var(--bg-raised)',
      marginBottom: 12,
    }}>
      <div style={{
        background: 'var(--bg-sunken)',
        borderBottom: '1px solid var(--rule-soft)',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{title}</span>
        {meta ? (
          <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            {meta}
          </span>
        ) : null}
      </div>
      <div style={{ padding: '10px 14px' }}>
        {children}
      </div>
    </div>
  );
}
