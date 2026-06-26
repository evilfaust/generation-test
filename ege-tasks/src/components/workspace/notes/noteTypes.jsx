import {
  FileTextOutlined, ProfileOutlined, BulbOutlined, PhoneOutlined, EyeOutlined,
} from '@ant-design/icons';

// Типы заметок (редизайн «Заметки»). value — хранится в teacher_notes.type.
// tone — тон чипа/иконки из палитры tokens.css. Icon — AntD-иконка.
export const NOTE_TYPES = [
  { value: 'lesson', label: 'Урок', tone: 'violet', Icon: FileTextOutlined },
  { value: 'plan', label: 'План', tone: 'blue', Icon: ProfileOutlined },
  { value: 'idea', label: 'Идея', tone: 'amber', Icon: BulbOutlined },
  { value: 'call', label: 'Звонок', tone: 'rose', Icon: PhoneOutlined },
  { value: 'obs', label: 'Наблюдение', tone: 'teal', Icon: EyeOutlined },
];

const BY_VALUE = Object.fromEntries(NOTE_TYPES.map((t) => [t.value, t]));

// Тип заметки с дефолтом: если не задан — «урок» для привязанных к уроку, иначе «идея».
export function noteTypeMeta(note) {
  const explicit = note?.type && BY_VALUE[note.type];
  if (explicit) return explicit;
  return note?.lesson ? BY_VALUE.lesson : BY_VALUE.idea;
}

export function typeMetaByValue(value) {
  return BY_VALUE[value] || BY_VALUE.idea;
}
