// CareBand Dashboard - Production
// Real MongoDB + GPS + Phone Alerts
const API = '';
let voiceRecognition = null, isListening = false, isTracking = true;
let currentUser = null;
let leafletMap = null, gpsWatchId = null, homeLocation = null;
let miniMap = null, miniMapMarker = null;
let patientMarkers = {}, patientCircles = {}, patientTrails = {}, patientLocations = {};
let activePatientId = null;
let allPatients = [];
let routines = [];
const colors = ['#667eea','#f5576c','#4facfe','#43e97b','#fa709a','#a18cd1','#fbc2eb','#f6d365'];
const emojis = ['👵','👴','🧓','👩‍🦳','👨‍🦳'];

function getToken() { return localStorage.getItem('cb_token'); }
function authHeaders() { return {'Content-Type':'application/json','Authorization':'Bearer '+getToken()}; }

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = JSON.parse(localStorage.getItem('cb_user') || 'null');
  if (!currentUser || !getToken()) { window.location.href = 'index.html'; return; }
  const el = document.getElementById('caregiverName'); if (el) el.textContent = currentUser.name || 'Caregiver';
  const rl = document.getElementById('caregiverRole'); if (rl) rl.textContent = currentUser.role || 'caregiver';
  const av = document.getElementById('caregiverAvatar'); if (av) av.textContent = (currentUser.name||'C')[0].toUpperCase();

  // Load saved routines (local)
  const savedR = JSON.parse(localStorage.getItem('cb_routines') || 'null');
  if (savedR && savedR.length > 0) routines = savedR;
  renderRoutines();

  // Load patients from server
  await loadPatients();
  await loadAlerts();
  initLeafletMap();
  startGPSTracking();
  startPatientSimulation();
  initSocketListeners();
});

async function loadPatients() {
  try {
    const res = await fetch(API+'/api/patients', {headers: authHeaders()});
    if (res.ok) {
      const data = await res.json();
      allPatients = data.map((p,i) => ({
        id: p._id, name: p.name, age: p.age, condition: p.condition || 'Dementia',
        lat: p.safeZoneCenter?.lat || 0, lng: p.safeZoneCenter?.lng || 0,
        radius: p.safeZoneRadius || 100, status: p.status || 'safe',
        phone: p.phone || '', color: colors[i % colors.length]
      }));
    }
  } catch(e) { console.log('Could not load patients from server'); }
  renderDashboardPatients();
  renderPatientsPage();
  updateAllCounts();
}

// ============ SOCKET.IO REAL-TIME UPDATES ============
function initSocketListeners() {
  try {
    if (typeof io !== 'undefined') {
      const socket = io();
      socket.on('location-updated', (data) => {
        // Real GPS from patient's phone — update their marker on map
        const p = allPatients.find(x => x.id === data.patientId);
        if (p) {
          if (p.lat === 0 && p.lng === 0) {
            // First location from this patient — add to map
            p.lat = data.lat; p.lng = data.lng;
            addPatientToMap(p);
            if (leafletMap) leafletMap.setView([data.lat, data.lng], 16);
            showToast('safe', p.name + ' Online!', 'Location received from patient phone');
          }
          updatePatientPosition(data.patientId, data.lat, data.lng);
        }
      });
      socket.on('geofence-exit', (data) => {
        showToast('danger', 'Geofence Alert!', data.patientName + ' left safe zone');
        triggerEmergencyFlash();
        addAlertToFeed({type:'GEOFENCE_EXIT', message:data.patientName+' left safe zone - '+data.distance+'m', severity:'HIGH', time:new Date()});
      });
      console.log('Socket.io connected for real-time updates');
    }
  } catch(e) { console.log('Socket.io not available'); }
}

// ============ NAVIGATION ============
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById(pageId); if (page) page.classList.add('active');
  const nav = document.querySelector('[data-page="'+pageId+'"]'); if (nav) nav.classList.add('active');
  if (pageId === 'dashboard' && leafletMap) setTimeout(() => leafletMap.invalidateSize(), 100);
}

// ============ LEAFLET MAP ============
function initLeafletMap() {
  const mc = document.getElementById('leafletMap');
  if (!mc || typeof L === 'undefined') return;
  leafletMap = L.map('leafletMap', {zoomControl:false}).setView([12.9716,77.5946], 14);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {attribution:'OpenStreetMap CARTO',maxZoom:20}).addTo(leafletMap);
  L.control.zoom({position:'topright'}).addTo(leafletMap);
  allPatients.forEach(p => addPatientToMap(p));
  if (Object.keys(patientMarkers).length > 0) {
    const grp = new L.featureGroup(Object.values(patientMarkers));
    leafletMap.fitBounds(grp.getBounds().pad(0.3));
  }
}

