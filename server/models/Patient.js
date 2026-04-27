const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number, required: true },
  condition: { type: String, default: 'Dementia' },
  caregiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  safeZoneRadius: { type: Number, default: 100 }, // meters
  safeZoneCenter: {
    lat: { type: Number, default: 12.9716 },
    lng: { type: Number, default: 77.5946 }
  },
  deviceId: { type: String },
  status: { type: String, enum: ['safe', 'warning', 'danger'], default: 'safe' },
  lastSeen: { type: Date, default: Date.now },
  photo: { type: String, default: '' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Patient', patientSchema);
