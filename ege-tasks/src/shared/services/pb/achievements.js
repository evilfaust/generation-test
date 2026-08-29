import { pb, _logAudit } from './client.js';
import { getFullListByOr } from './chunked.js';
import { shuffleArray } from '../../utils/shuffle';

export const achievementsApi = {
  // ============ АЧИВКИ (ACHIEVEMENTS) ============

  async getAchievements() {
    try {
      return await pb.collection('achievements').getFullList({
        sort: 'order,title',
      });
    } catch (error) {
      console.error('Error fetching achievements:', error);
      return [];
    }
  },

  async getAchievement(id) {
    try {
      return await pb.collection('achievements').getOne(id);
    } catch (error) {
      console.error('Error fetching achievement:', error);
      return null;
    }
  },

  async getAchievementsByIds(ids = []) {
    try {
      return await getFullListByOr('achievements', 'id', ids);
    } catch (error) {
      console.error('Error fetching achievements by ids:', error);
      return [];
    }
  },

  async createAchievement(data) {
    try {
      return await pb.collection('achievements').create(data);
    } catch (error) {
      console.error('Error creating achievement:', error);
      throw error;
    }
  },

  async updateAchievement(id, data) {
    try {
      return await pb.collection('achievements').update(id, data);
    } catch (error) {
      console.error('Error updating achievement:', error);
      throw error;
    }
  },

  async deleteAchievement(id) {
    try {
      return await pb.collection('achievements').delete(id);
    } catch (error) {
      console.error('Error deleting achievement:', error);
      throw error;
    }
  },

  async getAttemptsWithAchievements() {
    try {
      return await pb.collection('attempts').getFullList({
        filter: 'achievement != "" || unlocked_achievements:length > 0',
        sort: '-created',
        fields: 'id,student,student_name,achievement,unlocked_achievements,created,score,total',
      });
    } catch (error) {
      console.error('Error fetching attempts with achievements:', error);
      return [];
    }
  },

};
