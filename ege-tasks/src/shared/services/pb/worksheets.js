import { pb, _logAudit, withOwner, andOwner } from './client.js';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';

export const worksheetsApi = {
  async getQrWorksheets() {
    try {
      return await pb.collection('qr_worksheets').getFullList({
        sort: '-created',
        expand: 'tasks',
        filter: andOwner(),
      });
    } catch (error) {
      console.error('Error fetching qr_worksheets:', error);
      return [];
    }
  },

  async createQrWorksheet(data) {
    try {
      return await pb.collection('qr_worksheets').create(withOwner(data));
    } catch (error) {
      console.error('Error creating qr_worksheet:', error);
      throw error;
    }
  },

  async updateQrWorksheet(id, data) {
    try {
      return await pb.collection('qr_worksheets').update(id, data);
    } catch (error) {
      console.error('Error updating qr_worksheet:', error);
      throw error;
    }
  },

  async deleteQrWorksheet(id) {
    try {
      return await pb.collection('qr_worksheets').delete(id);
    } catch (error) {
      console.error('Error deleting qr_worksheet:', error);
      throw error;
    }
  },

  // --- pixel_art_worksheets ---

  // Лёгкий список для модала загрузки (без matrix/grid и без expand задач)
  async getPixelArtWorksheets() {
    try {
      return await pb.collection('pixel_art_worksheets').getFullList({
        sort: '-created',
        fields: 'id,title,grid_cols,grid_rows,threshold,two_sheets,show_teacher_key,two_columns,custom_answers,created,tasks',
        filter: andOwner(),
      });
    } catch (error) {
      console.error('Error fetching pixel_art_worksheets:', error);
      return [];
    }
  },

  // Полная загрузка одной записи (с matrix/grid и expand задач) — вызывается при клике «Загрузить»
  async getPixelArtWorksheet(id) {
    try {
      return await pb.collection('pixel_art_worksheets').getOne(id, {
        expand: 'tasks',
      });
    } catch (error) {
      console.error('Error fetching pixel_art_worksheet:', error);
      throw error;
    }
  },

  async createPixelArtWorksheet(data) {
    try {
      return await pb.collection('pixel_art_worksheets').create(withOwner(data));
    } catch (error) {
      console.error('Error creating pixel_art_worksheet:', error);
      throw error;
    }
  },

  async updatePixelArtWorksheet(id, data) {
    try {
      return await pb.collection('pixel_art_worksheets').update(id, data);
    } catch (error) {
      console.error('Error updating pixel_art_worksheet:', error);
      throw error;
    }
  },

  async deletePixelArtWorksheet(id) {
    try {
      return await pb.collection('pixel_art_worksheets').delete(id);
    } catch (error) {
      console.error('Error deleting pixel_art_worksheet:', error);
      throw error;
    }
  },

  // --- pixel_art_images (library) ---

  async getPixelArtImages() {
    try {
      return await pb.collection('pixel_art_images').getFullList({
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching pixel_art_images:', error);
      return [];
    }
  },

  async createPixelArtImage(data) {
    try {
      return await pb.collection('pixel_art_images').create(data);
    } catch (error) {
      console.error('Error creating pixel_art_image:', error);
      throw error;
    }
  },

  async updatePixelArtImage(id, data) {
    try {
      return await pb.collection('pixel_art_images').update(id, data);
    } catch (error) {
      console.error('Error updating pixel_art_image:', error);
      throw error;
    }
  },

  async deletePixelArtImage(id) {
    try {
      return await pb.collection('pixel_art_images').delete(id);
    } catch (error) {
      console.error('Error deleting pixel_art_image:', error);
      throw error;
    }
  },

  // --- pixel_art_team_sets + pixel_art_team_tiles ---

  async getPixelArtTeamSets() {
    try {
      return await pb.collection('pixel_art_team_sets').getFullList({ sort: '-created', filter: andOwner() });
    } catch (error) {
      console.error('Error fetching pixel_art_team_sets:', error);
      return [];
    }
  },

  async getPixelArtTeamSet(id) {
    try {
      return await pb.collection('pixel_art_team_sets').getOne(id);
    } catch (error) {
      console.error('Error fetching pixel_art_team_set:', error);
      throw error;
    }
  },

  async getTasksByIds(ids) {
    if (!ids.length) return [];
    try {
      const filter = ids.map(id => `id="${id}"`).join(' || ');
      return await pb.collection('tasks').getFullList({ filter });
    } catch (error) {
      console.error('Error fetching tasks by ids:', error);
      return [];
    }
  },

  async createPixelArtTeamSet(data) {
    try {
      return await pb.collection('pixel_art_team_sets').create(withOwner(data));
    } catch (error) {
      console.error('Error creating pixel_art_team_set:', error);
      throw error;
    }
  },

  async updatePixelArtTeamSet(id, data) {
    try {
      return await pb.collection('pixel_art_team_sets').update(id, data);
    } catch (error) {
      console.error('Error updating pixel_art_team_set:', error);
      throw error;
    }
  },

  async deletePixelArtTeamSet(id) {
    try {
      return await pb.collection('pixel_art_team_sets').delete(id);
    } catch (error) {
      console.error('Error deleting pixel_art_team_set:', error);
      throw error;
    }
  },

  async getPixelArtTeamTiles(teamSetId) {
    try {
      return await pb.collection('pixel_art_team_tiles').getFullList({
        filter: `team_set="${teamSetId}"`,
        sort: 'tile_index',
      });
    } catch (error) {
      console.error('Error fetching pixel_art_team_tiles:', error);
      return [];
    }
  },

  async upsertPixelArtTeamTile(teamSetId, tileIndex, data) {
    try {
      const existing = await pb.collection('pixel_art_team_tiles').getFirstListItem(
        `team_set="${teamSetId}" && tile_index=${tileIndex}`
      ).catch(() => null);
      if (existing) {
        return await pb.collection('pixel_art_team_tiles').update(existing.id, data);
      }
      return await pb.collection('pixel_art_team_tiles').create({ team_set: teamSetId, tile_index: tileIndex, ...data });
    } catch (error) {
      console.error('Error upserting pixel_art_team_tile:', error);
      throw error;
    }
  },

  // --- route_sheets ---

  async getRouteSheets() {
    try {
      return await pb.collection('route_sheets').getFullList({
        sort: '-created',
        expand: 'tasks',
        filter: andOwner(),
      });
    } catch (error) {
      console.error('Error fetching route_sheets:', error);
      return [];
    }
  },

  async createRouteSheet(data) {
    try {
      return await pb.collection('route_sheets').create(withOwner(data));
    } catch (error) {
      console.error('Error creating route_sheet:', error);
      throw error;
    }
  },

  async updateRouteSheet(id, data) {
    try {
      return await pb.collection('route_sheets').update(id, data);
    } catch (error) {
      console.error('Error updating route_sheet:', error);
      throw error;
    }
  },

  async deleteRouteSheet(id) {
    try {
      return await pb.collection('route_sheets').delete(id);
    } catch (error) {
      console.error('Error deleting route_sheet:', error);
      throw error;
    }
  },

  // --- unit_circle_worksheets ---

  async getUnitCircleWorksheets() {
    try {
      return await pb.collection('unit_circle_worksheets').getFullList({
        sort: '-created',
        filter: andOwner(),
      });
    } catch (error) {
      console.error('Error fetching unit_circle_worksheets:', error);
      return [];
    }
  },

  async createUnitCircleWorksheet(data) {
    try {
      return await pb.collection('unit_circle_worksheets').create(withOwner(data));
    } catch (error) {
      console.error('Error creating unit_circle_worksheet:', error);
      throw error;
    }
  },

  async updateUnitCircleWorksheet(id, data) {
    try {
      return await pb.collection('unit_circle_worksheets').update(id, data);
    } catch (error) {
      console.error('Error updating unit_circle_worksheet:', error);
      throw error;
    }
  },

  async deleteUnitCircleWorksheet(id) {
    try {
      return await pb.collection('unit_circle_worksheets').delete(id);
    } catch (error) {
      console.error('Error deleting unit_circle_worksheet:', error);
      throw error;
    }
  },

  // --- trig_values_worksheets ---

  async getTrigValuesWorksheets() {
    try {
      return await pb.collection('trig_values_worksheets').getFullList({
        sort: '-created',
        filter: andOwner(),
      });
    } catch (error) {
      console.error('Error fetching trig_values_worksheets:', error);
      return [];
    }
  },

  async createTrigValuesWorksheet(data) {
    try {
      return await pb.collection('trig_values_worksheets').create(withOwner(data));
    } catch (error) {
      console.error('Error creating trig_values_worksheet:', error);
      throw error;
    }
  },

  async updateTrigValuesWorksheet(id, data) {
    try {
      return await pb.collection('trig_values_worksheets').update(id, data);
    } catch (error) {
      console.error('Error updating trig_values_worksheet:', error);
      throw error;
    }
  },

  async deleteTrigValuesWorksheet(id) {
    try {
      return await pb.collection('trig_values_worksheets').delete(id);
    } catch (error) {
      console.error('Error deleting trig_values_worksheet:', error);
      throw error;
    }
  },

  // --- marathons ---

  async getMarathons() {
    try {
      return await pb.collection('marathons').getFullList({
        sort: '-created',
        expand: 'tasks',
        filter: andOwner(),
      });
    } catch (error) {
      console.error('Error fetching marathons:', error);
      return [];
    }
  },

  async getMarathon(id) {
    try {
      return await pb.collection('marathons').getOne(id, { expand: 'tasks' });
    } catch (error) {
      console.error('Error fetching marathon:', error);
      throw error;
    }
  },

  async createMarathon(data) {
    try {
      return await pb.collection('marathons').create(withOwner(data));
    } catch (error) {
      console.error('Error creating marathon:', error);
      throw error;
    }
  },

  async updateMarathon(id, data) {
    try {
      return await pb.collection('marathons').update(id, data);
    } catch (error) {
      console.error('Error updating marathon:', error);
      throw error;
    }
  },

  async deleteMarathon(id) {
    try {
      return await pb.collection('marathons').delete(id);
    } catch (error) {
      console.error('Error deleting marathon:', error);
      throw error;
    }
  },

  subscribeMarathon(id, callback) {
    return pb.collection('marathons').subscribe(id, callback);
  },

  unsubscribeMarathon(id) {
    return pb.collection('marathons').unsubscribe(id);
  },

  // --- cryptograms ---

  async getCryptograms() {
    try {
      return await pb.collection('cryptograms').getFullList({
        sort: '-created',
        expand: 'tasks',
        filter: andOwner(),
      });
    } catch (error) {
      console.error('Error fetching cryptograms:', error);
      return [];
    }
  },

  async getCryptogram(id) {
    try {
      return await pb.collection('cryptograms').getOne(id, { expand: 'tasks' });
    } catch (error) {
      console.error('Error fetching cryptogram:', error);
      throw error;
    }
  },

  async createCryptogram(data) {
    try {
      return await pb.collection('cryptograms').create(withOwner(data));
    } catch (error) {
      console.error('Error creating cryptogram:', error);
      throw error;
    }
  },

  async updateCryptogram(id, data) {
    try {
      return await pb.collection('cryptograms').update(id, data);
    } catch (error) {
      console.error('Error updating cryptogram:', error);
      throw error;
    }
  },

  async deleteCryptogram(id) {
    try {
      return await pb.collection('cryptograms').delete(id);
    } catch (error) {
      console.error('Error deleting cryptogram:', error);
      throw error;
    }
  },

  // --- mc_tests (тесты с выбором ответа) ---

  async getMCTests() {
    try {
      return await pb.collection('mc_tests').getFullList({ sort: '-created', filter: andOwner() });
    } catch (error) {
      console.error('Error fetching mc_tests:', error);
      return [];
    }
  },

  async getMCTest(id) {
    try {
      return await pb.collection('mc_tests').getOne(id);
    } catch (error) {
      console.error('Error fetching mc_test:', error);
      throw error;
    }
  },

  async createMCTest(data) {
    try {
      const rec = await pb.collection('mc_tests').create(withOwner(data));
      _logAudit('create', 'mc_tests', rec.id, rec.title);
      return rec;
    } catch (error) {
      console.error('Error creating mc_test:', error);
      throw error;
    }
  },

  async updateMCTest(id, data) {
    try {
      return await pb.collection('mc_tests').update(id, data);
    } catch (error) {
      console.error('Error updating mc_test:', error);
      throw error;
    }
  },

  async deleteMCTest(id) {
    try {
      let summary = id;
      try {
        const m = await pb.collection('mc_tests').getOne(id, { fields: 'id,title' });
        summary = m.title || id;
      } catch (_) {}
      const res = await pb.collection('mc_tests').delete(id);
      _logAudit('delete', 'mc_tests', id, summary);
      return res;
    } catch (error) {
      console.error('Error deleting mc_test:', error);
      throw error;
    }
  },

  // Получить task-записи по списку id (для рендера mc_test, т.к. task_id хранится в variants.json)
  async getTasksByIds(ids) {
    if (!ids || !ids.length) return [];
    try {
      const unique = [...new Set(ids.filter(Boolean))];
      const filter = unique.map(id => `id = "${id}"`).join(' || ');
      return await pb.collection('tasks').getFullList({ filter, batch: 500 });
    } catch (error) {
      console.error('Error fetching tasks by ids:', error);
      return [];
    }
  },

  // Сессия для mc_test (без поля work)
  async createMCTestSession(mcTestId, extra = {}) {
    try {
      return await pb.collection('work_sessions').create(withOwner({
        mc_test: mcTestId,
        is_open: true,
        achievements_enabled: true,
        ...extra,
      }));
    } catch (error) {
      console.error('Error creating mc_test session:', error);
      throw error;
    }
  },

  async getSessionsByMCTest(mcTestId) {
    try {
      return await pb.collection('work_sessions').getFullList({
        filter: `mc_test = "${mcTestId}"`,
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching sessions by mc_test:', error);
      return [];
    }
  },

  // --- MC-тесты из генераторов: фильтр по generator_type ---

  async getMCTestsByGeneratorType(generatorType) {
    try {
      return await pb.collection('mc_tests').getFullList({
        filter: andOwner(`source_type = "generator" && generator_type = "${generatorType}"`),
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching mc_tests by generator_type:', error);
      return [];
    }
  },

  // --- Аналитика по MC-тесту ---

  async getMCTestAnalytics(mcTestId) {
    try {
      const sessions = await pb.collection('work_sessions').getFullList({
        filter: `mc_test = "${mcTestId}"`,
        fields: 'id',
      });
      if (!sessions.length) return { attempts: [], answerStats: {} };

      const sessionFilter = sessions.map(s => `session = "${s.id}"`).join(' || ');
      const attempts = await pb.collection('attempts').getFullList({
        filter: `(${sessionFilter}) && status = "submitted"`,
        sort: '-created',
      });
      if (!attempts.length) return { attempts, answerStats: {} };

      const attemptFilter = attempts.map(a => `attempt = "${a.id}"`).join(' || ');
      const answers = await pb.collection('attempt_answers').getFullList({
        filter: attemptFilter,
      });

      const answerStats = {};
      for (const ans of answers) {
        const taskId = ans.task;
        if (!answerStats[taskId]) answerStats[taskId] = { choices: {}, correctCount: 0, total: 0 };
        const key = String(ans.answer_normalized ?? ans.answer_raw ?? '');
        answerStats[taskId].choices[key] = (answerStats[taskId].choices[key] || 0) + 1;
        answerStats[taskId].total++;
        if (ans.is_correct) answerStats[taskId].correctCount++;
      }

      return { attempts, answerStats };
    } catch (error) {
      console.error('Error fetching mc_test analytics:', error);
      return { attempts: [], answerStats: {} };
    }
  },

  // ─── Листы формул ────────────────────────────────────────────────────────────

  async getFormulaSheets() {
    try {
      return await pb.collection('formula_sheets').getFullList({ sort: '-id', filter: andOwner() });
    } catch (error) {
      console.error('Error fetching formula_sheets:', error);
      return [];
    }
  },

  async getFormulaSheet(id) {
    try {
      return await pb.collection('formula_sheets').getOne(id);
    } catch (error) {
      console.error('Error fetching formula_sheet:', error);
      throw error;
    }
  },

  async createFormulaSheet(data) {
    try {
      return await pb.collection('formula_sheets').create(withOwner(data));
    } catch (error) {
      console.error('Error creating formula_sheet:', error);
      throw error;
    }
  },

  async updateFormulaSheet(id, data) {
    try {
      return await pb.collection('formula_sheets').update(id, data);
    } catch (error) {
      console.error('Error updating formula_sheet:', error);
      throw error;
    }
  },

  async deleteFormulaSheet(id) {
    try {
      return await pb.collection('formula_sheets').delete(id);
    } catch (error) {
      console.error('Error deleting formula_sheet:', error);
      throw error;
    }
  },
};
