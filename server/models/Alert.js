const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['GEOFENCE_EXIT', 'VOICE_EMERGENCY', 'FALL_DETECTED', 'ROUTINE_MISSED', 'GEOFENCE_ENTER', 'SOS'],
    required: true
  },
  message: { type: String, required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  caregiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'HIGH' },
  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date },
  time: { type: Date, default: Date.now }
});

alertSchema.index({ patientId: 1, time: -1 });
alertSchema.index({ caregiverId: 1, resolved: 1 });

module.exports = mongoose.model('Alert', alertSchema);
