const AppError = require('../utils/AppError');

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;
  const isOperational = error instanceof AppError || error.isOperational;

  return res.status(statusCode).json({
    success: false,
    error: {
      message: isOperational ? error.message : 'Internal server error',
      statusCode,
      details: isOperational ? error.details : null,
    },
  });
};

module.exports = errorHandler;
