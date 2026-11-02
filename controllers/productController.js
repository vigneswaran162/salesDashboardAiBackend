const Product = require('../models/Product');
const Sale = require('../models/Sale');
const { asyncHandler, httpError } = require('../middleware/errorMiddleware');

const PRODUCT_FIELDS = ['name', 'category', 'price', 'stock', 'isActive'];

const pickProductFields = (body) =>
  PRODUCT_FIELDS.reduce((acc, field) => {
    if (body[field] !== undefined) acc[field] = body[field];
    return acc;
  }, {});

/** GET /api/products — active products only; pass ?includeInactive=true to get all. */
const getProducts = asyncHandler(async (req, res) => {
  const filter = req.query.includeInactive === 'true' ? {} : { isActive: true };
  const products = await Product.find(filter).sort({ name: 1 }).lean();
  res.json({ success: true, count: products.length, data: products });
});

/** POST /api/products */
const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(pickProductFields(req.body));
  res.status(201).json({ success: true, message: 'Product created successfully', data: product });
});

/** PUT /api/products/:id */
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, pickProductFields(req.body), {
    new: true,
    runValidators: true,
  });
  if (!product) throw httpError(404, 'Product not found');
  res.json({ success: true, message: 'Product updated successfully', data: product });
});

/**
 * DELETE /api/products/:id
 * Products referenced by existing sales are deactivated instead of removed,
 * so sales history keeps a valid productId reference.
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw httpError(404, 'Product not found');

  const salesCount = await Sale.countDocuments({ productId: product._id });
  if (salesCount > 0) {
    product.isActive = false;
    await product.save();
    return res.json({
      success: true,
      message: `Product is used by ${salesCount} sale(s), so it was deactivated instead of deleted`,
      data: product,
    });
  }

  await product.deleteOne();
  res.json({ success: true, message: 'Product deleted successfully', data: { _id: product._id } });
});

module.exports = { getProducts, createProduct, updateProduct, deleteProduct };