function addPatientToMap(p) {
  if (!leafletMap || !p.lat || !p.lng) return;
  const c = p.color||'#00d4aa', r = p.radius||100;
  const icon = L.divIcon({className:'x',html:'<div style="position:relative"><div style="width:18px;height:18px;background:'+c+';border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px '+c+'80"></div><div style="position:absolute;top:22px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:10px;font-weight:700;color:'+c+';background:#111827;padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.1)">'+p.name.split(' ')[0]+'</div></div>',iconSize:[18,18],iconAnchor:[9,9]});
  patientMarkers[p.id] = L.marker([p.lat,p.lng],{icon}).addTo(leafletMap).bindPopup('<b>'+p.name+'</b><br>'+p.age+' yrs<br>📞 '+(p.phone||'N/A')+'<br>📍 '+p.lat.toFixed(4)+', '+p.lng.toFixed(4));
  patientCircles[p.id] = L.circle([p.lat,p.lng],{radius:r,color:c,fillColor:c,fillOpacity:0.06,weight:2,dashArray:'8 4'}).addTo(leafletMap);
  patientTrails[p.id] = L.polyline([],{color:c,weight:2,opacity:0.4,dashArray:'4 6'}).addTo(leafletMap);
  patientLocations[p.id] = {lat:p.lat,lng:p.lng,trail:[[p.lat,p.lng]]};
}

// ============ GPS TRACKING ============
function startGPSTracking() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => {
    homeLocation = {lat:pos.coords.latitude, lng:pos.coords.longitude};
    if (leafletMap && allPatients.length === 0) leafletMap.setView([homeLocation.lat, homeLocation.lng], 15);
    gpsWatchId = navigator.geolocation.watchPosition((p) => {
      if (!isTracking || !activePatientId) return;
      updatePatientPosition(activePatientId, p.coords.latitude, p.coords.longitude);
      const c = document.getElementById('coordsDisplay'); if(c) c.textContent = p.coords.latitude.toFixed(6)+', '+p.coords.longitude.toFixed(6);
      const a = document.getElementById('gpsAccuracy'); if(a) a.textContent = 'Accuracy: '+p.coords.accuracy.toFixed(0)+'m';
    }, ()=>{}, {enableHighAccuracy:true, maximumAge:3000, timeout:10000});
  }, ()=>{}, {enableHighAccuracy:true, timeout:10000});
}

function updatePatientPosition(pid, lat, lng) {
  if (patientMarkers[pid]) patientMarkers[pid].setLatLng([lat,lng]);
  if (!patientLocations[pid]) patientLocations[pid] = {lat,lng,trail:[]};
  patientLocations[pid].lat = lat; patientLocations[pid].lng = lng;
  patientLocations[pid].trail.push([lat,lng]);
  if (patientLocations[pid].trail.length > 100) patientLocations[pid].trail.shift();
  if (patientTrails[pid]) patientTrails[pid].setLatLngs(patientLocations[pid].trail);
  const p = allPatients.find(x => x.id === pid);
  if (p && patientCircles[pid]) {
    const center = patientCircles[pid].getLatLng();
    const dist = getDistance(lat,lng,center.lat,center.lng);
    if (dist > (p.radius||100) && !p._alerted) {
      p._alerted = true; p.status = 'danger';
      showToast('danger','Geofence!',p.name+' left zone ('+dist.toFixed(0)+'m)');
      triggerEmergencyFlash();
      addAlertToFeed({type:'GEOFENCE_EXIT',message:p.name+' left safe zone - '+dist.toFixed(0)+'m',severity:'HIGH',time:new Date()});
      // Email all caregivers
      fetch(API+'/api/sos/alert-all', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({subject:'GEOFENCE ALERT - '+p.name+' left safe zone!',
          message:p.name+' has left the safe zone!<br>Distance: '+dist.toFixed(0)+'m from home.<br>Phone: '+(p.phone||'N/A')+'<br><a href="https://www.google.com/maps?q='+lat+','+lng+'">View on Google Maps</a>'})
      }).catch(()=>{});
    } else if (dist <= (p.radius||100) && p._alerted) {
      p._alerted = false; p.status = 'safe';
      addAlertToFeed({type:'GEOFENCE_ENTER',message:p.name+' returned to safe zone',severity:'LOW',time:new Date()});
    }
  }
  if (pid === activePatientId) {
    const se = document.getElementById('mapStatus');
    if (se && p) { se.textContent = (p.status==='danger'?'⚠️ ':'✅ ')+p.name+(p.status==='danger'?' OUTSIDE':' inside')+' safe zone'; se.style.color = p.status==='danger'?'var(--danger)':'var(--safe)'; }
  }
}

