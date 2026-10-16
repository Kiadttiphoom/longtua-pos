/**
 * LongtuaPOS - Database Engine
 * คลาส Database สำหรับเชื่อมต่อและจัดการชีต 9 ชีตใน Google Sheets
 */

const DB = {
  /**
   * ดึงอ็อบเจกต์ Spreadsheet
   */
  getSpreadsheet: function() {
    if (!CONFIG.SPREADSHEET_ID) {
      throw new Error('ไม่พบการกำหนดค่า SPREADSHEET_ID ใน Config.js');
    }
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  },

  /**
   * ดึงชีตตามชื่อ หากยังไม่มีชีตและระบุ createIfMissing ให้สร้างพร้อมหัวตาราง
   */
  getSheet: function(sheetName, headersIfCreate) {
    const ss = this.getSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet && headersIfCreate && Array.isArray(headersIfCreate)) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headersIfCreate);
      sheet.setFrozenRows(1);
      // จัดการฟอร์แมตหัวตารางเบื้องต้น
      sheet.getRange(1, 1, 1, headersIfCreate.length)
        .setFontWeight('bold')
        .setBackground('#1e293b')
        .setFontColor('#ffffff');
    }
    return sheet;
  },

  /**
   * แปลงข้อมูลชีตทั้งหมดเป็น Array of Objects โดยใช้หัวตารางบรรทัดแรกเป็นคีย์
   */
  getAll: function(sheetName) {
    const sheet = this.getSheet(sheetName);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data[0].map(h => String(h).trim());
    const rows = data.slice(1);

    return rows.map((row, index) => {
      const obj = { _rowIndex: index + 2 };
      headers.forEach((header, i) => {
        if (header) {
          let val = row[i];
          // แปลง Date เป็น ISO String หรือจัดรูปแบบให้ serialize JSON ได้อย่างปลอดภัย
          if (val instanceof Date) {
            val = Utilities.formatDate(val, Session.getScriptTimeZone() || 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ss'Z'");
          }
          obj[header] = val;
        }
      });

      // Map alias สะดวกให้เรียกใช้ได้ทั้งสองแบบเสมอ
      if (obj.product_id && !obj.id) obj.id = obj.product_id;
      if (obj.id && !obj.product_id) obj.product_id = obj.id;

      if (obj.product_name && !obj.name) obj.name = obj.product_name;
      if (obj.name && !obj.product_name) obj.product_name = obj.name;

      if (obj.category_id && !obj.category) obj.category = obj.category_id;
      if (obj.category && !obj.category_id) obj.category_id = obj.category;

      if (obj.stock_qty !== undefined && obj.stock === undefined) obj.stock = obj.stock_qty;
      if (obj.stock !== undefined && obj.stock_qty === undefined) obj.stock_qty = obj.stock;

      if (obj.is_active !== undefined && obj.status === undefined) {
        obj.status = (String(obj.is_active).toUpperCase() === 'FALSE') ? 'DELETED' : 'ACTIVE';
      }

      return obj;
    });
  },

  /**
   * ค้นหารายการตามเงื่อนไขฟิลด์
   */
  find: function(sheetName, filterFn) {
    const items = this.getAll(sheetName);
    return items.filter(filterFn);
  },

  /**
   * ค้นหาแถวเดียวตามฟิลด์ (รองรับ alias เช่น id หรือ product_id)
   */
  findOne: function(sheetName, key, value) {
    const items = this.getAll(sheetName);
    return items.find(item => {
      const val1 = item[key] !== undefined ? String(item[key]).trim() : '';
      if (val1 && val1 === String(value).trim()) return true;
      if (key === 'id' && item.product_id && String(item.product_id).trim() === String(value).trim()) return true;
      if (key === 'product_id' && item.id && String(item.id).trim() === String(value).trim()) return true;
      return false;
    }) || null;
  },

  /**
   * เพิ่มข้อมูล 1 แถวลงในชีต โดยแมปตาม Header อัตโนมัติ
   */
  insert: function(sheetName, itemObject) {
    const sheet = this.getSheet(sheetName);
    if (!sheet) throw new Error('ไม่พบชีต: ' + sheetName);

    const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(h => String(h).trim());
    if (headers.length === 0 || !headers[0]) {
      throw new Error('ชีต ' + sheetName + ' ไม่มีหัวตาราง (Header)');
    }

    const row = headers.map(header => {
      if (itemObject[header] !== undefined) {
        return itemObject[header];
      }
      return '';
    });

    sheet.appendRow(row);
    return true;
  },

  /**
   * อัปเดตข้อมูลตามคีย์ เช่น id หรือ product_id
   */
  update: function(sheetName, keyField, keyValue, updatedData) {
    const sheet = this.getSheet(sheetName);
    if (!sheet) throw new Error('ไม่พบชีต: ' + sheetName);

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return false;

    const headers = data[0].map(h => String(h).trim());
    let keyIndex = headers.indexOf(keyField);

    // ตรวจสอบ alias ถ้าไม่พบคอลัมน์คีย์ตรงๆ
    if (keyIndex === -1) {
      if (keyField === 'id' && headers.includes('product_id')) {
        keyIndex = headers.indexOf('product_id');
      } else if (keyField === 'id' && headers.includes('category_id')) {
        keyIndex = headers.indexOf('category_id');
      } else if (keyField === 'id' && headers.includes('order_id')) {
        keyIndex = headers.indexOf('order_id');
      }
    }

    if (keyIndex === -1) throw new Error('ไม่พบคอลัมน์คีย์: ' + keyField);

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][keyIndex]).trim() === String(keyValue).trim()) {
        const rowIndex = i + 1;
        headers.forEach((header, colIndex) => {
          if (updatedData[header] !== undefined) {
            sheet.getRange(rowIndex, colIndex + 1).setValue(updatedData[header]);
          }
        });
        return true;
      }
    }
    return false;
  },

  /**
   * อ่านข้อมูลชีตทั้งหมดสำหรับ Dashboard และการตรวจสอบระบบ
   */
  readAllSheetsSummary: function() {
    const ss = this.getSpreadsheet();
    const sheets = ss.getSheets();
    const result = {};

    sheets.forEach(sheet => {
      const name = sheet.getName();
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      let headers = [];
      if (lastRow > 0 && lastCol > 0) {
        headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
      }
      result[name] = {
        name: name,
        rowCount: Math.max(0, lastRow - 1),
        colCount: lastCol,
        headers: headers
      };
    });

    return result;
  }
};
