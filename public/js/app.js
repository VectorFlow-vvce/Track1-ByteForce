// ============================================
// CareBand Dashboard - Standalone Application
// No server required - runs entirely in browser
// ============================================

let voiceRecognition = null;
let isListening = false;
let isTracking = true;
let currentUser = null;
let simulationInterval = null;
let markerX = 50, markerY = 50;

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  currentUser = JSON.parse(localStorage.getItem('cb_user') || 'null');
  if (currentUser) {
    const el = document.getElementById('caregiverName');
    if (el) el.textContent = currentUser.name || 'Caregiver';
    const rl = document.getElementById('caregiverRole');
    if (rl) rl.textContent = currentUser.role || 'caregiver';
    const av = document.getElementById('caregiverAvatar');
    if (av) av.textContent = (currentUser.name || 'C')[0].toUpperCase();
  }
  loadDemoAlerts();
  startSimulation();
});

// --- Navigation ---
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');
  const nav = document.querySelector('[data-page="' + pageId + '"]');
  if (nav) nav.classList.add('active');
}

// --- Demo Alerts ---
function loadDemoAlerts() {
  addAlertToFeed({ type: 'GEOFENCE_EXIT', message: 'Margaret left safe zone - 120m from home', severity: 'HIGH', time: new Date(Date.now() - 300000) });
  addAlertToFeed({ type: 'VOICE_EMERGENCY', message: '"Help" keyword detected from Robert', severity: 'CRITICAL', time: new Date(Date.now() - 600000) });
  addAlertToFeed({ type: 'ROUTINE_MISSED', message: 'Dorothy missed medication at 2:00 PM', severity: 'MEDIUM', time: new Date(Date.now() - 3600000) });
  addAlertToFeed({ type: 'FALL_DETECTED', message: 'Possible fall detected - Margaret', severity: 'HIGH', time: new Date(Date.now() - 7200000) });
}

function addAlertToFeed(alert) {
  const feed = document.getElementById('alertFeed');
  if (!feed) return;
  const icons = { GEOFENCE_EXIT: '🚨', VOICE_EMERGENCY: '🗣️', FALL_DETECTED: '⚠️', ROUTINE_MISSED: '⏰', SOS: '🆘', GEOFENCE_ENTER: '✅' };
  const classes = { CRITICAL: 'danger', HIGH: 'danger', MEDIUM: 'warn', LOW: 'info' };
  const cls = classes[alert.severity] || 'info';
  const icon = icons[alert.type] || '🔔';
  const time = alert.time ? timeAgo(new Date(alert.time)) : 'just now';

  const div = document.createElement('div');
  div.className = 'alert-item ' + cls;
  div.innerHTML =
    '<span class="alert-icon">' + icon + '</span>' +
    '<div class="alert-body">' +
      '<div class="alert-text">' + escapeHtml(alert.message) + '</div>' +
      '<div class="alert-time">' + time + '</div>' +
    '</div>' +
    '<button class="resolve-btn" onclick="resolveAlert(this)">Resolve</button>';
  feed.prepend(div);

  const countEl = document.getElementById('alertCount');
  if (countEl) {
    const current = parseInt(countEl.textContent) || 0;
    countEl.textContent = current + 1;
  }
}

function resolveAlert(btn) {
  btn.textContent = 'Done';
  btn.style.color = 'var(--safe)';
  btn.style.borderColor = 'var(--safe)';
  btn.disabled = true;
  btn.closest('.alert-item').style.opacity = '0.4';
}

// --- Voice Emergency Detection ---
function startVoiceDetection() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('warn', 'Not Supported', 'Speech recognition not available in this browser');
    return;
  }

  if (isListening) { stopVoiceDetection(); return; }

  voiceRecognition = new SpeechRecognition();
  voiceRecognition.continuous = true;
  voiceRecognition.interimResults = true;
  voiceRecognition.lang = 'en-US';

  voiceRecognition.onstart = () => {
    isListening = true;
    const btn = document.getElementById('voiceBtn');
    if (btn) { btn.classList.add('speaking'); btn.innerHTML = '🎙️ Listening... (click to stop)'; }
    const ind = document.getElementById('speakingIndicator');
    if (ind) ind.classList.add('show');
    showToast('safe', 'Voice Active', 'Listening for emergency keywords...');
  };

  voiceRecognition.onresult = (event) => {
    const last = event.results[event.results.length - 1];
    const text = last[0].transcript.toLowerCase().trim();
    const display = document.getElementById('voiceTranscript');
    if (display) display.textContent = '"' + text + '"';

    const keywords = ['help', 'emergency', 'save me', 'doctor', 'fall', 'pain', 'hurt'];
    const detected = keywords.find(k => text.includes(k));
    if (detected && last.isFinal) {
      triggerVoiceEmergency(detected, text);
    }
  };

  voiceRecognition.onerror = (e) => {
    if (e.error !== 'no-speech') {
      console.error('Voice error:', e.error);
      showToast('warn', 'Voice Error', e.error);
    }
  };

  voiceRecognition.onend = () => {
    if (isListening) voiceRecognition.start();
  };

  voiceRecognition.start();
}