function trackPatient(pid) {
  activePatientId = pid;
  const p = allPatients.find(x => x.id === pid); if (!p) return;
  showToast('safe','Tracking '+p.name,'📞 '+p.phone);
  const loc = patientLocations[pid];
  if (leafletMap && loc) { leafletMap.setView([loc.lat,loc.lng],17); if(patientMarkers[pid]) patientMarkers[pid].openPopup(); }
  document.querySelectorAll('.patient-card').forEach(c => c.style.borderColor = '');
  const card = document.querySelector('[data-patient-id="'+pid+'"]'); if(card) card.style.borderColor = 'var(--accent)';
}

function startPatientSimulation() {
  setInterval(() => {
    if (!isTracking) return;
    allPatients.forEach(p => {
      if (p.id === activePatientId && gpsWatchId !== null) return;
      const loc = patientLocations[p.id]; if (!loc) return;
      updatePatientPosition(p.id, loc.lat+(Math.random()-0.5)*0.0002, loc.lng+(Math.random()-0.5)*0.0002);
    });
  }, 3000);
}

function centerMap() { const l = patientLocations[activePatientId]; if(leafletMap && l) leafletMap.setView([l.lat,l.lng],17); }
function toggleTracking() {
  isTracking = !isTracking;
  const b=document.getElementById('trackingBanner'),bt=document.getElementById('trackBtn'),t=document.getElementById('trackingText');
  if(isTracking){if(b)b.classList.remove('inactive');if(bt){bt.textContent='Stop Tracking';bt.classList.add('stop');}if(t)t.innerHTML='📡 <strong>Live tracking active</strong>';}
  else{if(b)b.classList.add('inactive');if(bt){bt.textContent='Start Tracking';bt.classList.remove('stop');}if(t)t.innerHTML='⏸️ <strong>Tracking paused</strong>';if(gpsWatchId!==null){navigator.geolocation.clearWatch(gpsWatchId);gpsWatchId=null;}}
}

// ============ SOS + PHONE ALERTS ============
function triggerManualSOS() {
  const email = prompt('Enter email to send SOS alert to:','');
  if (!email) return;
  showToast('danger','SOS SENDING...','Sending email to '+email);
  triggerEmergencyFlash();
  addAlertToFeed({type:'SOS',message:'SOS alert sent to '+email,severity:'CRITICAL',time:new Date()});

  // Send email via server
  fetch(API+'/api/sos/email', {method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      to: email,
      subject: 'EMERGENCY SOS - Immediate Help Needed!',
      message: 'Caregiver <strong>'+(currentUser?currentUser.name:'Unknown')+'</strong> triggered a manual SOS alert!<br><br>'+
        (activePatientId && patientLocations[activePatientId] ?
          'Patient location: <a href="https://www.google.com/maps?q='+patientLocations[activePatientId].lat+','+patientLocations[activePatientId].lng+'">Open in Google Maps</a>' : '')+
        '<br><br>Please respond immediately!'
    })
  }).then(r=>r.json()).then(d => {
    if(d.success) showToast('safe','SOS Sent!','Email delivered to '+email);
    else showToast('danger','Send Failed',d.error||'Check email config');
  }).catch(e => showToast('danger','Send Failed',e.message));

  // Also alert ALL registered caregivers
  fetch(API+'/api/sos/alert-all', {method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      subject: 'EMERGENCY SOS from '+((currentUser&&currentUser.name)||'Caregiver'),
      message: 'Manual SOS triggered! All caregivers please check the dashboard immediately.'
    })
  }).catch(()=>{});
}

async function sendTrackingLink(patientId, patientEmail) {
  // Send email with tracking page link to patient
  const trackUrl = window.location.origin + '/track.html?id=' + patientId;
  try {
    await fetch(API+'/api/sos/email', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        to: patientEmail,
        subject: 'CareBand - Share Your Location',
        message: 'Your caregiver wants to track your location for safety.<br><br>'+
          '<a href="'+trackUrl+'" style="background:#00d4aa;color:#000;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block;">📍 Open Location Sharing</a><br><br>'+
          'Or copy this link: '+trackUrl+'<br><br>Keep the page open on your phone for continuous tracking.'
      })
    });
    showToast('safe','Link Sent','Tracking link emailed');
  } catch(e) { showToast('danger','Failed',e.message); }
}


