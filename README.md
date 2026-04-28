# CareBand - Real-Time Dementia Care and Emergency System

CareBand is an intelligent caregiver dashboard that continuously monitors elderly patients with dementia using location tracking, offline voice emergency detection, and real-time caregiver alerts powered by a Node.js + MongoDB backend.

## Core System Features

### 1. Real-Time Caregiver Alert System
- Live patient tracking (GPS updates every 5-10 seconds)
- Geofence boundary detection (safe zone monitoring)
- Instant alerts when:
  - Patient leaves safe zone
  - Sudden abnormal movement
  - Emergency voice trigger detected

### 2. Offline Voice Emergency Detection
- Works without internet after setup
- Uses Web Speech API for in-browser keyword detection
- Detects keywords: "help", "emergency", "save me", "doctor", "fall", "pain", "hurt"
- Local alert triggered instantly, syncs to server when online
- Caregiver dashboard updates in real-time

### 3. Location Tracking System
- Device sends GPS coordinates
- Stored in MongoDB with patient ID, lat/lng, and timestamp
- Dashboard shows live map marker movement with safe zone ring

### 4. Alert System (MongoDB-based)
- Alert types: GEOFENCE_EXIT, VOICE_EMERGENCY, FALL_DETECTED, ROUTINE_MISSED, SOS
- Severity levels: LOW, MEDIUM, HIGH, CRITICAL
- Real-time toast notifications and alert feed

### 5. Caregiver Dashboard
- Map tracking panel with animated patient marker
- Live alert feed with resolve actions
- Patient status cards
- Voice control buttons
- Daily routine tracker
- Caregiver wellness reminders

## Tech Stack

### Frontend
- HTML5, CSS3, JavaScript (Vanilla)
- Web Speech API (offline voice detection)
- Socket.io Client (real-time updates)
- Custom dark theme UI with animations

### Backend
- Node.js + Express
- MongoDB (Atlas or local) with Mongoose ODM
- Socket.io (real-time WebSocket communication)
- JWT Authentication
- bcrypt.js (password hashing)

### Database Collections
- **users** - name, email, passwordHash, role
- **patients** - name, age, caregiverId, safeZoneRadius, status
- **locations** - patientId, lat, lng, timestamp
- **alerts** - type, message, patientId, severity, time

## Project Structure

```
careband/
├── public/
│   ├── js/
│   │   └── app.js              # Dashboard application logic
│   ├── index.html              # Landing page (login)
│   ├── login.html              # Login page
│   ├── register.html           # Create account page
│   ├── reset-password.html     # Password reset (3-step flow)
│   └── dashboard.html          # Main caregiver dashboard
├── server/
│   ├── middleware/
│   │   └── auth.js             # JWT authentication middleware
│   ├── models/
│   │   ├── User.js             # User schema
│   │   ├── Patient.js          # Patient schema
│   │   ├── Location.js         # Location schema
│   │   └── Alert.js            # Alert schema
│   ├── routes/
│   │   ├── auth.js             # Login, register, password reset
│   │   ├── patients.js         # CRUD for patients
│   │   ├── locations.js        # GPS data endpoints
│   │   └── alerts.js           # Alert management
│   └── index.js                # Express server + Socket.io setup
├── .env                        # Environment variables
├── .gitignore
├── package.json
└── README.md
```

## Installation and Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or Atlas account)

### Steps

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/careband.git
cd careband
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Edit the `.env` file:
```env
PORT=3000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/careband?retryWrites=true&w=majority
JWT_SECRET=your_secret_key_here
NODE_ENV=development
```

4. **Start the server**
```bash
npm start
```

5. **Open in browser**
```
http://localhost:3000
```

### Demo Mode (No MongoDB Required)
The app works in demo mode without MongoDB. Just run `npm start` and it will start with sample data. You can also open the HTML files directly with Live Server for frontend-only testing.

## Real-Time Data Flow

```
Step 1: Patient device sends GPS + voice data
Step 2: Node.js server receives and saves to MongoDB
Step 3: Socket.io pushes update to connected dashboards
Step 4: Caregiver sees instant alert with toast popup
```

## Offline Voice Detection Logic

```javascript
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = true;
recognition.lang = "en-US";

recognition.onresult = (event) => {
  const text = event.results[event.results.length - 1][0].transcript.toLowerCase();
  if (text.includes("help") || text.includes("emergency")) {
    triggerEmergencyAlert();
  }
};

recognition.start();
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create new account |
| POST | /api/auth/login | Login |
| POST | /api/auth/forgot-password | Request password reset |
| POST | /api/auth/reset-password | Reset password with token |
| GET | /api/patients | Get all patients |
| POST | /api/patients | Add new patient |
| PUT | /api/patients/:id | Update patient |
| GET | /api/locations/:patientId | Get location history |
| POST | /api/locations | Send GPS update |
| GET | /api/alerts | Get all alerts |
| POST | /api/alerts | Create new alert |
| PATCH | /api/alerts/:id/resolve | Resolve an alert |

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Login | / | Sign in with email and password |
| Register | /register | Create a new caregiver account |
| Reset Password | /reset-password | 3-step password recovery flow |
| Dashboard | /dashboard | Main caregiver monitoring dashboard |

## Dashboard Features

- **Live Map** - Animated patient marker with safe zone ring
- **Alert Feed** - Real-time alerts with severity color coding
- **Patient Cards** - Status overview for all monitored patients
- **Voice Monitor** - Start/stop voice detection, manual SOS button
- **Geofence Settings** - Configure safe zone radius and alert preferences
- **Daily Routine** - Track medication, meals, and therapy schedules
- **Settings** - Notifications, tracking, voice detection, account management

## Screenshots

The dashboard features a dark theme UI with:
- Sidebar navigation with caregiver profile
- Real-time stats row (patients, alerts, safe zone, voice status)
- Interactive map with animated patient tracking
- Color-coded alert feed (red = critical, yellow = warning, blue = info)
- Patient cards with status indicators
- Voice detection with waveform animation

## Security Features

- JWT token-based authentication
- bcrypt password hashing (12 rounds)
- Password reset with expiring tokens
- Input validation on all endpoints
- CORS configuration

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built for dementia patient care and caregiver support
- Uses Web Speech API for offline emergency detection
- Real-time communication powered by Socket.io
- MongoDB Atlas for cloud database hosting
