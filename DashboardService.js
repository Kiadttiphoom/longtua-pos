/**
 * LongtuaPOS - Dashboard Service
 * รวบรวมข้อมูลสรุปยอดขาย สต็อกสินค้า รายจ่าย และสถิติต่างๆ จากชีตทั้ง 9 ชีต
 */

const DashboardService = {
  /**
   * ดึงข้อมูลภาพรวมแดชบอร์ดทั้งหมด
   */
  getDashboardData: function() {
    Auth.requireAdmin();

    try {
      const sheetsSummary = DB.readAllSheetsSummary();
      const products = DB.getAll(CONFIG.SHEETS.PRODUCTS);
      const categories = DB.getAll(CONFIG.SHEETS.CATEGORIES);
      const orders = DB.getAll(CONFIG.SHEETS.ORDERS);
      const orderItems = DB.getAll(CONFIG.SHEETS.ORDER_ITEMS);
      const payments = DB.getAll(CONFIG.SHEETS.PAYMENTS);
      const expenses = DB.getAll(CONFIG.SHEETS.EXPENSES);
      const users = DB.getAll(CONFIG.SHEETS.USERS);
      const auditLogs = DB.getAll(CONFIG.SHEETS.AUDIT_LOGS);

      // 1. คำนวณยอดขายรวม
      let totalSales = 0;
      let todaySales = 0;
      const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd');

      orders.forEach(order => {
        const amount = parseFloat(order.total_amount || order.grand_total || order.total || order.amount || 0);
        totalSales += isNaN(amount) ? 0 : amount;

        const orderDate = String(order.date || order.created_at || order.timestamp || '');
        if (orderDate.startsWith(todayStr)) {
          todaySales += isNaN(amount) ? 0 : amount;
        }
      });

      // 2. คำนวณรายจ่ายรวม
      let totalExpenses = 0;
      expenses.forEach(exp => {
        const amount = parseFloat(exp.amount || exp.total || 0);
        totalExpenses += isNaN(amount) ? 0 : amount;
      });

      // 3. คำนวณสถานะสต็อกสินค้า
      let lowStockCount = 0;
      const lowStockProducts = [];
      products.forEach(p => {
        const stock = parseFloat(p.stock || p.quantity || p.inventory || 0);
        const minStock = parseFloat(p.min_stock || p.low_stock_threshold || 5);
        if (stock <= minStock) {
          lowStockCount++;
          lowStockProducts.push({
            name: p.name || p.product_name || 'สินค้า',
            sku: p.sku || p.barcode || '-',
            stock: stock,
            minStock: minStock
          });
        }
      });

      // 4. คำนวณประเภทการชำระเงิน
      const paymentSummary = {};
      payments.forEach(pay => {
        const method = String(pay.method || pay.payment_method || 'เงินสด');
        const amount = parseFloat(pay.amount || 0);
        paymentSummary[method] = (paymentSummary[method] || 0) + (isNaN(amount) ? 0 : amount);
      });

      // 5. รายการออเดอร์ล่าสุด (5 รายการ)
      const recentOrders = orders.slice(-5).reverse().map(order => ({
        id: order.id || order.order_id || order.order_no || '-',
        date: order.date || order.created_at || '-',
        customer: order.customer_name || 'ลูกค้าทั่วไป',
        total: parseFloat(order.total_amount || order.grand_total || order.total || 0),
        status: order.status || 'COMPLETED'
      }));

      // 6. ประวัติกิจกรรมล่าสุด (Audit Logs) 5 รายการ
      const recentLogs = auditLogs.slice(-5).reverse().map(log => ({
        timestamp: log.timestamp || log.created_at || '-',
        user: log.user || log.email || 'ระบบ',
        action: log.action || '-',
        details: log.details || log.description || '-'
      }));

      return {
        success: true,
        summary: {
          totalSales: totalSales,
          todaySales: todaySales,
          totalExpenses: totalExpenses,
          netProfit: totalSales - totalExpenses,
          totalOrders: orders.length,
          totalProducts: products.length,
          totalCategories: categories.length,
          lowStockCount: lowStockCount,
          totalUsers: users.length
        },
        sheetsSummary: sheetsSummary,
        recentOrders: recentOrders,
        lowStockProducts: lowStockProducts.slice(0, 5),
        paymentSummary: paymentSummary,
        recentLogs: recentLogs,
        appConfig: {
          appName: CONFIG.APP_NAME,
          version: CONFIG.APP_VERSION,
          currency: CONFIG.DEFAULT_SETTINGS.currency_symbol
        }
      };
    } catch (err) {
      Logger.log('Error in getDashboardData: ' + err.stack);
      return {
        success: false,
        error: err.toString()
      };
    }
  },

  /**
   * ดึงข้อมูลดิบของชีตที่ระบุสำหรับดูและตรวจสอบ
   */
  getSheetData: function(sheetKey) {
    Auth.requireAdmin();
    const sheetName = CONFIG.SHEETS[sheetKey] || sheetKey;
    const items = DB.getAll(sheetName);
    return {
      success: true,
      sheetName: sheetName,
      items: items
    };
  }
};
