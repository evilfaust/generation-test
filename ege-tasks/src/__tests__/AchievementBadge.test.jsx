import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AchievementBadge from '../components/student/AchievementBadge';

const baseAchievement = {
  title: 'Скоростной решатель',
  description: 'Решил за 5 минут',
  rarity: 'rare',
  type: 'random',
  icon: 'speed.png',
};

describe('AchievementBadge', () => {
  it('возвращает null если achievement отсутствует', () => {
    const { container } = render(<AchievementBadge achievement={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('рендерит title и description', () => {
    render(<AchievementBadge achievement={baseAchievement} />);
    expect(screen.getByText('Скоростной решатель')).toBeInTheDocument();
    expect(screen.getByText('Решил за 5 минут')).toBeInTheDocument();
  });

  it('добавляет класс редкости', () => {
    const { container } = render(<AchievementBadge achievement={baseAchievement} />);
    expect(container.firstChild.className).toContain('rare');
  });

  it('legendary редкость отображается как "Легендарный"', () => {
    render(<AchievementBadge achievement={{ ...baseAchievement, rarity: 'legendary' }} />);
    expect(screen.getByText('Легендарный')).toBeInTheDocument();
  });

  it('common редкость отображается как "Обычный"', () => {
    render(<AchievementBadge achievement={{ ...baseAchievement, rarity: 'common' }} />);
    expect(screen.getByText('Обычный')).toBeInTheDocument();
  });

  it('не показывает label редкости для условных достижений', () => {
    render(
      <AchievementBadge
        achievement={{ ...baseAchievement, type: 'condition', rarity: 'rare' }}
      />
    );
    // type='condition' → блок редкости скрыт
    expect(screen.queryByText('Редкий')).not.toBeInTheDocument();
  });

  it('locked=true показывает текст блокировки', () => {
    render(<AchievementBadge achievement={baseAchievement} locked />);
    expect(screen.getByText(/Заблокировано/)).toBeInTheDocument();
  });

  it('locked=true добавляет класс locked', () => {
    const { container } = render(<AchievementBadge achievement={baseAchievement} locked />);
    expect(container.firstChild.className).toContain('locked');
  });

  it('showDetails=false скрывает детали', () => {
    render(<AchievementBadge achievement={baseAchievement} showDetails={false} />);
    expect(screen.queryByText('Скоростной решатель')).not.toBeInTheDocument();
  });

  it('применяет размер small', () => {
    const { container } = render(
      <AchievementBadge achievement={baseAchievement} size="small" />
    );
    expect(container.firstChild.className).toContain('achievement-badge-small');
  });

  it('применяет размер large', () => {
    const { container } = render(
      <AchievementBadge achievement={baseAchievement} size="large" />
    );
    expect(container.firstChild.className).toContain('achievement-badge-large');
  });

  it('рендерит iconURL когда icon указан', () => {
    render(<AchievementBadge achievement={baseAchievement} />);
    const img = document.querySelector('img.achievement-icon');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toContain('speed.png');
  });

  it('без icon показывает fallback TrophyOutlined', () => {
    const { container } = render(
      <AchievementBadge achievement={{ ...baseAchievement, icon: undefined }} />
    );
    expect(container.querySelector('img.achievement-icon')).toBeNull();
    expect(container.querySelector('.trophy-fallback')).not.toBeNull();
  });

  it('по умолчанию visible (animated=false)', () => {
    const { container } = render(<AchievementBadge achievement={baseAchievement} />);
    expect(container.firstChild.className).toContain('visible');
  });
});
