/**
 * Человечное пустое состояние: дружелюбный текст + опциональный призыв к действию.
 * Заменяет пассивные <Empty description="…пусто" /> по разделу.
 */
import { Button, Empty, Typography } from 'antd';

const { Text } = Typography;

export default function EmptyState({
  title,
  description,
  cta,
  ctaIcon,
  onCta,
  ctaType = 'primary',
  image = Empty.PRESENTED_IMAGE_SIMPLE,
  children,
}) {
  return (
    <Empty
      image={image}
      styles={{ image: { height: 56 } }}
      description={
        <div>
          {title && <div style={{ fontWeight: 600, color: 'var(--ink-2)', marginBottom: 2 }}>{title}</div>}
          {description && <Text type="secondary">{description}</Text>}
        </div>
      }
    >
      {cta && (
        <Button type={ctaType} icon={ctaIcon} onClick={onCta} style={{ marginTop: 4 }}>
          {cta}
        </Button>
      )}
      {children}
    </Empty>
  );
}
