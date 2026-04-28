const express = require('express');
const router = express.Router();
const { sendAlertEmail } = require('../services/mailer');

let Patient, User;
try { Patient = require('../models/Patient'); } catch(e) {}
try { User = require('../models/User'); } catch(e) {}

// POST /api/sos/email — Send SOS email alert
router.post('/email', async (req, res) => {
  try {
    const { to, subject, message, patientId } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message required' });

    const result = await sendAlertEmail(to, subject || 'Emergency SOS Alert', message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sos/alert-all — Send alert to ALL registered caregiver emails
router.post('/alert-all', async (req, res) => {
  try {
    const { subject, message, patientId } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const results = [];

    // Get all caregivers from DB
    if (User) {
      const caregivers = await User.find({});
      for (const cg of caregivers) {
        if (cg.email) {
          const r = await sendAlertEmail(cg.email, subject || 'Emergency Alert', message);
          results.push({ email: cg.email, ...r });
        }
      }
    }

    res.json({ sent: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sos/voice-alert — Voice emergency detected, alert all
router.post('/voice-alert', async (req, res) => {
  try {
    const { keyword, transcript, patientId } = req.body;
    const subject = 'VOICE EMERGENCY - "' + (keyword || 'help') + '" detected';
    const message = 'Emergency keyword "' + (keyword || 'unknown') + '" was detected by CareBand voice monitoring.<br><br>' +
      '<strong>Transcript:</strong> "' + (transcript || '') + '"<br>' +
      (patientId ? '<strong>Patient ID:</strong> ' + patientId : '') +
      '<br><br>Please check on the patient immediately.';

    const results = [];
    if (User) {
      const caregivers = await User.find({});
      for (const cg of caregivers) {
        if (cg.email) {
          const r = await sendAlertEmail(cg.email, subject, message);
          results.push({ email: cg.email, ...r });
        }
      }
    }

    res.json({ sent: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
