/**
 * LongtuaPOS - Settings Service
 */

const SettingsService = {
  getSettings: function() {
    Auth.requireAdmin();
    const rows = DB.getAll(CONFIG.SHEETS.SETTINGS);
    const settings = Object.assign({}, CONFIG.DEFAULT_SETTINGS);

    if (rows && rows.length > 0) {
      rows.forEach(r => {
        const key = r.key || r.setting_key;
        const val = r.value || r.setting_value;
        if (key) {
          settings[key] = val;
        }
      });
    }

    return settings;
  },

  getSetting: function(key, defaultValue) {
    const settings = this.getSettings();
    return settings[key] !== undefined ? settings[key] : defaultValue;
  },

  setSetting: function(key, value) {
    Auth.requireAdmin();
    const sheet = DB.getSheet(CONFIG.SHEETS.SETTINGS, ['key', 'value', 'updated_at']);
    const existing = DB.findOne(CONFIG.SHEETS.SETTINGS, 'key', key);
    const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

    if (existing) {
      DB.update(CONFIG.SHEETS.SETTINGS, 'key', key, {
        value: value,
        updated_at: nowStr
      });
    } else {
      DB.insert(CONFIG.SHEETS.SETTINGS, {
        key: key,
        value: value,
        updated_at: nowStr
      });
    }

    return true;
  },

  updateSettings: function(settingsObj) {
    Auth.requireAdmin();
    for (const k in settingsObj) {
      if (settingsObj.hasOwnProperty(k)) {
        this.setSetting(k, settingsObj[k]);
      }
    }
    AuditService.log('UPDATE_SETTINGS', settingsObj);
    return true;
  }
};
