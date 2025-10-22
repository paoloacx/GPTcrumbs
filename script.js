/* Breadcrumbs Timeline - script.js
   Version: replica divided files

*/

/* -------------------------
   Configuration placeholders
   ------------------------- */

// Firebase Configuration (placeholders)
const firebaseConfig = {
  apiKey: "AIzaSyAb-MLu8atl5hruOPLDhgftjkjc_1M2038",
  authDomain: "breadcrumbs-8b59e.firebaseapp.com",
  projectId: "breadcrumbs-8b59e",
  storageBucket: "breadcrumbs-8b59e.firebasestorage.app",
  messagingSenderId: "912286191427",
  appId: "1:912286191427:web:e78b665df6a6ff6d8529f6",
  measurementId: "G-GZYTDYNSRB"
};

// Weather API key placeholder
const WEATHER_API_KEY = '317f7bcb07cf05e2c6265176c502a4bb';

/* -------------------------
   Initialize Firebase app
   ------------------------- */
try {
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    // Avoid re-init if already initialized
    try { firebase.initializeApp(firebaseConfig); } catch (e) { /* already initialized */ }
  }
} catch (e) {
  console.warn('Firebase not available in this environment', e);
}

/* -------------------------
   References to services
   ------------------------- */
const auth = (window.firebase && firebase.auth) ? firebase.auth() : null;
const db = (window.firebase && firebase.firestore) ? firebase.firestore() : null;
const storage = (window.firebase && firebase.storage) ? firebase.storage() : null;

/* -------------------------
   DOM elements
   ------------------------- */
const el = id => document.getElementById(id);

const authContainer = el('auth-container');
const mainApp = el('main-app');
const signInGoogle = el('sign-in-google');
const continueOfflineBtn = el('continue-offline');
const signOutBtn = el('sign-out');

const addBreadcrumbBtn = el('add-breadcrumb');
const timeBtn = el('time-btn');
const trackBtn = el('track-btn');
const spentBtn = el('spent-btn');

const syncStatus = el('sync-status');
const userEmailShort = el('user-email-short');

const timelineContainer = el('timeline-container');
const emptyState = el('empty-state');

const formWindow = el('form-window');
const saveBtn = el('save-btn');
const deleteBtn = el('delete-btn');
const cancelBtn = el('cancel-btn');

const moodSelector = el('mood-selector');
const moodConfigToggle = el('mood-config-toggle');
const moodConfig = el('mood-config');
const moodConfigList = el('mood-config-list');
const saveMood = el('save-mood');

const noteInput = el('note-input');
const locationInput = el('location-input');
const weatherInput = el('weather-input');
const gpsBtn = el('gps-btn');
const imageInput = el('image-input');
const imagePreviews = el('image-previews');

const recordBtn = el('record-btn');
const stopRecordBtn = el('stop-record-btn');
const audioPreview = el('audio-preview');

const timerWindow = el('timer-window');
const durationSelector = el('duration-selector');
const activitySelector = el('activity-selector');
const createTimeBtn = el('create-time-btn');
const closeTimer = el('close-timer');

const trackWindow = el('track-window');
const trackContainer = el('track-container');
const closeTrack = el('close-track');

const spentWindow = el('spent-window');
const spentDescription = el('spent-description');
const spentAmount = el('spent-amount');
const saveSpentBtn = el('save-spent');
const closeSpentBtn = el('close-spent');

const previewModal = el('preview-modal');
const previewBody = el('preview-body');

/* -------------------------
   App state
   ------------------------- */
let currentUser = null;
let isOfflineMode = false;
let entries = []; // will hold entries in memory
let currentImages = [];
let currentAudio = null;
let currentCoords = null;
let editingEntryId = null;
let selectedMoodIndex = null;
let selectedDuration = null;
let selectedActivity = null;
let mediaRecorder = null;
let audioChunks = [];

/* default options (match original) */
let timeDurations = [15, 30, 60, 120, 180];
let timeActivities = ['Reading', 'Sports', 'Work', 'Cleaning', 'Errands'];
let trackItems = {
  meals: ['🍳 Breakfast', '🥗 Lunch', '🍽️ Dinner', '☕ Snack'],
  tasks: ['💊 Medicine', '💧 Water', '🚶 Walk', '📞 Call']
};

