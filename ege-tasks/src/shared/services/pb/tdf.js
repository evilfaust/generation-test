import { pb, _logAudit } from './client.js';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';

export const tdfApi = {
  // ==================== ТДФ (Теоремы, Определения, Формулы) ====================

  // --- tdf_sets ---
  async getTdfSets() {
    try {
      return await pb.collection('tdf_sets').getFullList({ sort: 'order,title' });
    } catch (error) {
      console.error('Error fetching tdf_sets:', error);
      return [];
    }
  },

  async getTdfSet(id) {
    try {
      return await pb.collection('tdf_sets').getOne(id);
    } catch (error) {
      console.error('Error fetching tdf_set:', error);
      throw error;
    }
  },

  async createTdfSet(data) {
    try {
      const rec = await pb.collection('tdf_sets').create(data);
      _logAudit('create', 'tdf_sets', rec.id, rec.title);
      return rec;
    } catch (error) {
      console.error('Error creating tdf_set:', error);
      throw error;
    }
  },

  async updateTdfSet(id, data) {
    try {
      return await pb.collection('tdf_sets').update(id, data);
    } catch (error) {
      console.error('Error updating tdf_set:', error);
      throw error;
    }
  },

  async deleteTdfSet(id) {
    try {
      let summary = id;
      try {
        const s = await pb.collection('tdf_sets').getOne(id, { fields: 'id,title' });
        summary = s.title || id;
      } catch (_) {}
      const res = await pb.collection('tdf_sets').delete(id);
      _logAudit('delete', 'tdf_sets', id, summary);
      return res;
    } catch (error) {
      console.error('Error deleting tdf_set:', error);
      throw error;
    }
  },

  // --- tdf_items ---
  async getTdfItems(setId) {
    try {
      return await pb.collection('tdf_items').getFullList({
        filter: `tdf_set="${setId}"`,
        sort: 'order',
      });
    } catch (error) {
      console.error('Error fetching tdf_items:', error);
      return [];
    }
  },

  async createTdfItem(data) {
    try {
      return await pb.collection('tdf_items').create(data);
    } catch (error) {
      console.error('Error creating tdf_item:', error);
      throw error;
    }
  },

  async updateTdfItem(id, data) {
    try {
      return await pb.collection('tdf_items').update(id, data);
    } catch (error) {
      console.error('Error updating tdf_item:', error);
      throw error;
    }
  },

  async deleteTdfItem(id) {
    try {
      return await pb.collection('tdf_items').delete(id);
    } catch (error) {
      console.error('Error deleting tdf_item:', error);
      throw error;
    }
  },

  getTdfItemDrawingUrl(item) {
    if (!item?.drawing_image) return null;
    return `${PB_BASE_URL}/api/files/tdf_items/${item.id}/${item.drawing_image}`;
  },

  getTdfItemControlDrawingUrl(item) {
    if (!item?.drawing_image_control) return null;
    return `${PB_BASE_URL}/api/files/tdf_items/${item.id}/${item.drawing_image_control}`;
  },

  // --- tdf_variants ---
  async getTdfVariants(setId) {
    try {
      return await pb.collection('tdf_variants').getFullList({
        filter: `tdf_set="${setId}"`,
        sort: 'number',
      });
    } catch (error) {
      console.error('Error fetching tdf_variants:', error);
      return [];
    }
  },

  async getTdfVariant(id) {
    try {
      return await pb.collection('tdf_variants').getOne(id);
    } catch (error) {
      console.error('Error fetching tdf_variant:', error);
      throw error;
    }
  },

  async createTdfVariant(data) {
    try {
      return await pb.collection('tdf_variants').create(data);
    } catch (error) {
      console.error('Error creating tdf_variant:', error);
      throw error;
    }
  },

  async updateTdfVariant(id, data) {
    try {
      return await pb.collection('tdf_variants').update(id, data);
    } catch (error) {
      console.error('Error updating tdf_variant:', error);
      throw error;
    }
  },

  async deleteTdfVariant(id) {
    try {
      return await pb.collection('tdf_variants').delete(id);
    } catch (error) {
      console.error('Error deleting tdf_variant:', error);
      throw error;
    }
  },

  // --- qr_worksheets ---

};
