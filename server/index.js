require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const locationRoutes = require('./routes/locations');
const alertRoutes = require('./routes/alerts');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Attach io to req
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/alerts', alertRoutes);

// Serve frontend pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, '../public/register.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(__dirname, '../public/reset-password.html')));

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-caregiver', (caregiverId) => {
    socket.join(`caregiver-${caregiverId}`);
    console.log(`Caregiver ${caregiverId} joined room`);
  });

  socket.on('location-update', async (data) => {
    // Broadcast to all connected caregivers
    io.emit('location-updated', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  family: 4  // Force IPv4 — fixes ECONNREFUSED on some networks
})
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(process.env.PORT || 3000, () => {
      console.log(`🚀 CareBand server running on http://localhost:${process.env.PORT || 3000}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Starting server without DB (demo mode)...');
    server.listen(process.env.PORT || 3000, () => {
      console.log(`🚀 CareBand server running on http://localhost:${process.env.PORT || 3000}`);
    });
  });

module.exports = { io };
