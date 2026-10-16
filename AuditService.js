/**
 * LongtuaPOS - Audit Service
 */

const AuditService = {
  log: function(action, details) {
    try {
      const user = Auth.getCurrentUser();
      const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
      DB.insert(CONFIG.SHEETS.AUDIT_LOGS, {
        timestamp: nowStr,
        user: user.email || user.name,
        action: action,
        details: typeof details === 'object' ? JSON.stringify(details) : details
      });
    } catch (e) {
      Logger.log('Audit log error: ' + e.toString());
    }
  }
};
