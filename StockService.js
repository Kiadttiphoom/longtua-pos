/**
 * LongtuaPOS - Stock Service
 */

const StockService = {
  getLowStockItems: function() {
    Auth.requireAdmin();
    const products = DB.getAll(CONFIG.SHEETS.PRODUCTS);
    return products.filter(p => {
      const stock = parseFloat(p.stock || p.quantity || 0);
      const minStock = parseFloat(p.min_stock || 5);
      return stock <= minStock;
    });
  }
};
