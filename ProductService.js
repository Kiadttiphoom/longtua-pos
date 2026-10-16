/**
 * LongtuaPOS - Product Service
 */

const ProductService = {
  getProducts: function() {
    Auth.requireAdmin();
    return DB.getAll(CONFIG.SHEETS.PRODUCTS);
  },

  getProductById: function(id) {
    Auth.requireAdmin();
    return DB.findOne(CONFIG.SHEETS.PRODUCTS, 'id', id);
  },

  /**
   * สร้างรหัสสินค้าอัตโนมัติ (Next SKU / Barcode Auto-Generate)
   * รูปแบบ: PRD-0001, PRD-0002, ... หรือสร้างต่อจากจำนวนสินค้าสูงสุดในระบบ
   */
  getNextSku: function(prefix = 'PRD-') {
    Auth.requireAdmin();
    const products = DB.getAll(CONFIG.SHEETS.PRODUCTS);
    let maxNum = 0;

    products.forEach(p => {
      const code = String(p.sku || p.barcode || p.id || '').trim();
      // ค้นหาตัวเลขที่ลงท้าย เช่น PRD-0005 หรือ 0005
      const match = code.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    const nextNum = maxNum + 1;
    // เติม 0 นำหน้าให้เป็น 4 หลัก เช่น PRD-0001
    const padded = String(nextNum).padStart(4, '0');
    return prefix + padded;
  },

  /**
   * บันทึกหรือแก้ไขสินค้า พร้อมจัดการรูปภาพ
   * @param {Object} productData - { id, name, sku, category, price, cost, stock, min_stock, image_base64, image_action, image_url }
   */
  saveProduct: function(productData) {
    Auth.requireAdmin();

    if (!productData.name) {
      throw new Error('กรุณาระบุชื่อสินค้า');
    }

    const isNew = !productData.id;
    const productId = isNew ? ('P' + new Date().getTime()) : productData.id;
    let oldProduct = null;

    if (!isNew) {
      oldProduct = this.getProductById(productId);
    }

    // หากเป็นสินค้าใหม่ และไม่ได้ระบุ SKU ให้ Auto-generate อัตโนมัติ
    let finalSku = String(productData.sku || '').trim();
    if (!finalSku) {
      if (oldProduct && oldProduct.sku) {
        finalSku = oldProduct.sku;
      } else {
        finalSku = this.getNextSku();
      }
    }

    let finalImageFileId = oldProduct ? (oldProduct.image_url || '') : '';

    // จัดการอัปโหลดรูปใหม่ (ถ้ามี)
    if (productData.image_base64) {
      const uploadResult = ImageService.uploadProductImage(productId, productData.image_base64, productData.image_name || 'product.jpg');
      if (uploadResult && uploadResult.success) {
        const newFileId = uploadResult.fileId;
        const oldFileId = finalImageFileId;
        finalImageFileId = newFileId;

        // หลังจากบันทึกรูปใหม่สำเร็จ ถ้ามีรูปเก่าให้ย้ายลงถังขยะอย่างปลอดภัย
        if (oldFileId && oldFileId !== newFileId) {
          try {
            const folders = ImageService.getOrCreateFolders();
            ImageService.safeTrashFile(oldFileId, folders.productsFolderId);
          } catch (e) {
            Logger.log('Could not trash old product image: ' + e.message);
          }
        }
      }
    } else if (productData.image_action === 'remove') {
      // ผู้ใช้กดลบรูป
      if (finalImageFileId) {
        try {
          const folders = ImageService.getOrCreateFolders();
          ImageService.safeTrashFile(finalImageFileId, folders.productsFolderId);
        } catch (e) {
          Logger.log('Could not trash product image on remove: ' + e.message);
        }
      }
      finalImageFileId = '';
    }

    const record = {
      // Primary ID mappings (รองรับทั้ง product_id และ id)
      id: productId,
      product_id: productId,

      // SKU / Barcode mappings
      sku: finalSku,
      barcode: productData.barcode || finalSku,

      // Product Name mappings (รองรับทั้ง product_name และ name)
      name: productData.name,
      product_name: productData.name,

      // Category mappings (รองรับทั้ง category_id และ category)
      category: productData.category || '',
      category_id: productData.category || '',

      // Financials
      price: parseFloat(productData.price || 0),
      cost: parseFloat(productData.cost || 0),

      // Stock mappings (รองรับทั้ง stock_qty, stock, min_stock)
      stock: parseFloat(productData.stock || 0),
      stock_qty: parseFloat(productData.stock || 0),
      min_stock: parseFloat(productData.min_stock || 5),
      track_stock: 'TRUE',

      unit: productData.unit || 'ชิ้น',
      image_url: finalImageFileId, // จัดเก็บ Google Drive File ID ในคอลัมน์เดิม

      // Status mappings (รองรับทั้ง is_active และ status)
      status: productData.status || 'ACTIVE',
      is_active: (productData.status === 'DELETED') ? 'FALSE' : 'TRUE',

      updated_at: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss')
    };

    if (isNew) {
      record.created_at = record.updated_at;
      DB.insert(CONFIG.SHEETS.PRODUCTS, record);
      AuditService.log('CREATE_PRODUCT', { id: productId, sku: record.sku, name: record.name });
    } else {
      DB.update(CONFIG.SHEETS.PRODUCTS, 'id', productId, record);
      AuditService.log('UPDATE_PRODUCT', { id: productId, sku: record.sku, name: record.name });
    }

    return {
      success: true,
      product: record
    };
  },

  /**
   * ลบสินค้า
   */
  deleteProduct: function(productId) {
    Auth.requireAdmin();
    const product = this.getProductById(productId);
    if (!product) {
      throw new Error('ไม่พบสินค้าที่ต้องการลบ');
    }

    // หากมีรูปภาพให้จัดการย้ายลงถังขยะ
    if (product.image_url) {
      try {
        const folders = ImageService.getOrCreateFolders();
        ImageService.safeTrashFile(product.image_url, folders.productsFolderId);
      } catch (e) {
        Logger.log('Could not trash product image on product deletion: ' + e.message);
      }
    }

    // อัปเดตสถานะเป็น DELETED หรือลบแถว
    DB.update(CONFIG.SHEETS.PRODUCTS, 'id', productId, {
      status: 'DELETED',
      updated_at: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss')
    });

    AuditService.log('DELETE_PRODUCT', { id: productId, name: product.name });

    return {
      success: true,
      productId: productId
    };
  }
};
