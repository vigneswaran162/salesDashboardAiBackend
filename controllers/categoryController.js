const Category = require('../models/Category');
const Product = require('../models/Product');
const { asyncHandler, httpError } = require('../middleware/errorMiddleware');

const CATEGORY_FIELDS = ['name', 'description', 'isActive'];

const pickCategoryFields = (body) =>
  CATEGORY_FIELDS.reduce((acc, field) => {
    if (body[field] !== undefined) acc[field] = body[field];
    return acc;
  }, {});

/** Adds a category record for every category name already used by a product but missing here. */
const syncFromProducts = async () => {
  const [used, existing] = await Promise.all([Product.distinct('category'), Category.distinct('name')]);
  const known = new Set(existing);
  const missing = used.filter((name) => name && !known.has(name));
  if (missing.length) {
    await Category.insertMany(missing.map((name) => ({ name })), { ordered: false }).catch((err) => {
      if (err.code !== 11000 && !err.writeErrors) throw err; // ignore duplicate races
    });
  }
};

/** GET /api/categories — active only; pass ?includeInactive=true to get all. Each item includes productCount. */
const getCategories = asyncHandler(async (req, res) => {
  await syncFromProducts();
  const filter = req.query.includeInactive === 'true' ? {} : { isActive: true };
  const [categories, counts] = await Promise.all([
    Category.find(filter).sort({ name: 1 }).lean(),
    Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const countByName = new Map(counts.map((c) => [c._id, c.count]));
  const data = categories.map((c) => ({ ...c, productCount: countByName.get(c.name) ?? 0 }));
  res.json({ success: true, count: data.length, data });
});

/** POST /api/categories */
const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create(pickCategoryFields(req.body));
  res.status(201).json({ success: true, message: 'Category created successfully', data: category });
});

/** PUT /api/categories/:id — renaming also updates the category on its products. */
const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw httpError(404, 'Category not found');

  const oldName = category.name;
  category.set(pickCategoryFields(req.body));
  await category.save();

  if (category.name !== oldName) {
    await Product.updateMany({ category: oldName }, { $set: { category: category.name } });
  }
  res.json({ success: true, message: 'Category updated successfully', data: category });
});

/** DELETE /api/categories/:id — refused while products still use the category. */
const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw httpError(404, 'Category not found');

  const productCount = await Product.countDocuments({ category: category.name });
  if (productCount > 0) {
    throw httpError(409, `Category is used by ${productCount} product(s). Reassign or delete them first.`);
  }

  await category.deleteOne();
  res.json({ success: true, message: 'Category deleted successfully', data: { _id: category._id } });
});

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
