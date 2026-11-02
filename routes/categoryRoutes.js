const express = require('express');
const { body, param } = require('express-validator');
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');
const { validateRequest } = require('../middleware/errorMiddleware');

const router = express.Router();

const idRule = param('id').isMongoId().withMessage('Invalid category id');

const categoryBodyRules = (isUpdate) => {
  const name = isUpdate ? body('name').optional() : body('name');
  return [
    name.trim().notEmpty().withMessage('Category name is required')
      .isLength({ max: 60 }).withMessage('Category name cannot exceed 60 characters'),
    body('description').optional().trim().isLength({ max: 200 }).withMessage('Description cannot exceed 200 characters'),
    body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
  ];
};

router.route('/')
  .get(getCategories)
  .post(categoryBodyRules(false), validateRequest, createCategory);

router.route('/:id')
  .put(idRule, categoryBodyRules(true), validateRequest, updateCategory)
  .delete(idRule, validateRequest, deleteCategory);

module.exports = router;
