const mongoose = require('mongoose');

const CARE_LOG_TYPES = ['medication', 'nutrition', 'vitals', 'activity'];

const careLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      trim: true,
    },
    residentId: {
      type: String,
      required: true,
      trim: true,
    },
    caretakerId: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: CARE_LOG_TYPES,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    recordedAt: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    collection: 'care_logs',
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
    versionKey: false,
  },
);

careLogSchema.index({ tenantId: 1 });
careLogSchema.index({ residentId: 1 });
careLogSchema.index({ type: 1 });
careLogSchema.index({ recordedAt: -1 });
careLogSchema.index({ tenantId: 1, residentId: 1, recordedAt: -1 });
careLogSchema.index({ tenantId: 1, type: 1, recordedAt: -1 });
careLogSchema.index({ tenantId: 1, caretakerId: 1, recordedAt: -1 });

module.exports = {
  CareLog: mongoose.model('CareLog', careLogSchema),
  CARE_LOG_TYPES,
};
