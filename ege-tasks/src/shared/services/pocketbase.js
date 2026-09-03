// API-сервис Lemma — тонкий barrel-реэкспорт.
// Реализация разбита по доменам в ./pb/*.js (см. CLAUDE.md). Места вызова не
// меняются: импортируйте { api } и/или default (pb) как раньше.
//
// Сборка api = spread всех доменных объектов. `this.X` внутри методов
// резолвится на этот объединённый объект (порядок доменов = порядок исходного
// файла, поэтому дубль-ключ getTasksByIds сохраняет прежнее поведение).
import { pb } from './pb/client.js';
import { extrasApi } from './pb/extras.js';
import { topicsApi } from './pb/topics.js';
import { tasksApi } from './pb/tasks.js';
import { catalogApi } from './pb/catalog.js';
import { worksApi } from './pb/works.js';
import { theoryApi } from './pb/theory.js';
import { sessionsApi } from './pb/sessions.js';
import { answersApi } from './pb/answers.js';
import { achievementsApi } from './pb/achievements.js';
import { studentsApi } from './pb/students.js';
import { geometryApi } from './pb/geometry.js';
import { tdfApi } from './pb/tdf.js';
import { worksheetsApi } from './pb/worksheets.js';
import { groupsApi } from './pb/groups.js';
import { ktpApi } from './pb/ktp.js';
import { lessonsApi } from './pb/lessons.js';
import { notesApi } from './pb/notes.js';
import { todosApi, todoFoldersApi } from './pb/todos.js';
import { extJournalApi } from './pb/extjournal.js';
import { programsApi } from './pb/programs.js';
import { campaignsApi } from './pb/campaigns.js';
import { attendanceApi } from './pb/attendance.js';
import { listkiApi } from './pb/listki.js';
import { coursesApi } from './pb/courses.js';
import { sheetsApi } from './pb/sheets.js';

export const api = {
  ...extrasApi,
  ...topicsApi,
  ...tasksApi,
  ...catalogApi,
  ...worksApi,
  ...theoryApi,
  ...sessionsApi,
  ...answersApi,
  ...achievementsApi,
  ...studentsApi,
  ...geometryApi,
  ...tdfApi,
  ...worksheetsApi,
  ...groupsApi,
  ...ktpApi,
  ...lessonsApi,
  ...notesApi,
  ...todosApi,
  ...todoFoldersApi,
  ...extJournalApi,
  ...programsApi,
  ...campaignsApi,
  ...attendanceApi,
  ...listkiApi,
  ...coursesApi,
  ...sheetsApi,
};

// Заголовок авторизации для ИИ-ручек pdf-service (см. pb/client.js).
export { aiHeaders } from './pb/client.js';

export default pb;