// ============ ADD PATIENT WITH GPS + PHONE ============
function capturePatientLocation() {
  const s = document.getElementById('patientLocationStatus');
  if (!navigator.geolocation) { if(s){s.textContent='GPS not available on this device';s.style.color='var(--danger)';} return; }
  if(s){s.textContent='📡 Getting accurate GPS location...'; s.style.color='var(--accent)';}
  navigator.geolocation.getCurrentPosition((pos) => {
    document.getElementById('patientLatInput').value = pos.coords.latitude.toFixed(6);
    document.getElementById('patientLngInput').value = pos.coords.longitude.toFixed(6);
    if(s){s.textContent='✅ Location captured! Accuracy: '+pos.coords.accuracy.toFixed(0)+'m'; s.style.color='var(--safe)';}
    showMiniMap(pos.coords.latitude, pos.coords.longitude);
  }, (e) => { if(s){s.textContent='❌ '+e.message+' — Open this page on patient phone to get their location'; s.style.color='var(--danger)';} }, {enableHighAccuracy:true,timeout:15000});
}

function showMiniMap(lat,lng) {
  const c = document.getElementById('patientMiniMap'); if (!c || typeof L==='undefined') return;
  c.style.display = 'block';
  if (miniMap) { miniMap.remove(); miniMap = null; }
  miniMap = L.map('patientMiniMap',{zoomControl:false}).setView([lat,lng],16);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:20}).addTo(miniMap);
  miniMapMarker = L.marker([lat,lng]).addTo(miniMap);
  L.circle([lat,lng],{radius:100,color:'#00d4aa',fillOpacity:0.08,dashArray:'6 4'}).addTo(miniMap);
  miniMap.on('click',(e) => { document.getElementById('patientLatInput').value=e.latlng.lat.toFixed(6); document.getElementById('patientLngInput').value=e.latlng.lng.toFixed(6); miniMapMarker.setLatLng(e.latlng); });
  setTimeout(() => miniMap.invalidateSize(), 200);
}

async function addPatient() {
  const name = document.getElementById('patientNameInput').value.trim();
  const age = document.getElementById('patientAgeInput').value;
  const phone = document.getElementById('patientPhoneInput').value.trim();
  const email = document.getElementById('patientEmailInput').value.trim();
  const condition = document.getElementById('patientConditionInput').value || 'Dementia';
  const radius = parseInt(document.getElementById('patientRadiusInput').value) || 100;
  if (!name || !age) { showToast('warn','Missing Info','Name and age required'); return; }
  if (!phone) { showToast('warn','Missing Phone','Phone number required for alerts'); return; }
  if (!email) { showToast('warn','Missing Email','Email required to send tracking link'); return; }

  // Save to MongoDB (location will come from patient's phone later)
  let savedPatientId = null;
  try {
    const res = await fetch(API+'/api/patients', {method:'POST', headers: authHeaders(),
      body: JSON.stringify({name, age:parseInt(age), condition, phone, safeZoneRadius:radius, safeZoneCenter:{lat:0,lng:0}})
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error||'Failed'); }
    const saved = await res.json();
    savedPatientId = saved._id;
    showToast('safe','Patient Saved',name+' saved to database');
  } catch(e) { showToast('warn','Save Error',e.message); return; }

  // Get server's LAN IP for the tracking URL (so it works on patient's phone)
  let trackBaseUrl = window.location.origin;
  try {
    const infoRes = await fetch(API+'/api/server-info');
    const info = await infoRes.json();
    if (info.lanUrl) trackBaseUrl = info.lanUrl;
  } catch(e) {}

  const trackUrl = trackBaseUrl + '/track.html?id=' + savedPatientId;

  // Send tracking link email to patient
  showToast('safe','Sending Email...','Sending tracking link to '+email);
  try {
    const emailRes = await fetch(API+'/api/sos/email', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        to: email,
        subject: 'CareBand - Open This to Share Your Location',
        message: 'Hello <strong>'+esc(name)+'</strong>,<br><br>'+
          'Your caregiver has added you to CareBand for your safety.<br><br>'+
          '<strong>Please open this link on your phone:</strong><br><br>'+
          '<a href="'+trackUrl+'" style="background:#00d4aa;color:#000;padding:16px 32px;border-radius:14px;text-decoration:none;font-weight:bold;display:inline-block;font-size:18px;margin:10px 0;">📍 Share My Location</a><br><br>'+
          'If the button does not work, copy and paste this link in your phone browser:<br>'+
          '<div style="background:#1a2235;padding:12px;border-radius:8px;margin:10px 0;word-break:break-all;"><code style="color:#00d4aa;font-size:14px;">'+trackUrl+'</code></div>'+
          '<strong>Steps:</strong><br>'+
          '1. Open the link above on your phone<br>'+
          '2. Tap the green "Start Sharing My Location" button<br>'+
          '3. Allow location access when your phone asks<br>'+
          '4. Keep the page open — your caregiver will see your location<br><br>'+
          '🆘 If you need help, tap the red SOS button on the page.<br><br>'+
          '<strong>Important:</strong> Both your phone and the caregiver must be on the same WiFi network, OR the caregiver must share their internet.<br><br>'+
          'Stay safe! 💚<br>— CareBand Care Team'
      })
    });
    const emailData = await emailRes.json();
    if (emailData.success) showToast('safe','Email Sent!','Tracking link sent to '+email);
    else showToast('warn','Email Issue',emailData.error||'Could not send');
  } catch(e) { showToast('warn','Email Failed',e.message); }

  // Reload patients
  await loadPatients();
  allPatients.forEach(p => { if (!patientMarkers[p.id]) addPatientToMap(p); });

  closeModal('addPatientModal');
  ['patientNameInput','patientAgeInput','patientPhoneInput','patientEmailInput','patientConditionInput'].forEach(id => {const e=document.getElementById(id);if(e)e.value='';});
  const rs = document.getElementById('patientRadiusInput'); if(rs) rs.value = '100';
}

