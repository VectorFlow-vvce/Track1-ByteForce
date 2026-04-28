const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

let Location, Patient;
try { Location = require('../models/Location'); } catch(e) {}
try { Patient = require('../models/Patient'); } catch(e) {}

// POST /api/locations — receive GPS update from patient device
router.post('/', async (req, res) => {
  try {
    const { patientId, lat, lng, accuracy } = req.body;
    if (!patientId || lat === undefined || lng === undefined)
      return res.status(400).json({ error: 'patientId, lat, lng required' });

    const locationData = { patientId, lat, lng, accuracy: accuracy || 10, timestamp: new Date() };

    if (Location) {
      const loc = await Location.create(locationData);
    }

    // Update patient's stored position and lastSeen in DB
    if (Patient) {
      const patient = await Patient.findById(patientId);
      if (patient) {
        // If this is the first GPS from patient's phone, set it as safe zone center
        if (patient.safeZoneCenter.lat === 0 && patient.safeZoneCenter.lng === 0) {
          patient.safeZoneCenter = { lat, lng };
        }
        patient.lastSeen = new Date();
        await patient.save();

        // Check geofence
        const dist = getDistance(lat, lng, patient.safeZoneCenter.lat, patient.safeZoneCenter.lng);
        if (dist > patient.safeZoneRadius) {
          req.io.emit('geofence-exit', { patientId, patientName: patient.name, lat, lng, distance: Math.round(dist) });
        }
      }
    }

    // Broadcast to all connected dashboards
    req.io.emit('location-updated', locationData);
    res.status(201).json(locationData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/locations/:patientId — get recent locations
router.get('/:patientId', authMiddleware, async (req, res) => {
  try {
    if (Location) {
      const locations = await Location.find({ patientId: req.params.patientId })
        .sort({ timestamp: -1 }).limit(50);
      return res.json(locations);
    }
    // Demo: return simulated path
    const base = { lat: 12.9716, lng: 77.5946 };
    const locs = Array.from({ length: 10 }, (_, i) => ({
      patientId: req.params.patientId,
      lat: base.lat + (Math.random() - 0.5) * 0.001,
      lng: base.lng + (Math.random() - 0.5) * 0.001,
      timestamp: new Date(Date.now() - i * 30000)
    }));
    res.json(locs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Haversine distance in meters
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

module.exports = router;
