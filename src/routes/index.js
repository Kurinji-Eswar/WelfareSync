const express = require('express');
const AppError = require('../utils/AppError');
const authRoutes = require('../modules/auth/routes');
const institutionsRoutes = require('../modules/institutions/routes');
const residentsRoutes = require('../modules/residents/routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: 'WelfareSync Engine',
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/auth', authRoutes.router);
router.use('/institutions', institutionsRoutes.router);
router.use('/residents', residentsRoutes.router);

router.use((req, res, next) => {
  next(new AppError('Route not found', 404));
});

module.exports = router;
