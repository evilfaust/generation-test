import { pb, _logAudit } from './client.js';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';

export const sessionsApi = {
  // ============ СЕССИИ ВЫДАЧИ (WORK SESSIONS) ============

  async createSession(data) {
    try {
      return await pb.collection('work_sessions').create(data);
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  },

  async getSession(id) {
    try {
      return await pb.collection('work_sessions').getOne(id, {
        expand: 'work',
      });
    } catch (error) {
      console.error('Error fetching session:', error);
      return null;
    }
  },

  async getSessionByWork(workId) {
    try {
      const records = await pb.collection('work_sessions').getFullList({
        filter: `work = "${escapeFilter(workId)}"`,
        sort: '-created',
      });
      if (records.length === 0) return null;
      if (records.length === 1) return records[0];

      // Если есть дубликаты сессий для одной работы, выбираем сессию
      // с наибольшим числом попыток, затем самую новую.
      const sessionIds = records.map(r => r.id);
      const attempts = await this.getAttemptsBySessions(sessionIds);
      const attemptsBySession = attempts.reduce((acc, attempt) => {
        acc[attempt.session] = (acc[attempt.session] || 0) + 1;
        return acc;
      }, {});

      const sorted = [...records].sort((a, b) => {
        const attemptsA = attemptsBySession[a.id] || 0;
        const attemptsB = attemptsBySession[b.id] || 0;
        if (attemptsA !== attemptsB) return attemptsB - attemptsA;
        return new Date(b.created) - new Date(a.created);
      });

      return sorted[0];
    } catch (error) {
      console.error('Error fetching session by work:', error);
      return null;
    }
  },

  async getSessionsByWork(workId) {
    try {
      return await pb.collection('work_sessions').getFullList({
        filter: `work = "${escapeFilter(workId)}"`,
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching sessions by work:', error);
      return [];
    }
  },

  async getSessionsByWorks(workIds = []) {
    try {
      if (!workIds.length) return [];
      const filter = workIds.map(id => `work = "${escapeFilter(id)}"`).join(' || ');
      return await pb.collection('work_sessions').getFullList({
        filter,
        sort: '-created',
        fields: 'id,work,created',
      });
    } catch (error) {
      console.error('Error fetching sessions by works:', error);
      return [];
    }
  },

  async updateSession(id, data) {
    try {
      return await pb.collection('work_sessions').update(id, data);
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  },

  // ============ ПОПЫТКИ УЧЕНИКОВ (ATTEMPTS) ============

  async createAttempt(data) {
    try {
      return await pb.collection('attempts').create(data);
    } catch (error) {
      console.error('Error creating attempt:', error);
      throw error;
    }
  },

  async getAttemptByDevice(sessionId, deviceId) {
    try {
      const records = await pb.collection('attempts').getFullList({
        filter: `session = "${escapeFilter(sessionId)}" && device_id = "${escapeFilter(deviceId)}"`,
        sort: '-created',
        expand: 'variant,achievement,unlocked_achievements',
      });
      return records.length > 0 ? records[0] : null;
    } catch (error) {
      console.error('Error fetching attempt by device:', error);
      return null;
    }
  },

  async getAttemptsByDevice(sessionId, deviceId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `session = "${escapeFilter(sessionId)}" && device_id = "${escapeFilter(deviceId)}"`,
        expand: 'achievement,unlocked_achievements',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching attempts by device:', error);
      return [];
    }
  },

  async getAttemptsBySession(sessionId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `session = "${escapeFilter(sessionId)}"`,
        sort: 'student_name,-created',
        expand: 'variant',
      });
    } catch (error) {
      console.error('Error fetching attempts:', error);
      return [];
    }
  },

  async getAttemptsBySessions(sessionIds = []) {
    try {
      if (!sessionIds.length) return [];
      const CHUNK_SIZE = 50;
      const chunks = [];
      for (let i = 0; i < sessionIds.length; i += CHUNK_SIZE) {
        chunks.push(sessionIds.slice(i, i + CHUNK_SIZE));
      }
      const results = await Promise.all(
        chunks.map(chunk => {
          const filter = chunk.map(id => `session = "${escapeFilter(id)}"`).join(' || ');
          return pb.collection('attempts').getFullList({ filter, fields: 'id,session,score,total' });
        })
      );
      return results.flat();
    } catch (error) {
      console.error('Error fetching attempts by sessions:', error);
      return [];
    }
  },

  // Попытки по сессиям с именем ученика (для тепловой карты)
  async getAttemptsBySessionsWithStudent(sessionIds = []) {
    try {
      if (!sessionIds.length) return [];
      const CHUNK_SIZE = 50;
      const chunks = [];
      for (let i = 0; i < sessionIds.length; i += CHUNK_SIZE) {
        chunks.push(sessionIds.slice(i, i + CHUNK_SIZE));
      }
      const results = await Promise.all(
        chunks.map(chunk => {
          const filter = chunk.map(id => `session = "${escapeFilter(id)}"`).join(' || ');
          return pb.collection('attempts').getFullList({
            filter,
            fields: 'id,session,student,student_name,status',
          });
        })
      );
      return results.flat();
    } catch (error) {
      console.error('Error fetching attempts by sessions (with student):', error);
      return [];
    }
  },

  async getAttemptsCountByWork(workId) {
    try {
      const sessions = await this.getSessionsByWork(workId);
      if (sessions.length === 0) return 0;

      const sessionFilters = sessions.map(s => `session = "${escapeFilter(s.id)}"`);
      const filter = sessionFilters.join(' || ');
      const attempts = await pb.collection('attempts').getFullList({
        filter,
        fields: 'id',
      });
      return attempts.length;
    } catch (error) {
      console.error('Error fetching attempts count by work:', error);
      return 0;
    }
  },

  async updateAttempt(id, data) {
    try {
      return await pb.collection('attempts').update(id, data);
    } catch (error) {
      console.error('Error updating attempt:', error);
      throw error;
    }
  },

  async deleteAttempt(id) {
    try {
      return await pb.collection('attempts').delete(id);
    } catch (error) {
      console.error('Error deleting attempt:', error);
      throw error;
    }
  },

};
