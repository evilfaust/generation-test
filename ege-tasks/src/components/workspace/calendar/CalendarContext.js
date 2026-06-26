import { createContext, useContext } from 'react';

/**
 * Контекст календаря — прокидывает обработчики в кастомные компоненты событий
 * react-big-calendar (которому нельзя передать пропсы напрямую в components.event).
 */
export const CalendarContext = createContext({
  onToggleTodo: () => {},
  onSelectEvent: () => {},
  onCreateInSlot: () => {},
  canEdit: false,
  density: 'comfortable',
});

export const useCalendarCtx = () => useContext(CalendarContext);
