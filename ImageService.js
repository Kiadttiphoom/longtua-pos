/**
 * LongtuaPOS - Image Service (Google Drive Integration)
 * จัดการโฟลเดอร์ อัปโหลด ปรับปรุง ลบ และส่งมอบรูปภาพผ่าน Google Drive
 * ภายใต้ความปลอดภัยของเจ้าของร้าน ไม่เผยแพร่เป็น Public
 */

const ImageService = {
  /**
   * ดึงหรือสร้าง Root Folder และโฟลเดอร์ย่อยใน Google Drive ของเจ้าของร้าน
   * คืนค่า { rootFolderId, productsFolderId, storeFolderId }
   */
  getOrCreateFolders: function() {
    Auth.requireAdmin();

    const props = PropertiesService.getScriptProperties();
    let rootFolderId = props.getProperty('DRIVE_ROOT_FOLDER_ID');
    let productsFolderId = props.getProperty('DRIVE_PRODUCTS_FOLDER_ID');
    let storeFolderId = props.getProperty('DRIVE_STORE_FOLDER_ID');

    let rootFolder = null;
    let productsFolder = null;
    let storeFolder = null;

    // ตรวจสอบและดึง Root Folder
    if (rootFolderId) {
      try {
        rootFolder = DriveApp.getFolderById(rootFolderId);
        if (rootFolder.isTrashed()) rootFolder = null;
      } catch (e) {
        rootFolder = null;
      }
    }

    if (!rootFolder) {
      const folders = DriveApp.getFoldersByName(CONFIG.DRIVE.ROOT_FOLDER_NAME);
      if (folders.hasNext()) {
        rootFolder = folders.next();
      } else {
        rootFolder = DriveApp.createFolder(CONFIG.DRIVE.ROOT_FOLDER_NAME);
      }
      rootFolderId = rootFolder.getId();
      props.setProperty('DRIVE_ROOT_FOLDER_ID', rootFolderId);
    }

    // ตรวจสอบและดึง Products Folder
    if (productsFolderId) {
      try {
        productsFolder = DriveApp.getFolderById(productsFolderId);
        if (productsFolder.isTrashed()) productsFolder = null;
      } catch (e) {
        productsFolder = null;
      }
    }

    if (!productsFolder) {
      const subFolders = rootFolder.getFoldersByName(CONFIG.DRIVE.PRODUCTS_FOLDER_NAME);
      if (subFolders.hasNext()) {
        productsFolder = subFolders.next();
      } else {
        productsFolder = rootFolder.createFolder(CONFIG.DRIVE.PRODUCTS_FOLDER_NAME);
      }
      productsFolderId = productsFolder.getId();
      props.setProperty('DRIVE_PRODUCTS_FOLDER_ID', productsFolderId);
    }

    // ตรวจสอบและดึง Store Folder
    if (storeFolderId) {
      try {
        storeFolder = DriveApp.getFolderById(storeFolderId);
        if (storeFolder.isTrashed()) storeFolder = null;
      } catch (e) {
        storeFolder = null;
      }
    }

    if (!storeFolder) {
      const subFolders = rootFolder.getFoldersByName(CONFIG.DRIVE.STORE_FOLDER_NAME);
      if (subFolders.hasNext()) {
        storeFolder = subFolders.next();
      } else {
        storeFolder = rootFolder.createFolder(CONFIG.DRIVE.STORE_FOLDER_NAME);
      }
      storeFolderId = storeFolder.getId();
      props.setProperty('DRIVE_STORE_FOLDER_ID', storeFolderId);
    }

    return {
      rootFolderId: rootFolderId,
      productsFolderId: productsFolderId,
      storeFolderId: storeFolderId
    };
  },

  /**
   * ตรวจสอบ Magic Bytes (Signature) ของไฟล์เพื่อป้องกันการปลอมแปลง MIME type
   */
  validateImageBytes: function(bytes, declaredMimeType) {
    if (!bytes || bytes.length < 12) {
      throw new Error('ไฟล์รูปภาพไม่ถูกต้องหรือข้อมูลไม่สมบูรณ์');
    }

    // JPEG: FF D8 FF
    const isJpeg = (bytes[0] & 0xFF) === 0xFF && (bytes[1] & 0xFF) === 0xD8 && (bytes[2] & 0xFF) === 0xFF;
    
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPng = (bytes[0] & 0xFF) === 0x89 && (bytes[1] & 0xFF) === 0x50 &&
                  (bytes[2] & 0xFF) === 0x4E && (bytes[3] & 0xFF) === 0x47;

    // WebP: RIFF ... WEBP
    const isRiff = (bytes[0] & 0xFF) === 0x52 && (bytes[1] & 0xFF) === 0x49 &&
                   (bytes[2] & 0xFF) === 0x46 && (bytes[3] & 0xFF) === 0x46;
    const isWebp = isRiff && (bytes[8] & 0xFF) === 0x57 && (bytes[9] & 0xFF) === 0x45 &&
                             (bytes[10] & 0xFF) === 0x42 && (bytes[11] & 0xFF) === 0x50;

    let detectedMime = '';
    if (isJpeg) detectedMime = 'image/jpeg';
    else if (isPng) detectedMime = 'image/png';
    else if (isWebp) detectedMime = 'image/webp';

    if (!detectedMime) {
      throw new Error('ประเภทไฟล์ไม่ถูกต้อง (ต้องเป็น JPG, PNG หรือ WebP เท่านั้น)');
    }

    return detectedMime;
  },

  /**
   * อัปโหลดรูปภาพสินค้า
   * @param {string} productId - รหัสสินค้า
   * @param {string} base64Data - ข้อมูล base64 (รวม data:image/xxx;base64, หรือเฉพาะ raw base64)
   * @param {string} fileName - ชื่อไฟล์เดิม
   */
  uploadProductImage: function(productId, base64Data, fileName) {
    Auth.requireAdmin();

    if (!productId) {
      throw new Error('กรุณาระบุ Product ID');
    }

    if (!base64Data) {
      throw new Error('ไม่พบข้อมูลรูปภาพ');
    }

    // แยก header data URI ออก
    let cleanBase64 = base64Data;
    let declaredMime = 'image/jpeg';
    if (base64Data.indexOf(';base64,') !== -1) {
      const parts = base64Data.split(';base64,');
      declaredMime = parts[0].replace('data:', '');
      cleanBase64 = parts[1];
    }

    // แปลง Base64 เป็น Bytes
    const bytes = Utilities.base64Decode(cleanBase64);
    if (bytes.length > CONFIG.DRIVE.MAX_FILE_SIZE_BYTES) {
      throw new Error('ขนาดไฟล์รูปภาพเกินกำหนด (สูงสุด 5 MB)');
    }

    // ตรวจสอบ Magic Signature
    const verifiedMime = this.validateImageBytes(bytes, declaredMime);

    // กำหนดนามสกุลไฟล์
    let ext = 'jpg';
    if (verifiedMime === 'image/png') ext = 'png';
    else if (verifiedMime === 'image/webp') ext = 'webp';

    const safeFileName = 'prod_' + String(productId).replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + new Date().getTime() + '.' + ext;

    // ดึงโฟลเดอร์ Products
    const folders = this.getOrCreateFolders();
    const productsFolder = DriveApp.getFolderById(folders.productsFolderId);

    // สร้าง Blob และบันทึกไฟล์ลง Drive
    const blob = Utilities.newBlob(bytes, verifiedMime, safeFileName);
    const newFile = productsFolder.createFile(blob);
    const newFileId = newFile.getId();

    // บันทึกสำเร็จ
    AuditService.log('UPLOAD_PRODUCT_IMAGE', {
      productId: productId,
      fileId: newFileId,
      fileName: safeFileName,
      sizeBytes: bytes.length
    });

    return {
      success: true,
      fileId: newFileId,
      fileName: safeFileName,
      mimeType: verifiedMime
    };
  },

  /**
   * อัปโหลดโลโก้ร้านค้า
   * @param {string} base64Data - ข้อมูล base64 ของโลโก้
   */
  uploadStoreLogo: function(base64Data) {
    Auth.requireAdmin();

    if (!base64Data) {
      throw new Error('ไม่พบข้อมูลรูปภาพโลโก้');
    }

    let cleanBase64 = base64Data;
    let declaredMime = 'image/png';
    if (base64Data.indexOf(';base64,') !== -1) {
      const parts = base64Data.split(';base64,');
      declaredMime = parts[0].replace('data:', '');
      cleanBase64 = parts[1];
    }

    const bytes = Utilities.base64Decode(cleanBase64);
    if (bytes.length > CONFIG.DRIVE.MAX_FILE_SIZE_BYTES) {
      throw new Error('ขนาดไฟล์โลโก้เกินกำหนด (สูงสุด 5 MB)');
    }

    const verifiedMime = this.validateImageBytes(bytes, declaredMime);
    let ext = 'png';
    if (verifiedMime === 'image/jpeg') ext = 'jpg';
    else if (verifiedMime === 'image/webp') ext = 'webp';

    const safeFileName = 'store_logo_' + new Date().getTime() + '.' + ext;

    const folders = this.getOrCreateFolders();
    const storeFolder = DriveApp.getFolderById(folders.storeFolderId);

    // ดึงโลโก้เดิมเพื่อจัดการหลังบันทึกใหม่สำเร็จ
    const oldLogoId = SettingsService.getSetting('store_logo_id', '');

    const blob = Utilities.newBlob(bytes, verifiedMime, safeFileName);
    const newFile = storeFolder.createFile(blob);
    const newFileId = newFile.getId();

    // บันทึกลง Settings
    SettingsService.setSetting('store_logo_id', newFileId);

    // ย้ายไฟล์เก่าลงถังขยะอย่างปลอดภัย (Soft-delete: Trash)
    if (oldLogoId && oldLogoId !== newFileId) {
      try {
        this.safeTrashFile(oldLogoId, folders.storeFolderId);
      } catch (e) {
        Logger.log('Could not trash old logo: ' + e.message);
      }
    }

    AuditService.log('UPLOAD_STORE_LOGO', { fileId: newFileId });

    return {
      success: true,
      fileId: newFileId
    };
  },

  /**
   * อ่านรูปภาพจาก Google Drive แล้วส่งกลับเป็น Data URL หรือ Base64 อย่างปลอดภัย
   * ตรวจสอบว่า File ID อยู่ในโฟลเดอร์ LongtuaPOS ของเจ้าของร้านเท่านั้น
   */
  getImageDataUrl: function(fileId) {
    if (!fileId) return null;

    try {
      const file = DriveApp.getFileById(fileId);
      if (file.isTrashed()) return null;

      // ตรวจสอบความปลอดภัย: ไฟล์ต้องอยู่ในโฟลเดอร์ LongtuaPOS
      const folders = this.getOrCreateFolders();
      const parents = file.getParents();
      let isAuthorized = false;

      while (parents.hasNext()) {
        const parent = parents.next();
        const pId = parent.getId();
        if (pId === folders.productsFolderId || pId === folders.storeFolderId || pId === folders.rootFolderId) {
          isAuthorized = true;
          break;
        }
      }

      if (!isAuthorized) {
        Logger.log('Security warning: File ID ' + fileId + ' is outside LongtuaPOS folders.');
        return null;
      }

      const mimeType = file.getMimeType();
      const bytes = file.getBlob().getBytes();
      const base64 = Utilities.base64Encode(bytes);
      return 'data:' + mimeType + ';base64,' + base64;
    } catch (err) {
      Logger.log('Error reading image: ' + err.toString());
      return null;
    }
  },

  /**
   * ดึงภาพหลายภาพแบบ Batch (จำกัดครั้งละไม่เกิน 30 ภาพเพื่อไม่ให้ติด Apps Script quota)
   */
  getImagesBatch: function(fileIds) {
    if (!fileIds || !Array.isArray(fileIds)) return {};

    const maxItems = Math.min(fileIds.length, 30);
    const result = {};

    for (let i = 0; i < maxItems; i++) {
      const id = fileIds[i];
      if (id && !result[id]) {
        result[id] = this.getImageDataUrl(id);
      }
    }

    return result;
  },

  /**
   * Soft-delete ย้ายไฟล์ลงถังขยะ (trash) โดยตรวจสอบว่าอยู่ในโฟลเดอร์ที่ถูกต้อง
   */
  safeTrashFile: function(fileId, expectedFolderId) {
    Auth.requireAdmin();
    if (!fileId) return false;

    try {
      const file = DriveApp.getFileById(fileId);
      if (!file || file.isTrashed()) return true;

      if (expectedFolderId) {
        const parents = file.getParents();
        let inFolder = false;
        while (parents.hasNext()) {
          if (parents.next().getId() === expectedFolderId) {
            inFolder = true;
            break;
          }
        }
        if (!inFolder) {
          Logger.log('Cannot trash file: not in expected folder');
          return false;
        }
      }

      file.setTrashed(true);
      return true;
    } catch (e) {
      Logger.log('Error trashing file: ' + e.toString());
      return false;
    }
  }
};