// ============ RENDER PATIENTS ============
function renderDashboardPatients() {
  const list = document.getElementById('dashboardPatientsList'); if (!list) return;
  const noMsg = document.getElementById('noPatientsMsg');
  // Remove old cards
  list.querySelectorAll('.patient-card').forEach(c => c.remove());
  if (allPatients.length === 0) { if(noMsg) noMsg.style.display='block'; return; }
  if(noMsg) noMsg.style.display='none';
  allPatients.forEach((p,i) => {
    const emoji = emojis[i % emojis.length];
    const card = document.createElement('div');
    card.className = 'patient-card'; card.setAttribute('data-patient-id',p.id);
    card.onclick = () => trackPatient(p.id);
    card.innerHTML = '<div class="patient-avatar" style="background:linear-gradient(135deg,'+p.color+',#764ba2)">'+emoji+'</div><div><div class="patient-name">'+esc(p.name)+'</div><div class="patient-detail">'+p.age+' yrs — '+esc(p.condition)+' — 📞 '+esc(p.phone)+'</div></div><div class="patient-status"><span class="status-tag '+(p.status==='safe'?'safe':'warning')+'">'+(p.status==='safe'?'Safe':'Warning')+'</span><button class="resolve-btn" onclick="event.stopPropagation();trackPatient(\''+p.id+'\')" style="margin-top:4px">📍 Track</button></div>';
    list.appendChild(card);
  });
}

function renderPatientsPage() {
  const list = document.getElementById('patientsPageList'); if (!list) return;
  list.innerHTML = '<div class="card-title">All Patients</div>';
  if (allPatients.length === 0) { list.innerHTML += '<div style="text-align:center;padding:20px;color:var(--muted)">No patients added yet</div>'; return; }
  allPatients.forEach((p,i) => {
    const emoji = emojis[i % emojis.length];
    const loc = patientLocations[p.id];
    const locStr = loc ? ' — 📍 '+loc.lat.toFixed(4)+', '+loc.lng.toFixed(4) : '';
    const card = document.createElement('div');
    card.className = 'patient-card'; card.setAttribute('data-patient-id',p.id);
    card.onclick = () => { trackPatient(p.id); showPage('dashboard'); };
    card.innerHTML = '<div class="patient-avatar" style="background:linear-gradient(135deg,'+p.color+',#764ba2)">'+emoji+'</div><div><div class="patient-name">'+esc(p.name)+'</div><div class="patient-detail">'+p.age+' yrs — '+esc(p.condition)+' — 📞 '+esc(p.phone)+locStr+'</div></div><div class="patient-status"><span class="status-tag '+(p.status==='safe'?'safe':'warning')+'">'+(p.status==='safe'?'Safe':'Warning')+'</span><div style="display:flex;gap:4px;margin-top:4px"><button class="resolve-btn" onclick="event.stopPropagation();copyTrackLink(\''+p.id+'\')" title="Copy tracking link">📡 Track Link</button><button class="resolve-btn" onclick="event.stopPropagation();deletePatient(\''+p.id+'\')" style="color:var(--danger);border-color:rgba(239,68,68,0.3)">🗑️</button></div></div>';
    list.appendChild(card);
  });
}

