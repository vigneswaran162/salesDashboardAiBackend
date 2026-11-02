const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const { asyncHandler, httpError } = require('../middleware/errorMiddleware');

const SORTABLE_FIELDS = [
  'invoiceNumber',
  'customerName',
  'productName',
  'quantity',
  'unitPrice',
  'discount',
  'totalAmount',
  'paymentMethod',
  'saleDate',
  'status',
  'createdAt',
];
const MAX_PAGE_SIZE = 100;
const EDITABLE_FIELDS = [
  'customerName',
  'customerEmail',
  'customerPhone',
  'quantity',
  'discount',
  'paymentMethod',
  'status',
  'saleDate',
  'notes',
];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Builds a MongoDB filter from the list query string. */
const buildFilter = ({ search, status, paymentMethod, startDate, endDate }) => {
  const filter = {};

  if (search && search.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ customerName: regex }, { invoiceNumber: regex }];
  }
  if (status) filter.status = status;
  if (paymentMethod) filter.paymentMethod = paymentMethod;

  if (startDate || endDate) {
    filter.saleDate = {};
    if (startDate) filter.saleDate.$gte = new Date(startDate);
    if (endDate) {
      // Make the end date inclusive by using the start of the following day.
      const end = new Date(endDate);
      end.setUTCDate(end.getUTCDate() + 1);
      filter.saleDate.$lt = end;
    }
  }

  return filter;
};

const findActiveProduct = async (productId) => {
  const product = await Product.findById(productId).lean();
  if (!product) throw httpError(400, 'Selected product does not exist');
  if (!product.isActive) throw httpError(400, 'Selected product is no longer active');
  return product;
};

const assertDiscountWithinSubtotal = ({ quantity, unitPrice, discount }) => {
  if (Number(discount || 0) > Number(quantity) * Number(unitPrice)) {
    throw httpError(400, 'Discount cannot exceed the subtotal (quantity x unit price)');
  }
};

/**
 * GET /api/sales
 * Query: page, limit, search, status, paymentMethod, startDate, endDate, sortBy, sortOrder
 */
const getSales = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), MAX_PAGE_SIZE);
  const sortBy = SORTABLE_FIELDS.includes(req.query.sortBy) ? req.query.sortBy : 'saleDate';
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

  const filter = buildFilter(req.query);

  const [data, total] = await Promise.all([
    Sale.find(filter)
      .sort({ [sortBy]: sortOrder, _id: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Sale.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
});

/** GET /api/sales/:id */
const getSaleById = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id).lean();
  if (!sale) throw httpError(404, 'Sale not found');
  res.json({ success: true, data: sale });
});

/** POST /api/sales — invoice number, product details and total are derived on the server. */
const createSale = asyncHandler(async (req, res) => {
  const product = await findActiveProduct(req.body.productId);

  const payload = {};
  EDITABLE_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) payload[field] = req.body[field];
  });
  payload.productId = product._id;
  payload.productName = product.name;
  payload.category = product.category;
  payload.unitPrice = req.body.unitPrice !== undefined ? Number(req.body.unitPrice) : product.price;
  payload.discount = Number(payload.discount || 0);

  assertDiscountWithinSubtotal(payload);
  payload.totalAmount = Sale.calculateTotal(payload.quantity, payload.unitPrice, payload.discount);

  // Retry if two requests generate the same invoice number concurrently.
  for (let attempt = 1; ; attempt++) {
    try {
      payload.invoiceNumber = await Sale.generateInvoiceNumber();
      const sale = await Sale.create(payload);
      return res.status(201).json({ success: true, message: 'Sale created successfully', data: sale });
    } catch (err) {
      const isInvoiceClash = err.code === 11000 && err.keyPattern && err.keyPattern.invoiceNumber;
      if (!isInvoiceClash || attempt >= 5) throw err;
    }
  }
});

/** PUT /api/sales/:id — recalculates the total from the merged values. */
const updateSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id);
  if (!sale) throw httpError(404, 'Sale not found');

  EDITABLE_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) sale[field] = req.body[field];
  });

  const productChanged = req.body.productId && String(req.body.productId) !== String(sale.productId);
  if (productChanged) {
    const product = await findActiveProduct(req.body.productId);
    sale.productId = product._id;
    sale.productName = product.name;
    sale.category = product.category;
    sale.unitPrice = product.price;
  }
  if (req.body.unitPrice !== undefined) sale.unitPrice = Number(req.body.unitPrice);

  assertDiscountWithinSubtotal(sale);
  sale.totalAmount = Sale.calculateTotal(sale.quantity, sale.unitPrice, sale.discount);

  await sale.save();
  res.json({ success: true, message: 'Sale updated successfully', data: sale });
});

/** DELETE /api/sales/:id */
const deleteSale = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, 'Invalid sale id');
  const sale = await Sale.findByIdAndDelete(req.params.id);
  if (!sale) throw httpError(404, 'Sale not found');
  res.json({ success: true, message: `Sale ${sale.invoiceNumber} deleted successfully`, data: { _id: sale._id } });
});

module.exports = { getSales, getSaleById, createSale, updateSale, deleteSale };
