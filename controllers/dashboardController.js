const Sale = require('../models/Sale');
const Product = require('../models/Product');
const { asyncHandler } = require('../middleware/errorMiddleware');

// Revenue counts only completed sales; pending and cancelled sales are not earned revenue.
const REVENUE_STATUS = 'Completed';
const revenueExpr = { $sum: { $cond: [{ $eq: ['$status', REVENUE_STATUS] }, '$totalAmount', 0] } };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** GET /api/dashboard/summary */
const getSummary = asyncHandler(async (req, res) => {
  const [salesStats] = await Sale.aggregate([
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalSales: { $sum: 1 },
              totalRevenue: revenueExpr,
              completedSales: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
              pendingSales: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
              cancelledSales: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] } },
            },
          },
        ],
        customers: [{ $group: { _id: { $toLower: '$customerEmail' } } }, { $count: 'count' }],
      },
    },
  ]);

  const totals = salesStats.totals[0] || {};
  const totalProducts = await Product.countDocuments({ isActive: true });

  res.json({
    success: true,
    data: {
      totalSales: totals.totalSales || 0,
      totalRevenue: Math.round((totals.totalRevenue || 0) * 100) / 100,
      totalProducts,
      totalCustomers: salesStats.customers[0]?.count || 0,
      completedSales: totals.completedSales || 0,
      pendingSales: totals.pendingSales || 0,
      cancelledSales: totals.cancelledSales || 0,
    },
  });
});

/** GET /api/dashboard/monthly-sales?months=12 — the most recent N months that have sales. */
const getMonthlySales = asyncHandler(async (req, res) => {
  const months = Math.min(Math.max(parseInt(req.query.months, 10) || 12, 1), 36);

  const rows = await Sale.aggregate([
    {
      $group: {
        _id: { year: { $year: '$saleDate' }, month: { $month: '$saleDate' } },
        salesCount: { $sum: 1 },
        revenue: revenueExpr,
        quantity: { $sum: '$quantity' },
      },
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: months },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    {
      $project: {
        _id: 0,
        year: '$_id.year',
        month: '$_id.month',
        salesCount: 1,
        quantity: 1,
        revenue: { $round: ['$revenue', 2] },
      },
    },
  ]);

  const data = rows.map((r) => ({ ...r, label: `${MONTH_NAMES[r.month - 1]} ${r.year}` }));
  res.json({ success: true, data });
});

/** GET /api/dashboard/category-sales */
const getCategorySales = asyncHandler(async (req, res) => {
  const data = await Sale.aggregate([
    {
      $group: {
        _id: '$category',
        salesCount: { $sum: 1 },
        quantity: { $sum: '$quantity' },
        revenue: revenueExpr,
      },
    },
    { $project: { _id: 0, category: '$_id', salesCount: 1, quantity: 1, revenue: { $round: ['$revenue', 2] } } },
    { $sort: { revenue: -1 } },
  ]);
  res.json({ success: true, data });
});

/** GET /api/dashboard/payment-summary */
const getPaymentSummary = asyncHandler(async (req, res) => {
  const data = await Sale.aggregate([
    {
      $group: {
        _id: '$paymentMethod',
        salesCount: { $sum: 1 },
        revenue: revenueExpr,
      },
    },
    { $project: { _id: 0, paymentMethod: '$_id', salesCount: 1, revenue: { $round: ['$revenue', 2] } } },
    { $sort: { salesCount: -1 } },
  ]);
  res.json({ success: true, data });
});

/** GET /api/dashboard/recent-sales?limit=5 */
const getRecentSales = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
  const data = await Sale.aggregate([
    { $sort: { saleDate: -1, createdAt: -1 } },
    { $limit: limit },
    {
      $project: {
        invoiceNumber: 1,
        customerName: 1,
        productName: 1,
        quantity: 1,
        totalAmount: 1,
        paymentMethod: 1,
        status: 1,
        saleDate: 1,
      },
    },
  ]);
  res.json({ success: true, data });
});

module.exports = { getSummary, getMonthlySales, getCategorySales, getPaymentSummary, getRecentSales };