async function deletePatient(pid) {
  if (!confirm('Remove this patient?')) return;
  try { await fetch(API+'/api/patients/'+pid, {method:'DELETE', headers:authHeaders()}); } catch(e) {}
  if (patientMarkers[pid]) { leafletMap.removeLayer(patientMarkers[pid]); delete patientMarkers[pid]; }
  if (patientCircles[pid]) { leafletMap.removeLayer(patientCircles[pid]); delete patientCircles[pid]; }
  if (patientTrails[pid]) { leafletMap.removeLayer(patientTrails[pid]); delete patientTrails[pid]; }
  delete patientLocations[pid];
  allPatients = allPatients.filter(p => p.id !== pid);
  renderDashboardPatients(); renderPatientsPage(); updateAllCounts();
  showToast('warn','Patient Removed','');
}

function updateAllCounts() {
  const n = allPatients.length;
  const safe = allPatients.filter(p=>p.status==='safe').length;
  const el = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  el('statPatients', n); el('statSafe', safe+'/'+n);
  el('patientCountBadge', n+' Active'); el('totalPatientsCount', n);
  el('safeZoneCount', safe); el('attentionCount', n-safe);
}

// ============ EDITABLE ROUTINES (no defaults) ============
function renderRoutines() {
  const list = document.getElementById('routineList'); if (!list) return;
  list.innerHTML = '';
  if (routines.length === 0) { list.innerHTML = '<div style="text-align:center;padding:16px;color:var(--muted);font-size:13px">No routines yet. Click <strong style="color:var(--accent)">+ Add</strong> to create one.</div>'; return; }
  routines.sort((a,b) => a.time.localeCompare(b.time));
  routines.forEach(r => {
    const div = document.createElement('div'); div.className = 'routine-item'; div.style.cursor = 'pointer';
    const dc = r.status==='done'?'done':r.status==='current'?'current':r.status==='missed'?'missed':'';
    div.innerHTML = '<span class="routine-time">'+r.time+'</span><span class="routine-dot '+dc+'" onclick="event.stopPropagation();cycleRoutineStatus(\''+r.id+'\')"></span><span style="flex:1">'+esc(r.activity)+'</span><button onclick="event.stopPropagation();editRoutine(\''+r.id+'\')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px">✏️</button><button onclick="event.stopPropagation();deleteRoutine(\''+r.id+'\')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:12px">✕</button>';
    div.onclick = () => cycleRoutineStatus(r.id);
    list.appendChild(div);
  });
}
function cycleRoutineStatus(rid) {
  const r = routines.find(x=>x.id===rid); if(!r) return;
  const o = ['pending','current','done','missed']; r.status = o[(o.indexOf(r.status)+1)%o.length];
  saveRoutines(); renderRoutines();
  if (r.status==='missed') addAlertToFeed({type:'ROUTINE_MISSED',message:r.activity+' missed at '+r.time,severity:'MEDIUM',time:new Date()});
}
function addRoutine() {
  const time = document.getElementById('routineTimeInput').value;
  const activity = document.getElementById('routineActivityInput').value.trim();
  if (!time||!activity) { showToast('warn','Missing','Time and activity required'); return; }
  routines.push({id:'R'+Date.now(),time,activity,status:'pending'});
  saveRoutines(); renderRoutines(); closeModal('addRoutineModal');
  document.getElementById('routineTimeInput').value=''; document.getElementById('routineActivityInput').value='';
  showToast('safe','Routine Added',activity+' at '+time);
}
function editRoutine(rid) {
  const r = routines.find(x=>x.id===rid); if(!r) return;
  const a = prompt('Edit activity:',r.activity); if(a!==null&&a.trim()){r.activity=a.trim(); const t=prompt('Edit time (HH:MM):',r.time); if(t!==null&&t.trim())r.time=t.trim(); saveRoutines();renderRoutines();}
}
function deleteRoutine(rid) { routines=routines.filter(r=>r.id!==rid); saveRoutines(); renderRoutines(); }
function saveRoutines() { localStorage.setItem('cb_routines', JSON.stringify(routines)); }

