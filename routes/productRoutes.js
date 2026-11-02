const express = require('express');
const { body, param } = require('express-validator');
const { getProducts, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { validateRequest } = require('../middleware/errorMiddleware');

const router = express.Router();

const idRule = param('id').isMongoId().withMessage('Invalid product id');

const productBodyRules = (isUpdate) => {
  const field = (name) => (isUpdate ? body(name).optional() : body(name));
  return [
    field('name').trim().notEmpty().withMessage('Product name is required')
      .isLength({ max: 120 }).withMessage('Product name cannot exceed 120 characters'),
    field('category').trim().notEmpty().withMessage('Category is required')
      .isLength({ max: 60 }).withMessage('Category cannot exceed 60 characters'),
    field('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number').toFloat(),
    body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer').toInt(),
    body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
  ];
};

router.route('/')
  .get(getProducts)
  .post(productBodyRules(false), validateRequest, createProduct);

router.route('/:id')
  .put(idRule, productBodyRules(true), validateRequest, updateProduct)
  .delete(idRule, validateRequest, deleteProduct);

module.exports = router;
