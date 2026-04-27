const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

let Patient;
try { Patient = require('../models/Patient'); } catch(e) {}

// Demo patients for no-DB mode
const demoPatients = [
  { _id: 'P1', name: 'Margaret Wilson', age: 78, condition: 'Alzheimer\'s Stage 2', status: 'safe', safeZoneRadius: 100, safeZoneCenter: { lat: 12.9716, lng: 77.5946 }, lastSeen: new Date() },
  { _id: 'P2', name: 'Robert Chen', age: 82, condition: 'Vascular Dementia', status: 'warning', safeZoneRadius: 150, safeZoneCenter: { lat: 12.9720, lng: 77.5950 }, lastSeen: new Date() },
  { _id: 'P3', name: 'Dorothy Hayes', age: 75, condition: 'Lewy Body Dementia', status: 'safe', safeZoneRadius: 80, safeZoneCenter: { lat: 12.9710, lng: 77.5940 }, lastSeen: new Date() }
];

// GET /api/patients
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (Patient) {
      const patients = await Patient.find({ caregiverId: req.user.id });
      return res.json(patients);
    }
    res.json(demoPatients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/patients/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    if (Patient) {
      const patient = await Patient.findById(req.params.id);
      if (!patient) return res.status(404).json({ error: 'Patient not found' });
      return res.json(patient);
    }
    const p = demoPatients.find(p => p._id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Patient not found' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/patients
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, age, condition, safeZoneRadius, safeZoneCenter, notes } = req.body;
    if (!name || !age) return res.status(400).json({ error: 'Name and age required' });

    if (Patient) {
      const patient = await Patient.create({ name, age, condition, safeZoneRadius, safeZoneCenter, notes, caregiverId: req.user.id });
      req.io.emit('patient-added', patient);
      return res.status(201).json(patient);
    }

    const newPatient = { _id: `P${Date.now()}`, name, age, condition, safeZoneRadius: safeZoneRadius || 100, status: 'safe', lastSeen: new Date() };
    demoPatients.push(newPatient);
    req.io.emit('patient-added', newPatient);
    res.status(201).json(newPatient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/patients/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (Patient) {
      const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true });
      return res.json(patient);
    }
    res.json({ ...demoPatients[0], ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
