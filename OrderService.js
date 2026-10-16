/**
 * LongtuaPOS - Order Service
 */

const OrderService = {
  getOrders: function() {
    Auth.requireAdmin();
    return DB.getAll(CONFIG.SHEETS.ORDERS);
  },

  getOrderById: function(id) {
    Auth.requireAdmin();
    const order = DB.findOne(CONFIG.SHEETS.ORDERS, 'id', id);
    if (!order) return null;

    const items = DB.find(CONFIG.SHEETS.ORDER_ITEMS, function(item) {
      return String(item.order_id) === String(id);
    });

    return {
      order: order,
      items: items
    };
  }
};
