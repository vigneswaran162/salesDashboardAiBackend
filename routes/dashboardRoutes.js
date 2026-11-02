const express = require('express');
const {
  getSummary,
  getMonthlySales,
  getCategorySales,
  getPaymentSummary,
  getRecentSales,
} = require('../controllers/dashboardController');

const router = express.Router();

router.get('/summary', getSummary);
router.get('/monthly-sales', getMonthlySales);
router.get('/category-sales', getCategorySales);
router.get('/payment-summary', getPaymentSummary);
router.get('/recent-sales', getRecentSales);

module.exports = router;
