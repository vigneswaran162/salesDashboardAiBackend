const express = require('express');
const { body } = require('express-validator');
const { chat } = require('../controllers/chatController');
const { validateRequest } = require('../middleware/errorMiddleware');

const router = express.Router();

router.post(
  '/',
  [
    body('message').isString().trim().notEmpty().withMessage('Message is required')
      .isLength({ max: 2000 }).withMessage('Message cannot exceed 2000 characters'),
    body('history').optional().isArray({ max: 50 }).withMessage('History must be an array'),
  ],
  validateRequest,
  chat,
);

module.exports = router;
