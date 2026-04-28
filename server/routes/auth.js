const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

let User;
try { User = require('../models/User'); } catch(e) {}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields are required' });

    if (User) {
      const existing = await User.findOne({ email });
      if (existing) return res.status(409).json({ error: 'Email already registered' });

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({ name, email, passwordHash, role: role || 'caregiver' });
      const token = jwt.sign({ id: user._id, email: user.email, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    }

    // Demo mode (no DB)
    const token = jwt.sign({ id: 'demo', email, name, role: role || 'caregiver' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: 'demo', name, email, role: role || 'caregiver' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    if (User) {
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const valid = await user.comparePassword(password);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ id: user._id, email: user.email, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    }

    // Demo mode
    const token = jwt.sign({ id: 'demo', email, name: 'Demo Caregiver', role: 'caregiver' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: 'demo', name: 'Demo Caregiver', email, role: 'caregiver' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    if (User) {
      const user = await User.findOne({ email });
      if (!user) return res.json({ message: 'If that email exists, a reset link was sent.' });

      const token = crypto.randomBytes(32).toString('hex');
      user.resetToken = token;
      user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
      await user.save();
      // In production: send email with reset link
      console.log(`Reset token for ${email}: ${token}`);
    }

    res.json({ message: 'If that email exists, a reset link was sent.', demo_token: 'demo-reset-token' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });

    if (User) {
      const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
      if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

      user.passwordHash = await bcrypt.hash(password, 12);
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      await user.save();
      return res.json({ message: 'Password reset successful' });
    }

    res.json({ message: 'Password reset successful (demo mode)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/change-password (requires auth)
const authMiddleware = require('../middleware/auth');

router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    if (User) {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const valid = await user.comparePassword(currentPassword);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

      user.passwordHash = await bcrypt.hash(newPassword, 12);
      await user.save();
      return res.json({ message: 'Password changed successfully' });
    }

    res.json({ message: 'Password changed (demo)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/delete-account (requires auth)
router.delete('/delete-account', authMiddleware, async (req, res) => {
  try {
    if (User) {
      // Delete user's patients first
      const Patient = require('../models/Patient');
      await Patient.deleteMany({ caregiverId: req.user.id });

      // Delete user's alerts
      const Alert = require('../models/Alert');
      await Alert.deleteMany({ caregiverId: req.user.id });

      // Delete the user
      await User.findByIdAndDelete(req.user.id);
      return res.json({ message: 'Account and all data deleted' });
    }

    res.json({ message: 'Account deleted (demo)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
