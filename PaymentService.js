/**
 * LongtuaPOS - Payment Service
 */

const PaymentService = {
  getPayments: function() {
    Auth.requireAdmin();
    return DB.getAll(CONFIG.SHEETS.PAYMENTS);
  }
};