function stopVoiceDetection() {
  isListening = false;
  if (voiceRecognition) { voiceRecognition.abort(); voiceRecognition = null; }
  const btn = document.getElementById('voiceBtn');
  if (btn) { btn.classList.remove('speaking'); btn.innerHTML = '🎙️ Start Voice Detection'; }
  const ind = document.getElementById('speakingIndicator');
  if (ind) ind.classList.remove('show');
  const display = document.getElementById('voiceTranscript');
  if (display) display.textContent = '';
}

function triggerVoiceEmergency(keyword, fullText) {
  showToast('danger', 'EMERGENCY DETECTED!', 'Keyword "' + keyword + '" detected');
  triggerEmergencyFlash();
  addAlertToFeed({
    type: 'VOICE_EMERGENCY',
    message: 'Emergency keyword "' + keyword + '" detected: "' + fullText + '"',
    severity: 'CRITICAL',
    time: new Date()
  });
}

function triggerManualSOS() {
  showToast('danger', 'SOS ACTIVATED!', 'Emergency alert sent to all caregivers');
  triggerEmergencyFlash();
  addAlertToFeed({ type: 'SOS', message: 'Manual SOS triggered by caregiver', severity: 'CRITICAL', time: new Date() });
}

// --- Map Simulation ---
function startSimulation() {
  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = setInterval(() => {
    if (!isTracking) return;
    markerX += (Math.random() - 0.5) * 3;
    markerY += (Math.random() - 0.5) * 3;
    markerX = Math.max(15, Math.min(85, markerX));
    markerY = Math.max(15, Math.min(85, markerY));

    const marker = document.getElementById('patientMarker');
    if (marker) {
      marker.style.left = markerX + '%';
      marker.style.top = markerY + '%';
    }

    const baseLat = 12.9716, baseLng = 77.5946;
    const lat = (baseLat + (markerY - 50) * 0.0001).toFixed(4);
    const lng = (baseLng + (markerX - 50) * 0.0001).toFixed(4);
    const coordsEl = document.getElementById('coordsDisplay');
    if (coordsEl) coordsEl.textContent = lat + ', ' + lng;

    const dist = Math.sqrt((markerX - 50) ** 2 + (markerY - 50) ** 2);
    const statusEl = document.getElementById('mapStatus');
    if (dist > 30) {
      if (statusEl) { statusEl.textContent = '⚠️ Outside safe zone'; statusEl.style.color = 'var(--danger)'; }
    } else {
      if (statusEl) { statusEl.textContent = '✅ Inside safe zone'; statusEl.style.color = 'var(--safe)'; }
    }
  }, 2000);
}

function toggleTracking() {
  isTracking = !isTracking;
  const banner = document.getElementById('trackingBanner');
  const btn = document.getElementById('trackBtn');
  const text = document.getElementById('trackingText');
  if (isTracking) {
    if (banner) banner.classList.remove('inactive');
    if (btn) { btn.textContent = 'Stop Tracking'; btn.classList.add('stop'); }
    if (text) text.innerHTML = '📡 <strong>Live tracking active</strong> — GPS updates every 5 seconds';
  } else {
    if (banner) banner.classList.add('inactive');
    if (btn) { btn.textContent = 'Start Tracking'; btn.classList.remove('stop'); }
    if (text) { text.classList.add('inactive'); text.innerHTML = '⏸️ <strong>Tracking paused</strong> — Click to resume'; }
  }
}

// --- Toast ---
function showToast(type, title, sub) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = 'toast show ' + type;
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastSub').textContent = sub || '';
  setTimeout(() => toast.classList.remove('show'), 4000);
}

function triggerEmergencyFlash() {
  const overlay = document.getElementById('emergencyOverlay');
  if (overlay) {
    overlay.classList.add('show');
    setTimeout(() => overlay.classList.remove('show'), 3000);
  }
}

// --- Modal ---
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('show');
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('show');
}

// --- Add Patient (local only) ---
function addPatient() {
  const name = document.getElementById('patientNameInput').value;
  const age = document.getElementById('patientAgeInput').value;
  if (!name || !age) { showToast('warn', 'Missing Info', 'Name and age are required'); return; }
  showToast('safe', 'Patient Added', name + ' has been added');
  closeModal('addPatientModal');
}

// --- Logout ---
function logout() {
  localStorage.removeItem('cb_token');
  localStorage.removeItem('cb_user');
  window.location.href = 'index.html';
}

// --- Utilities ---
function timeAgo(date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
