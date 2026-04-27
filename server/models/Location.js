const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  accuracy: { type: Number, default: 10 },
  timestamp: { type: Date, default: Date.now }
});

// Index for fast queries
locationSchema.index({ patientId: 1, timestamp: -1 });

module.exports = mongoose.model('Location', locationSchema);
