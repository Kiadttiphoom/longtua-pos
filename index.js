/**
 * LongtuaPOS - Web App Entry Point & Dispatcher
 */

/**
 * ฟังก์ชันหลักในการเปิด Web App (HTTP GET)
 */
function doGet(e) {
  try {
    // ตรวจสอบความถูกต้องของผู้ใช้
    const currentUser = Auth.getCurrentUser();

    // ดึงการตั้งค่าร้านค้าเบื้องต้น (เช่น โลโก้ และชื่อร้าน)
    let storeSettings = {};
    let storeLogoUrl = '';
    try {
      storeSettings = SettingsService.getSettings();
      if (storeSettings.store_logo_id) {
        storeLogoUrl = ImageService.getImageDataUrl(storeSettings.store_logo_id) || '';
      }
    } catch (sErr) {
      Logger.log('Could not load initial store settings: ' + sErr.message);
    }

    // สร้าง HTML Template จาก Index.html
    const template = HtmlService.createTemplateFromFile('Index');
    template.currentUser = currentUser;
    template.appName = CONFIG.APP_NAME;
    template.appVersion = CONFIG.APP_VERSION;
    template.storeSettings = storeSettings;
    template.storeLogoUrl = storeLogoUrl;

    return template.evaluate()
      .setTitle(CONFIG.APP_NAME + ' - ' + (storeSettings.shop_name || CONFIG.APP_SUBTITLE))
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, shrink-to-fit=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:sans-serif;padding:24px;color:#b91c1c;">' +
      '<h2>เกิดข้อผิดพลาดในการเปิดระบบ LongtuaPOS</h2>' +
      '<p>' + err.toString() + '</p>' +
      '</div>'
    );
  }
}

/**
 * Helper function สำหรับ Include ไฟล์ HTML ย่อยเข้ามาในหน้าหลัก
 * ส่งต่อ Template Context (currentUser, appName, storeSettings, storeLogoUrl) ให้กับไฟล์ย่อยด้วย
 */
function include(filename, context) {
  const t = HtmlService.createTemplateFromFile(filename);
  if (context) {
    for (const key in context) {
      if (context.hasOwnProperty(key)) {
        t[key] = context[key];
      }
    }
  }
  return t.evaluate().getContent();
}

/**
 * Wrapper API สำหรับเรียกผ่าน google.script.run
 */

function apiGetDashboardData() {
  return DashboardService.getDashboardData();
}

function apiGetCurrentUser() {
  return Auth.getCurrentUser();
}

function apiGetSheetData(sheetKey) {
  return DashboardService.getSheetData(sheetKey);
}

function apiTestConnection() {
  return testConnection();
}

/* Image & Media APIs */
function apiGetImageDataUrl(fileId) {
  return ImageService.getImageDataUrl(fileId);
}

function apiGetImagesBatch(fileIds) {
  return ImageService.getImagesBatch(fileIds);
}

function apiUploadProductImage(productId, base64Data, fileName) {
  return ImageService.uploadProductImage(productId, base64Data, fileName);
}

function apiUploadStoreLogo(base64Data) {
  return ImageService.uploadStoreLogo(base64Data);
}

function apiRemoveStoreLogo() {
  Auth.requireAdmin();
  const oldLogoId = SettingsService.getSetting('store_logo_id', '');
  if (oldLogoId) {
    try {
      const folders = ImageService.getOrCreateFolders();
      ImageService.safeTrashFile(oldLogoId, folders.storeFolderId);
    } catch (e) {
      Logger.log('Error trashing logo on remove: ' + e.message);
    }
  }
  SettingsService.setSetting('store_logo_id', '');
  return { success: true };
}

/* Product APIs */
function apiGetProducts() {
  return ProductService.getProducts();
}

function apiGetNextSku() {
  return ProductService.getNextSku();
}

function apiSaveProduct(productData) {
  return ProductService.saveProduct(productData);
}

function apiDeleteProduct(productId) {
  return ProductService.deleteProduct(productId);
}

/* Category APIs */
function apiGetCategories() {
  return CategoryService.getCategories();
}

function apiSaveCategory(categoryData) {
  return CategoryService.saveCategory(categoryData);
}

function apiDeleteCategory(categoryId) {
  return CategoryService.deleteCategory(categoryId);
}

/* Settings APIs */
function apiGetSettings() {
  return SettingsService.getSettings();
}

function apiUpdateSettings(settingsObj) {
  return SettingsService.updateSettings(settingsObj);
}