// ============ ALERTS ============
function addAlertToFeed(a) {
  const feed = document.getElementById('alertFeed'); if (!feed) return;
  const icons = {GEOFENCE_EXIT:'🚨',VOICE_EMERGENCY:'🗣️',FALL_DETECTED:'⚠️',ROUTINE_MISSED:'⏰',SOS:'🆘',GEOFENCE_ENTER:'✅'};
  const cls = {CRITICAL:'danger',HIGH:'danger',MEDIUM:'warn',LOW:'info'};
  const div = document.createElement('div'); div.className='alert-item '+(cls[a.severity]||'info');
  div.innerHTML='<span class="alert-icon">'+(icons[a.type]||'🔔')+'</span><div class="alert-body"><div class="alert-text">'+esc(a.message)+'</div><div class="alert-time">'+(a.time?timeAgo(new Date(a.time)):'now')+'</div></div><button class="resolve-btn" onclick="resolveAlert(this)">Resolve</button>';
  feed.prepend(div);
  const c=document.getElementById('alertCount'); if(c) c.textContent=(parseInt(c.textContent)||0)+1;
  // Also add to full alerts page
  addAlertToFullPage(a);
}
function resolveAlert(btn) { btn.textContent='Done'; btn.style.color='var(--safe)'; btn.disabled=true; btn.closest('.alert-item').style.opacity='0.4'; }

// ============ VOICE DETECTION ============
function startVoiceDetection() {
  const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
  if (!SR) { showToast('warn','Not Supported','Use Chrome for voice detection'); return; }
  if (isListening) { stopVoiceDetection(); return; }
  voiceRecognition = new SR(); voiceRecognition.continuous=true; voiceRecognition.interimResults=true; voiceRecognition.lang='en-US';
  voiceRecognition.onstart = () => { isListening=true; const b=document.getElementById('voiceBtn'); if(b){b.classList.add('speaking');b.innerHTML='🎙️ Listening... (click to stop)';} const i=document.getElementById('speakingIndicator');if(i)i.classList.add('show'); showToast('safe','Voice Active','Listening for emergency keywords...'); };
  voiceRecognition.onresult = (e) => {
    const l=e.results[e.results.length-1]; const t=l[0].transcript.toLowerCase();
    const d=document.getElementById('voiceTranscript');if(d)d.textContent='"'+t+'"';
    const kw=['help','emergency','save me','doctor','fall','pain','hurt'].find(k=>t.includes(k));
    if(kw&&l.isFinal){
      showToast('danger','EMERGENCY!','"'+kw+'" detected'); triggerEmergencyFlash();
      addAlertToFeed({type:'VOICE_EMERGENCY',message:'Voice: "'+kw+'" detected — "'+t+'"',severity:'CRITICAL',time:new Date()});
      // Send email alert to ALL caregivers via server
      fetch(API+'/api/sos/voice-alert', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({keyword:kw, transcript:t, patientId:activePatientId||'unknown'})
      }).then(r=>r.json()).then(d => {
        if(d.sent>0) showToast('safe','Emails Sent','Alert emailed to '+d.sent+' caregiver(s)');
      }).catch(()=>{});
    }
  };
  voiceRecognition.onerror = (e) => { if(e.error!=='no-speech') showToast('warn','Voice Error',e.error); };
  voiceRecognition.onend = () => { if(isListening) voiceRecognition.start(); };
  voiceRecognition.start();
}
function stopVoiceDetection() { isListening=false; if(voiceRecognition){voiceRecognition.abort();voiceRecognition=null;} const b=document.getElementById('voiceBtn');if(b){b.classList.remove('speaking');b.innerHTML='🎙️ Start Voice Detection';} const i=document.getElementById('speakingIndicator');if(i)i.classList.remove('show'); }

// ============ UI HELPERS ============
function showToast(type,title,sub) { const t=document.getElementById('toast');if(!t)return; t.className='toast show '+type; document.getElementById('toastTitle').textContent=title; document.getElementById('toastSub').textContent=sub||''; setTimeout(()=>t.classList.remove('show'),4000); }
function triggerEmergencyFlash() { const o=document.getElementById('emergencyOverlay');if(o){o.classList.add('show');setTimeout(()=>o.classList.remove('show'),3000);} }
function openModal(id) { const m=document.getElementById(id);if(m)m.classList.add('show'); }
function closeModal(id) { const m=document.getElementById(id);if(m)m.classList.remove('show'); }
function logout() { localStorage.removeItem('cb_token'); localStorage.removeItem('cb_user'); window.location.href='index.html'; }
function getDistance(a,b,c,d) { const R=6371000,dL=(c-a)*Math.PI/180,dN=(d-b)*Math.PI/180,x=Math.sin(dL/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dN/2)**2; return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)); }
function timeAgo(d) { const s=Math.floor((Date.now()-d.getTime())/1000); if(s<60)return'just now'; if(s<3600)return Math.floor(s/60)+'m ago'; if(s<86400)return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; }
function esc(s) { const d=document.createElement('div');d.textContent=s;return d.innerHTML; }
// Keep old name working
function escapeHtml(s) { return esc(s); }

