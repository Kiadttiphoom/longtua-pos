/**
 * LongtuaPOS - Expense Service
 */

const ExpenseService = {
  getExpenses: function() {
    Auth.requireAdmin();
    return DB.getAll(CONFIG.SHEETS.EXPENSES);
  }
};
