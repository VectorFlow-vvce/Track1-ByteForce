const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

let Alert;
try { Alert = require('../models/Alert'); } catch(e) {}

const demoAlerts = [
  { _id: 'A1', type: 'GEOFENCE_EXIT', message: 'Margaret left safe zone', patientId: 'P1', severity: 'HIGH', resolved: false, time: new Date(Date.now() - 300000) },
  { _id: 'A2', type: 'VOICE_EMERGENCY', message: '"Help" detected from Robert', patientId: 'P2', severity: 'CRITICAL', resolved: false, time: new Date(Date.now() - 600000) },
  { _id: 'A3', type: 'ROUTINE_MISSED', message: 'Dorothy missed medication at 2:00 PM', patientId: 'P3', severity: 'MEDIUM', resolved: true, time: new Date(Date.now() - 3600000) }
];

// POST /api/alerts — create alert (from device or voice detection)
router.post('/', async (req, res) => {
  try {
    const { type, message, patientId, severity, caregiverId } = req.body;
    if (!type || !message || !patientId)
      return res.status(400).json({ error: 'type, message, patientId required' });

    const alertData = { type, message, patientId, severity: severity || 'HIGH', caregiverId, time: new Date() };

    if (Alert) {
      const alert = await Alert.create(alertData);
      req.io.emit('new-alert', alert);
      return res.status(201).json(alert);
    }

    // Demo mode
    const newAlert = { _id: `A${Date.now()}`, ...alertData, resolved: false };
    demoAlerts.unshift(newAlert);
    req.io.emit('new-alert', newAlert);
    res.status(201).json(newAlert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts — get all alerts for caregiver
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { resolved, limit = 20 } = req.query;
    if (Alert) {
      const query = { caregiverId: req.user.id };
      if (resolved !== undefined) query.resolved = resolved === 'true';
      const alerts = await Alert.find(query).sort({ time: -1 }).limit(Number(limit)).populate('patientId', 'name');
      return res.json(alerts);
    }
    res.json(demoAlerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/alerts/:id/resolve
router.patch('/:id/resolve', authMiddleware, async (req, res) => {
  try {
    if (Alert) {
      const alert = await Alert.findByIdAndUpdate(req.params.id, { resolved: true, resolvedAt: new Date() }, { new: true });
      req.io.emit('alert-resolved', { id: req.params.id });
      return res.json(alert);
    }
    const a = demoAlerts.find(a => a._id === req.params.id);
    if (a) a.resolved = true;
    req.io.emit('alert-resolved', { id: req.params.id });
    res.json({ message: 'Resolved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