// Copy tracking link for patient's phone
function copyTrackLink(pid) {
  const url = window.location.origin + '/track.html?id=' + pid;
  navigator.clipboard.writeText(url).then(() => {
    showToast('safe','Link Copied!','Send this to patient\'s phone: ' + url);
  }).catch(() => {
    prompt('Copy this tracking link and send to patient\'s phone:', url);
  });
}

// ============ CHANGE PASSWORD ============
async function changePassword() {
  const current = document.getElementById('currentPasswordInput').value;
  const newPw = document.getElementById('newPasswordInput').value;
  const confirm = document.getElementById('confirmNewPasswordInput').value;
  const msg = document.getElementById('passwordChangeMsg');

  if (!current || !newPw || !confirm) { msg.textContent = 'All fields required'; msg.style.color = 'var(--danger)'; return; }
  if (newPw.length < 6) { msg.textContent = 'New password must be at least 6 characters'; msg.style.color = 'var(--danger)'; return; }
  if (newPw !== confirm) { msg.textContent = 'New passwords do not match'; msg.style.color = 'var(--danger)'; return; }

  msg.textContent = 'Updating...'; msg.style.color = 'var(--accent)';

  try {
    const res = await fetch(API + '/api/auth/change-password', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ currentPassword: current, newPassword: newPw })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');

    msg.textContent = '✅ Password changed successfully!'; msg.style.color = 'var(--safe)';
    showToast('safe', 'Password Changed', 'Your password has been updated');
    document.getElementById('currentPasswordInput').value = '';
    document.getElementById('newPasswordInput').value = '';
    document.getElementById('confirmNewPasswordInput').value = '';
    setTimeout(() => closeModal('changePasswordModal'), 1500);
  } catch (e) {
    msg.textContent = '❌ ' + e.message; msg.style.color = 'var(--danger)';
  }
}

// ============ DELETE ACCOUNT ============
async function deleteAccount() {
  const confirmed = confirm('⚠️ Are you sure you want to DELETE your account?\n\nThis will permanently remove:\n- Your account\n- All your patients\n- All alerts\n\nThis cannot be undone!');
  if (!confirmed) return;

  const doubleConfirm = prompt('Type "DELETE" to confirm account deletion:');
  if (doubleConfirm !== 'DELETE') { showToast('warn', 'Cancelled', 'Account not deleted'); return; }

  try {
    const res = await fetch(API + '/api/auth/delete-account', {
      method: 'DELETE', headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');

    showToast('safe', 'Account Deleted', 'Your account has been removed');
    localStorage.clear();
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
  } catch (e) {
    showToast('danger', 'Delete Failed', e.message);
  }
}

// ============ LOAD ALERTS FROM DB ============
async function loadAlerts() {
  try {
    const res = await fetch(API + '/api/alerts', { headers: authHeaders() });
    if (res.ok) {
      const alerts = await res.json();
      alerts.forEach(a => {
        addAlertToFeed({
          type: a.type, message: a.message, severity: a.severity,
          time: new Date(a.time), _id: a._id
        });
        // Also add to full alerts page
        addAlertToFullPage({
          type: a.type, message: a.message, severity: a.severity,
          time: new Date(a.time)
        });
      });
    }
  } catch (e) { /* no alerts loaded */ }
}

function addAlertToFullPage(a) {
  const feed = document.getElementById('alertFeedFull'); if (!feed) return;
  const noMsg = document.getElementById('noAlertsMsg'); if (noMsg) noMsg.style.display = 'none';
  const icons = {GEOFENCE_EXIT:'🚨',VOICE_EMERGENCY:'🗣️',FALL_DETECTED:'⚠️',ROUTINE_MISSED:'⏰',SOS:'🆘',GEOFENCE_ENTER:'✅'};
  const cls = {CRITICAL:'danger',HIGH:'danger',MEDIUM:'warn',LOW:'info'};
  const div = document.createElement('div'); div.className = 'alert-item ' + (cls[a.severity]||'info');
  div.innerHTML = '<span class="alert-icon">'+(icons[a.type]||'🔔')+'</span><div class="alert-body"><div class="alert-text">'+esc(a.message)+'</div><div class="alert-time">'+(a.time?timeAgo(new Date(a.time)):'now')+'</div></div><button class="resolve-btn" onclick="resolveAlert(this)">Resolve</button>';
  feed.prepend(div);
}
