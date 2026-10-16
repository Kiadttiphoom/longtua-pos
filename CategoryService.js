/**
 * LongtuaPOS - Category Service
 */

const CategoryService = {
  getCategories: function() {
    Auth.requireAdmin();
    const rows = DB.getAll(CONFIG.SHEETS.CATEGORIES);
    return rows.filter(c => c.status !== 'DELETED');
  },

  /**
   * บันทึกหรือสร้างหมวดหมู่ใหม่
   */
  saveCategory: function(categoryData) {
    Auth.requireAdmin();
    if (!categoryData.name) {
      throw new Error('กรุณาระบุชื่อหมวดหมู่');
    }

    const isNew = !categoryData.id;
    const catId = isNew ? ('CAT-' + new Date().getTime().toString().slice(-6)) : categoryData.id;
    const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

    const record = {
      id: catId,
      category_id: catId,
      name: categoryData.name.trim(),
      category_name: categoryData.name.trim(),
      description: categoryData.description || '',
      status: categoryData.status || 'ACTIVE',
      is_active: (categoryData.status === 'DELETED') ? 'FALSE' : 'TRUE',
      updated_at: nowStr
    };

    if (isNew) {
      record.created_at = nowStr;
      DB.insert(CONFIG.SHEETS.CATEGORIES, record);
      AuditService.log('CREATE_CATEGORY', { id: catId, name: record.name });
    } else {
      DB.update(CONFIG.SHEETS.CATEGORIES, 'id', catId, record);
      AuditService.log('UPDATE_CATEGORY', { id: catId, name: record.name });
    }

    return {
      success: true,
      category: record
    };
  },

  /**
   * ลบหมวดหมู่ (Soft delete)
   */
  deleteCategory: function(categoryId) {
    Auth.requireAdmin();
    const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    DB.update(CONFIG.SHEETS.CATEGORIES, 'id', categoryId, {
      status: 'DELETED',
      updated_at: nowStr
    });
    AuditService.log('DELETE_CATEGORY', { id: categoryId });
    return { success: true };
  }
};
