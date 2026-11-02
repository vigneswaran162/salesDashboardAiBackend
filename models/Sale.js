const mongoose = require('mongoose');

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Net Banking'];
const SALE_STATUSES = ['Completed', 'Pending', 'Cancelled'];
const INVOICE_PREFIX = 'INV-';
const INVOICE_DIGITS = 6;

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [100, 'Customer name cannot exceed 100 characters'],
    },
    customerEmail: {
      type: String,
      required: [true, 'Customer email is required'],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    customerPhone: {
      type: String,
      required: [true, 'Customer phone is required'],
      trim: true,
      match: [/^\+?[0-9][0-9\s-]{6,14}$/, 'Invalid phone number'],
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required'],
    },
    productName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be greater than zero'],
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' },
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative'],
    },
    paymentMethod: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: { values: PAYMENT_METHODS, message: 'Invalid payment method' },
    },
    status: {
      type: String,
      enum: { values: SALE_STATUSES, message: 'Invalid status' },
      default: 'Pending',
    },
    saleDate: {
      type: Date,
      required: [true, 'Sale date is required'],
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  { timestamps: true, collection: 'sales' }
);

// invoiceNumber is indexed through `unique: true` above.
saleSchema.index({ customerName: 1 });
saleSchema.index({ saleDate: -1 });
saleSchema.index({ productId: 1 });
saleSchema.index({ status: 1, paymentMethod: 1 });

/** Subtotal = quantity x unitPrice; Total = Subtotal - discount (never below zero). */
saleSchema.statics.calculateTotal = function (quantity, unitPrice, discount = 0) {
  const subtotal = Number(quantity) * Number(unitPrice);
  return Math.max(0, Math.round((subtotal - Number(discount || 0)) * 100) / 100);
};

/** Returns the next sequential invoice number, e.g. INV-000201. */
saleSchema.statics.generateInvoiceNumber = async function () {
  const pattern = new RegExp(`^${INVOICE_PREFIX}\\d{${INVOICE_DIGITS}}$`);
  const last = await this.findOne({ invoiceNumber: pattern })
    .sort({ invoiceNumber: -1 })
    .select('invoiceNumber')
    .lean();
  const lastNumber = last ? parseInt(last.invoiceNumber.slice(INVOICE_PREFIX.length), 10) : 0;
  return `${INVOICE_PREFIX}${String(lastNumber + 1).padStart(INVOICE_DIGITS, '0')}`;
};

const Sale = mongoose.model('Sale', saleSchema);

module.exports = Sale;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports.SALE_STATUSES = SALE_STATUSES;
