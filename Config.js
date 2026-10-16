/**
 * LongtuaPOS - Configuration File
 * ระบบ POS ฟรีแบบ Open Source ด้วย Google Apps Script + Google Sheets
 */

const CONFIG = {
  // Google Spreadsheet ID สำหรับจัดเก็บฐานข้อมูล
  SPREADSHEET_ID: '19es18yyzrKniZpHw_zevUCBbfuGqgl69vger2SQQzEQ',

  // กำหนดชื่อชีตทั้ง 9 ชีตในระบบ
  SHEETS: {
    SETTINGS: 'Settings',
    USERS: 'Users',
    CATEGORIES: 'Categories',
    PRODUCTS: 'Products',
    ORDERS: 'Orders',
    ORDER_ITEMS: 'OrderItems',
    PAYMENTS: 'Payments',
    EXPENSES: 'Expenses',
    AUDIT_LOGS: 'AuditLogs'
  },

  // โครงสร้างโฟลเดอร์ Google Drive
  DRIVE: {
    ROOT_FOLDER_NAME: 'LongtuaPOS',
    PRODUCTS_FOLDER_NAME: 'Products',
    STORE_FOLDER_NAME: 'Store',
    MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
    ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp']
  },

  // ข้อมูลแอพพลิเคชัน
  APP_NAME: 'LongtuaPOS',
  APP_VERSION: '1.0.0',
  APP_SUBTITLE: 'ระบบบริหารจัดการจุดขาย (POS)',

  // ค่าตั้งต้นสำหรับตั้งค่าระบบ
  DEFAULT_SETTINGS: {
    shop_name: 'LongtuaPOS Cafe & Store',
    shop_address: '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110',
    shop_phone: '081-234-5678',
    shop_tax_id: '0105550000000',
    currency: 'THB',
    currency_symbol: '฿',
    vat_rate: 7,
    vat_type: 'inclusive', // 'inclusive' หรือ 'exclusive'
    receipt_footer: 'ขอบคุณที่ใช้บริการ / Thank you for visiting',
    store_logo_id: '' // Google Drive File ID สำหรับโลโก้ร้าน
  }
};

/**
 * ฟังก์ชันทดสอบการเชื่อมต่อ Google Sheets พร้อมตรวจสอบโครงสร้างชีต
 */
function testConnection() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    Logger.log('Connected to Spreadsheet: ' + spreadsheet.getName());

    const sheets = spreadsheet.getSheets();
    const sheetNames = sheets.map(s => s.getName());
    Logger.log('Found ' + sheets.length + ' sheets: ' + sheetNames.join(', '));

    return {
      success: true,
      spreadsheetName: spreadsheet.getName(),
      sheets: sheetNames
    };
  } catch (err) {
    Logger.log('Connection failed: ' + err.toString());
    return {
      success: false,
      error: err.toString()
    };
  }
}