require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const dns = require('dns');
const os = require('os');

// Force Google DNS
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch(e) {}

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.RENDER;

function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}
const LAN_IP = getLanIP();

// SSL certs (only needed for local dev — production platforms provide HTTPS)
let sslOptions = null;
if (!IS_PRODUCTION) {
  try {
    sslOptions = {
      key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem'))
    };
    console.log('🔒 SSL certificates loaded');
  } catch (e) {
    console.log('⚠️  No SSL certs. Run: node server/generate-cert.js');
  }
}

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const locationRoutes = require('./routes/locations');
const alertRoutes = require('./routes/alerts');
const sosRoutes = require('./routes/sos');

const app = express();
const httpServer = http.createServer(app);
const httpsServer = sslOptions ? https.createServer(sslOptions, app) : null;

// Socket.io on the primary server
const primaryServer = IS_PRODUCTION ? httpServer : (httpsServer || httpServer);
const io = new Server(primaryServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
// Also attach to HTTP if HTTPS exists locally
if (httpsServer && !IS_PRODUCTION) {
  new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use((req, res, next) => { req.io = io; next(); });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/sos', sosRoutes);

// Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, '../public/register.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(__dirname, '../public/reset-password.html')));
app.get('/track', (req, res) => res.sendFile(path.join(__dirname, '../public/track.html')));

// Server info API — returns the correct base URL for tracking links
app.get('/api/server-info', (req, res) => {
  if (IS_PRODUCTION) {
    // On Render/Heroku, use the request host (already HTTPS)
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    res.json({ lanUrl: proto + '://' + host, ip: host, port: 443 });
  } else {
    const port = process.env.PORT || 3000;
    const httpsPort = 3443;
    res.json({
      lanUrl: sslOptions ? ('https://' + LAN_IP + ':' + httpsPort) : ('http://' + LAN_IP + ':' + port),
      ip: LAN_IP, port, httpsPort
    });
  }
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('join-caregiver', (cid) => { socket.join('caregiver-' + cid); });
  socket.on('location-update', (data) => { io.emit('location-updated', data); });
  socket.on('disconnect', () => { console.log('Client disconnected:', socket.id); });
});

// MongoDB
mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, family: 4 })
  .then(() => { console.log('✅ MongoDB connected'); startServers(); })
  .catch(err => { console.error('❌ MongoDB error:', err.message); startServers(); });

function startServers() {
  const port = process.env.PORT || 3000;

  httpServer.listen(port, '0.0.0.0', () => {
    console.log('🚀 CareBand running:');
    console.log('   HTTP:  http://localhost:' + port);
    if (!IS_PRODUCTION) console.log('   LAN:   http://' + LAN_IP + ':' + port);
  });

  if (httpsServer && !IS_PRODUCTION) {
    httpsServer.listen(3443, '0.0.0.0', () => {
      console.log('   🔒 HTTPS: https://localhost:3443');
      console.log('   🔒 LAN:   https://' + LAN_IP + ':3443');
      console.log('   📱 Phone: https://' + LAN_IP + ':3443/track.html?id=PATIENT_ID');
    });
  }

  if (IS_PRODUCTION) {
    console.log('   🌐 Production mode — HTTPS provided by platform');
  }
}

module.exports = { io };
