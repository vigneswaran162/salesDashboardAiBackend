const express = require('express');
const { body, param, query } = require('express-validator');
const { getSales, getSaleById, createSale, updateSale, deleteSale } = require('../controllers/salesController');
const { validateRequest } = require('../middleware/errorMiddleware');
const { PAYMENT_METHODS, SALE_STATUSES } = require('../models/Sale');

const router = express.Router();

const idRule = param('id').isMongoId().withMessage('Invalid sale id');

/** Shared body rules. On update every field is optional, but still validated when present. */
const saleBodyRules = (isUpdate) => {
  const field = (name) => (isUpdate ? body(name).optional() : body(name));
  return [
    field('customerName').trim().notEmpty().withMessage('Customer name is required')
      .isLength({ max: 100 }).withMessage('Customer name cannot exceed 100 characters'),
    field('customerEmail').trim().notEmpty().withMessage('Customer email is required')
      .isEmail().withMessage('Invalid email address'),
    field('customerPhone').trim().notEmpty().withMessage('Customer phone is required')
      .matches(/^\+?[0-9][0-9\s-]{6,14}$/).withMessage('Invalid phone number'),
    field('productId').isMongoId().withMessage('A valid product is required'),
    field('quantity').isInt({ gt: 0 }).withMessage('Quantity must be a whole number greater than zero').toInt(),
    body('unitPrice').optional().isFloat({ min: 0 }).withMessage('Unit price cannot be negative').toFloat(),
    body('discount').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Discount cannot be negative').toFloat(),
    field('paymentMethod').isIn(PAYMENT_METHODS).withMessage(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`),
    body('status').optional().isIn(SALE_STATUSES).withMessage(`Status must be one of: ${SALE_STATUSES.join(', ')}`),
    field('saleDate').isISO8601().withMessage('Sale date must be a valid date').toDate(),
    body('notes').optional({ values: 'null' }).isString().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
  ];
};

const listRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('status').optional({ values: 'falsy' }).isIn(SALE_STATUSES).withMessage('Invalid status filter'),
  query('paymentMethod').optional({ values: 'falsy' }).isIn(PAYMENT_METHODS).withMessage('Invalid payment method filter'),
  query('startDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid startDate'),
  query('endDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid endDate'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('sortOrder must be asc or desc'),
];

router.route('/')
  .get(listRules, validateRequest, getSales)
  .post(saleBodyRules(false), validateRequest, createSale);

router.route('/:id')
  .get(idRule, validateRequest, getSaleById)
  .put(idRule, saleBodyRules(true), validateRequest, updateSale)
  .delete(idRule, validateRequest, deleteSale);

module.exports = router;
