const express = require('express');
const AppError = require('../utils/AppError');
const authRoutes = require('../modules/auth/routes');
const institutionsRoutes = require('../modules/institutions/routes');
const residentsRoutes = require('../modules/residents/routes');
const logsRoutes = require('../modules/logs/routes');
const analyticsRoutes = require('../modules/analytics/routes');
const notificationsRoutes = require('../modules/notifications/routes');
const dashboardRoutes = require('../modules/dashboard/routes');

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
router.use('/logs', logsRoutes.router);
router.use('/analytics', analyticsRoutes.router);
router.use('/notifications', notificationsRoutes.router);
router.use('/dashboard', dashboardRoutes.router);
router.use('/residents/:residentId/logs', logsRoutes.residentLogsRouter);
router.use('/residents', residentsRoutes.router);

router.use((req, res, next) => {
  next(new AppError('Route not found', 404));
});

module.exports = router;