let moods = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😡', label: 'Angry' },
  { emoji: '😰', label: 'Anxious' },
  { emoji: '😴', label: 'Tired' }
];

/* -------------------------
   Utility helpers
   ------------------------- */
function escapeHtml(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function saveDataToLocal() {
  localStorage.setItem('timeline-entries', JSON.stringify(entries));
}

function loadDataFromLocal() {
  const raw = localStorage.getItem('timeline-entries');
  if (raw) {
    try { entries = JSON.parse(raw); } catch(e){ entries = []; }
  }
}

/* -------------------------
   Sync helpers (firebase)
   ------------------------- */
async function saveDataToFirebase() {
  if (!currentUser || !db) return;
  try {
    await Promise.all(entries.map(entry => {
      const docRef = db.collection('users').doc(currentUser.uid).collection('entries').doc(String(entry.id));
      return docRef.set(entry);
    }));
    updateSyncStatus('online');
  } catch (e) {
    console.error('Error saving to firebase', e);
    updateSyncStatus('offline');
  }
}

async function loadDataFromFirebase() {
  if (!currentUser || !db) return;
  updateSyncStatus('syncing');
  try {
    const snap = await db.collection('users').doc(currentUser.uid).collection('entries').orderBy('timestamp','desc').get();
    entries = [];
    snap.forEach(doc => entries.push({ id: doc.id, ...doc.data() }));
    renderTimeline();
    updateSyncStatus('online');
  } catch (e) {
    console.error('Error loading from firebase', e);
    updateSyncStatus('offline');
    loadDataFromLocal();
  }
}

/* -------------------------
   UI helpers
   ------------------------- */
function updateSyncStatus(status) {
  if (!syncStatus) return;
  if (status === 'online') { syncStatus.textContent = '● Online'; syncStatus.style.color = '#0a0'; }
  else if (status === 'syncing') { syncStatus.textContent = '↻ Syncing...'; syncStatus.style.color = '#f0a'; }
  else { syncStatus.textContent = '● Offline'; syncStatus.style.color = '#f33'; }
}

function showMainApp() {
  if (authContainer) authContainer.classList.add('hidden');
  if (mainApp) mainApp.classList.remove('hidden');
  if (currentUser) {
    const e = currentUser.email || '';
    userEmailShort.textContent = e.length > 20 ? e.slice(0,17) + '...' : e;
  }
}

/* -------------------------
   Rendering timeline
   ------------------------- */
function formatDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

function getDayKey(ts) {
  const d = new Date(ts);
  return d.toISOString().split('T')[0];
}

function renderTimeline() {
  if (!timelineContainer) return;
  if (!entries || entries.length === 0) {
    timelineContainer.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  // group by day
  const grouped = {};
  entries.forEach(e => {
    const day = getDayKey(e.timestamp || e.date || e.id);
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(e);
  });

  const days = Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

  let html = '<div class="timeline-list">';
  days.forEach(day => {
    const dayEntries = grouped[day];
    html += `<div class="day-block"><div class="day-header">${day}</div><div class="day-content">`;
    dayEntries.forEach(entry => {
      html += renderEntryHTML(entry);
    });
    html += '</div></div>';
  });
  html += '</div>';
  timelineContainer.innerHTML = html;
}

function renderEntryHTML(entry) {
  const id = entry.id || Date.now();
  let note = entry.note ? escapeHtml(entry.note) : '';
  let mood = entry.mood ? `<span class="mood">${escapeHtml(entry.mood.emoji || entry.mood || '')}</span>` : '';
  let weather = entry.weather ? `<div class="meta">☁️ ${escapeHtml(entry.weather)}</div>` : '';
  let location = entry.location ? `<div class="meta">📍 ${escapeHtml(entry.location)}</div>` : '';
  let imagesHtml = '';
  if (entry.images && entry.images.length) {
    imagesHtml = `<div class="images">` + entry.images.map(img => `<img src="${img}" style="max-width:120px;margin-right:8px;border-radius:8px" />`).join('') + `</div>`;
  }
  let audioHtml = entry.audio ? `<audio controls src="${entry.audio}"></audio>` : '';
  let timeMeta = `<div class="meta">${formatDateTime(entry.timestamp || entry.date)}</div>`;
  let controls = `<div class="entry-controls"><button onclick="editEntry(${id})" class="btn small">✏️ Edit</button><button onclick="previewEntry(${id})" class="btn small neutral">🔍 Preview</button></div>`;
  let extra = '';
  if (entry.isTimedActivity || entry.activity) {
    extra += `<div class="meta">⏱️ ${escapeHtml(entry.activity || '')} ${entry.duration ? ` - ${entry.duration} min` : ''}</div>`;
  }
  if (entry.isSpent || entry.spentAmount) {
    extra += `<div class="meta">💰 €${(entry.spentAmount || entry.amount || 0).toFixed ? (entry.spentAmount || entry.amount).toFixed(2) : (entry.spentAmount || entry.amount)}</div>`;
  }
  return `<div class="timeline-entry" id="entry-${id}">
    ${controls}
    ${timeMeta}
    <div style="display:flex;align-items:center;gap:8px;margin-top:8px">${mood}<div class="note">${note}</div></div>
    ${location}
    ${weather}
    ${imagesHtml}
    ${audioHtml}
    ${extra}
  </div>`;
}

/* -------------------------
   Entry CRUD
   ------------------------- */
function openFormForNew() {
  editingEntryId = null;
  currentImages = [];
  currentAudio = null;
  currentCoords = null;
  selectedMoodIndex = null;
  noteInput.value = '';
  locationInput.value = '';
  weatherInput.value = '';
  imagePreviews.innerHTML = '';
  audioPreview.innerHTML = '';
  saveBtn.textContent = '💾 Save';
  deleteBtn.classList.add('hidden');
  formWindow.classList.remove('hidden');
}

function toggleForm() {
  if (!formWindow) return;
  formWindow.classList.toggle('hidden');
}

function saveEntry() {
  const note = noteInput.value.trim();
  if (!note) { alert('Please write a note'); return; }
  const mood = selectedMoodIndex !== null ? moods[selectedMoodIndex] : null;
  const entry = {
    id: editingEntryId || Date.now(),
    timestamp: new Date().toISOString(),
    note,
    location: locationInput.value || '',
    weather: weatherInput.value || '',
    images: [...currentImages],
    audio: currentAudio || null,
    coords: currentCoords ? { ...currentCoords } : null,
    mood
  };
  if (editingEntryId) {
    const idx = entries.findIndex(e => e.id === editingEntryId);
    if (idx !== -1) entries[idx] = entry;
  } else entries.unshift(entry);

  saveDataToLocal();
  if (!isOfflineMode && currentUser) saveDataToFirebase().catch(()=>{});
  renderTimeline();
  formWindow.classList.add('hidden');
}

function editEntry(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  editingEntryId = id;
  noteInput.value = entry.note || '';
  locationInput.value = entry.location || '';
  weatherInput.value = entry.weather || '';
  currentImages = [...(entry.images || [])];
  currentAudio = entry.audio || null;
  currentCoords = entry.coords ? { ...entry.coords } : null;
  // set mood selection if available
  if (entry.mood) {
    const idx = moods.findIndex(m => m.emoji === entry.mood.emoji && m.label === entry.mood.label);
    selectedMoodIndex = idx !== -1 ? idx : null;
  } else selectedMoodIndex = null;
  renderImagePreviews();
  renderAudioPreview();
  saveBtn.textContent = '💾 Update';
  deleteBtn.classList.remove('hidden');
  formWindow.classList.remove('hidden');
}

function deleteCurrentEntry() {
  if (!editingEntryId) return;
  if (!confirm('Delete this entry?')) return;
  entries = entries.filter(e => e.id !== editingEntryId);
  if (!isOfflineMode && currentUser && db) {
    db.collection('users').doc(currentUser.uid).collection('entries').doc(String(editingEntryId)).delete().catch(console.error);
  }
  saveDataToLocal();
  renderTimeline();
  toggleForm();
}

/* -------------------------
   Image handling
   ------------------------- */
function handleImageFiles(files) {
  const arr = Array.from(files || []);
  arr.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      // optional: resize via canvas (omitted here to keep fidelity)
      currentImages.push(e.target.result);
      renderImagePreviews();
    };
    reader.readAsDataURL(file);
  });
}

