/**
 * LongtuaPOS - Authentication & Authorization Service
 * ควบคุมสิทธิ์การเข้าถึงระบบโดยเฉพาะเจ้าของร้าน (Owner) และผู้ดูแลระบบ (Admin)
 */

const Auth = {
  /**
   * ตรวจสอบสิทธิ์ผู้ใช้งานปัจจุบัน
   * ตามข้อกำหนดเวอร์ชันแรก: จำกัดการเข้าถึงเฉพาะเจ้าของร้าน/บัญชี Google ที่ได้รับอนุญาต
   */
  getCurrentUser: function() {
    let email = '';
    try {
      email = Session.getActiveUser().getEmail();
      if (!email) {
        email = Session.getEffectiveUser().getEmail();
      }
    } catch (e) {
      email = 'unknown_user';
    }

    // ตรวจสอบกับชีต Users หากมี
    let role = 'OWNER';
    let displayName = 'Store Owner';
    let userId = 'user_1';

    try {
      const userList = DB.getAll(CONFIG.SHEETS.USERS);
      if (userList && userList.length > 0) {
        const found = userList.find(u => String(u.email || '').trim().toLowerCase() === email.toLowerCase());
        if (found) {
          role = found.role || 'STAFF';
          displayName = found.name || found.display_name || email;
          userId = found.id || found.user_id || 'user_' + email;
        } else {
          // หากเป็น user คนแรกหรือยังไม่มีในตาราง ถือเป็น Owner ตาม effective user
          displayName = email.split('@')[0] || 'Store Owner';
        }
      } else {
        displayName = email ? email.split('@')[0] : 'Store Owner';
      }
    } catch (err) {
      Logger.log('Auth check note: ' + err.message);
    }

    return {
      email: email,
      name: displayName,
      role: role,
      id: userId,
      isOwner: role === 'OWNER' || role === 'ADMIN',
      isAdmin: role === 'OWNER' || role === 'ADMIN'
    };
  },

  /**
   * Guard ตรวจสอบว่าผู้ใช้มีสิทธิ์ระดับ Admin/Owner หรือไม่
   */
  requireAdmin: function() {
    const user = this.getCurrentUser();
    if (!user.isAdmin) {
      throw new Error('ไม่ได้รับอนุญาต: เฉพาะเจ้าของร้านหรือผู้ดูแลระบบเท่านั้นที่สามารถเข้าถึงส่วนนี้ได้');
    }
    return user;
  }
};