function renderImagePreviews() {
  if (!imagePreviews) return;
  imagePreviews.innerHTML = currentImages.map((img, i) => `<div class="thumb"><img src="${img}" style="width:120px;border-radius:8px"/><div><button onclick="removeImage(${i})" class="btn small danger">✕</button></div></div>`).join('');
}
function removeImage(i) { currentImages.splice(i,1); renderImagePreviews(); }

/* -------------------------
   Audio recording
   ------------------------- */
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => { currentAudio = reader.result; renderAudioPreview(); };
      reader.readAsDataURL(blob);
      stream.getTracks().forEach(t=>t.stop());
    };
    mediaRecorder.start();
    recordBtn.disabled = true;
    stopRecordBtn.disabled = false;
  } catch (e) {
    alert('Could not access microphone');
    console.error(e);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  recordBtn.disabled = false;
  stopRecordBtn.disabled = true;
}

function renderAudioPreview() {
  if (!audioPreview) return;
  audioPreview.innerHTML = currentAudio ? `<audio controls src="${currentAudio}"></audio> <button class="btn small danger" onclick="removeAudio()">✕</button>` : '';
}
function removeAudio() { currentAudio = null; renderAudioPreview(); }

/* -------------------------
   GPS & Weather
   ------------------------- */
function getGPS() {
  if (!navigator.geolocation) { alert('Geolocation not available'); return; }
  gpsBtn.textContent = '⏳ Searching...'; gpsBtn.disabled = true;
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude; const lon = pos.coords.longitude;
    currentCoords = { lat, lon };
    // set location text and show mini-map in form (create an element)
    locationInput.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    // fetch weather
    getWeather(lat, lon);
    gpsBtn.textContent = '🌍 GPS OK'; gpsBtn.disabled = false;
    // display a mini map container (if not exists)
    if (!document.getElementById('form-map')) {
      const mapDiv = document.createElement('div'); mapDiv.id = 'form-map'; mapDiv.style.height = '180px'; mapDiv.style.marginTop = '8px';
      imagePreviews.parentNode.insertBefore(mapDiv, imagePreviews.nextSibling);
    }
    createLeafletMap('form-map', lat, lon, 13);
  }, err => {
    alert('Error getting location: ' + err.message);
    gpsBtn.textContent = '🌍 Use GPS'; gpsBtn.disabled = false;
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

async function getWeather(lat, lon) {
  if (!WEATHER_API_KEY || WEATHER_API_KEY === 'pinaquituclave') return;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric&lang=en`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather API returned ' + res.status);
    const data = await res.json();
    const temp = Math.round(data.main.temp);
    const desc = data.weather[0].description;
    weatherInput.value = `${desc}, ${temp}°C`;
  } catch (e) {
    console.error('Weather fetch error', e);
  }
}

/* -------------------------
   Leaflet helpers
   ------------------------- */
function createLeafletMap(containerId, lat, lon, zoom = 13) {
  try {
    // remove old map
    const container = document.getElementById(containerId);
    if (!container) return;
    if (container._leaflet_map) { try { container._leaflet_map.remove(); } catch(e){} container._leaflet_map = null; }
    const map = L.map(containerId).setView([lat, lon], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    L.marker([lat, lon]).addTo(map);
    container._leaflet_map = map;
    setTimeout(()=>map.invalidateSize(),100);
    return map;
  } catch (e) { console.warn('Leaflet error', e); }
}

/* -------------------------
   Timer / Track / Spent
   ------------------------- */
function updateTimerOptionsUI() {
  if (!durationSelector || !activitySelector) return;
  durationSelector.innerHTML = timeDurations.map(d => `<button class="btn small" data-duration="${d}">${d<60?d+' min':(d/60)+' hour'}</button>`).join('');
  activitySelector.innerHTML = timeActivities.map(a => `<button class="btn small">${escapeHtml(a)}</button>`).join('');
  // hooks
  Array.from(durationSelector.querySelectorAll('button')).forEach(btn => {
    btn.addEventListener('click', (ev) => {
      selectedDuration = parseInt(btn.dataset.duration,10);
      Array.from(durationSelector.querySelectorAll('button')).forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      checkCreateTimeReady();
    });
  });
  Array.from(activitySelector.querySelectorAll('button')).forEach(btn => {
    btn.addEventListener('click', () => {
      selectedActivity = btn.textContent.trim();
      Array.from(activitySelector.querySelectorAll('button')).forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      checkCreateTimeReady();
    });
  });
}

function checkCreateTimeReady() {
  if (!createTimeBtn) return;
  createTimeBtn.disabled = !(selectedDuration && selectedActivity);
}

function createTimeEventUI() {
  if (!selectedDuration || !selectedActivity) return;
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    isTimedActivity: true,
    activity: selectedActivity,
    duration: selectedDuration,
    note: `${selectedActivity} - ${selectedDuration} minutes`
  };
  entries.unshift(entry);
  saveDataToLocal();
  renderTimeline();
  timerWindow.classList.add('hidden');
  selectedActivity = null; selectedDuration = null;
}

/* quick track */
function updateTrackOptions() {
  if (!trackContainer) return;
  trackContainer.innerHTML = `
    <div style="margin-bottom:10px"><strong>Meals</strong><div>${trackItems.meals.map(m=>`<button class="btn small" onclick="quickTrack('${m.replace(/'/g,"\\'")}')">${m}</button>`).join('')}</div></div>
    <div><strong>Tasks</strong><div>${trackItems.tasks.map(t=>`<button class="btn small" onclick="quickTrack('${t.replace(/'/g,"\\'")}')">${t}</button>`).join('')}</div></div>
  `;
}
function quickTrack(label) {
  const entry = { id: Date.now(), timestamp: new Date().toISOString(), isQuickTrack: true, note: label };
  entries.unshift(entry);
  saveDataToLocal();
  renderTimeline();
}

/* spent */
function saveSpentUI() {
  const desc = spentDescription.value.trim();
  const amt = parseFloat(spentAmount.value);
  if (!desc || isNaN(amt)) { alert('Valid description and amount needed'); return; }
  const entry = { id: Date.now(), timestamp: new Date().toISOString(), isSpent: true, spentAmount: amt, note: desc };
  entries.unshift(entry);
  saveDataToLocal();
  renderTimeline();
  spentWindow.classList.add('hidden');
  spentDescription.value=''; spentAmount.value='';
}

/* export */
function exportCSV() {
  const headers = ['Date and Time','Note','Activity','Duration (min)','Location','Weather','Mood','Spent','Images'];
  const rows = entries.map(e => [
    new Date(e.timestamp).toLocaleString(),
    e.note || '',
    e.activity || '',
    e.duration || '',
    e.location || '',
    e.weather || '',
    e.mood ? `${e.mood.emoji || e.mood}` : '',
    e.spentAmount ? `€${e.spentAmount}` : '',
    e.images ? e.images.length : 0
  ]);
  const csv = [headers, ...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `breadcrumbs-${Date.now()}.csv`; a.click();
}
function exportICS() {
  const events = entries.map(e => {
    const date = new Date(e.timestamp);
    const dt = date.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
    return `BEGIN:VEVENT\nUID:${e.id}@breadcrumbs\nDTSTAMP:${dt}\nDTSTART:${dt}\nSUMMARY:${escapeHtml((e.note||'').substring(0,50))}\nDESCRIPTION:${escapeHtml(e.note||'')}\nLOCATION:${escapeHtml(e.location||'')}\nEND:VEVENT`;
  }).join('\n');
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Breadcrumbs Timeline//ES\n${events}\nEND:VCALENDAR`;
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `breadcrumbs-${Date.now()}.ics`; a.click();
}

/* Preview */
function previewEntry(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  let html = `<div style="padding:12px">`;
  html += `<div><strong>Time:</strong> ${formatDateTime(entry.timestamp)}</div>`;
  if (entry.mood) html += `<div style="margin-top:8px"><strong>Mood:</strong> ${escapeHtml(entry.mood.emoji || entry.mood)}</div>`;
  html += `<div style="margin-top:12px"><strong>Note:</strong><div style="margin-top:6px">${escapeHtml(entry.note || '')}</div></div>`;
  if (entry.location) html += `<div style="margin-top:8px"><strong>Location:</strong> ${escapeHtml(entry.location)}</div>`;
  if (entry.weather) html += `<div style="margin-top:8px"><strong>Weather:</strong> ${escapeHtml(entry.weather)}</div>`;
  if (entry.coords) html += `<div style="margin-top:8px"><strong>Map:</strong><div id="preview-map" style="height:220px;margin-top:6px"></div></div>`;
  if (entry.images && entry.images.length) html += `<div style="margin-top:8px"><strong>Images:</strong><div>${entry.images.map(i=>`<img src="${i}" style="max-width:120px;margin-right:8px;border-radius:8px">`).join('')}</div></div>`;
  if (entry.audio) html += `<div style="margin-top:8px"><strong>Audio:</strong><audio controls src="${entry.audio}"></audio></div>`;
  html += `</div>`;
  previewBody.innerHTML = html;
  previewModal.classList.remove('hidden');
  if (entry.coords) setTimeout(()=>createLeafletMap('preview-map', entry.coords.lat, entry.coords.lon, 13), 150);
}
function closePreview(e) {
  if (e && e.target !== previewModal) return;
  previewModal.classList.add('hidden'); previewBody.innerHTML = '';
}

/* -------------------------
   Init & Event binding
   ------------------------- */
function initUI() {
  // load stored data
  loadDataFromLocal();
  renderTimeline();
  updateTimerOptionsUI();
  updateTrackOptions();

  // initial test data if none (keeps parity with original behavior)
  if (!entries || entries.length === 0) {
    entries.unshift({ id: Date.now(), timestamp: new Date().toISOString(), note: 'Welcome — create your first breadcrumb', mood: moods[0] });
    saveDataToLocal();
    renderTimeline();
  }

  // auth/offline buttons
  continueOfflineBtn && continueOfflineBtn.addEventListener('click', ()=>{ isOfflineMode = true; authContainer.classList.add('hidden'); mainApp.classList.remove('hidden'); updateSyncStatus('offline'); renderTimeline(); });
  signInGoogle && signInGoogle.addEventListener('click', ()=>alert('Google sign-in will be available when Firebase keys are set. Use Continue Offline for now.'));
  signOutBtn && signOutBtn.addEventListener('click', ()=>{ mainApp.classList.add('hidden'); authContainer.classList.remove('hidden'); });

  // open/close forms
  addBreadcrumbBtn && addBreadcrumbBtn.addEventListener('click', openFormForNew);
  cancelBtn && cancelBtn.addEventListener('click', toggleForm);
  saveBtn && saveBtn.addEventListener('click', saveEntry);
  deleteBtn && deleteBtn.addEventListener('click', deleteCurrentEntry);

  // mood UI
  moodConfigToggle && moodConfigToggle.addEventListener('click', ()=>moodConfig.classList.toggle('hidden'));
  saveMood && saveMood.addEventListener('click', ()=>{ /* save mood config to local */ saveDataToLocal(); moodConfig.classList.add('hidden'); });

  // image upload
  imageInput && imageInput.addEventListener('change', (ev)=>handleImageFiles(ev.target.files));

  // audio
  recordBtn && recordBtn.addEventListener('click', startRecording);
  stopRecordBtn && stopRecordBtn.addEventListener('click', stopRecording);

  // gps & weather
  gpsBtn && gpsBtn.addEventListener('click', getGPS);

  // timer
  timeBtn && timeBtn.addEventListener('click', ()=>timerWindow.classList.remove('hidden'));
  closeTimer && closeTimer.addEventListener('click', ()=>timerWindow.classList.add('hidden'));
  createTimeBtn && createTimeBtn.addEventListener('click', createTimeEventUI);

  // track
  trackBtn && trackBtn.addEventListener('click', ()=>trackWindow.classList.remove('hidden'));
  closeTrack && closeTrack.addEventListener('click', ()=>trackWindow.classList.add('hidden'));

  // spent
  spentBtn && spentBtn.addEventListener('click', ()=>spentWindow.classList.remove('hidden'));
  closeSpentBtn && closeSpentBtn.addEventListener('click', ()=>spentWindow.classList.add('hidden'));
  saveSpentBtn && saveSpentBtn.addEventListener('click', saveSpentUI);

  // exports
  el('export-csv') && el('export-csv').addEventListener('click', exportCSV);
  el('export-ical') && el('export-ical').addEventListener('click', exportICS);

  // preview close
  previewModal && previewModal.addEventListener('click', closePreview);
}

initUI();

/* Expose some functions globally for inline onclick handlers */
window.editEntry = editEntry;
window.previewEntry = previewEntry;
window.quickTrack = quickTrack;
window.removeImage = removeImage;
window.toggleForm = toggleForm;
