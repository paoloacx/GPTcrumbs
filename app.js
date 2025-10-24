// Weather API Key
const WEATHER_API_KEY = '317f7bcb07cf05e2c6265176c502a4bb';

// Global variables
let entries = [];
let currentImages = [];
let currentAudio = null;
let currentCoords = null;
let editingEntryId = null;
let selectedMood = null;
let selectedDuration = null;
let selectedActivity = null;
let selectedTrackItem = null;

let mediaRecorder = null;
let audioChunks = [];

// Refresh function
function refreshApp() {
    if (currentUser && !isOfflineMode) {
        loadDataFromFirebase();
        loadSettingsFromFirebase();
        alert('✅ Synced!');
    } else {
        location.reload();
    }
}



// Settings
let timeDurations = [15, 30, 60, 120, 180];
let timeActivities = ['Reading', 'Sports', 'Work', 'Cleaning', 'Errands'];
let trackItems = {
    meals: ['🍳 Breakfast', '🥗 Lunch', '🍽️ Dinner', '☕ Snack'],
    tasks: ['💊 Medicine', '💧 Water', '🚶 Walk', '📞 Call']
};

// Default moods
const defaultMoods = [
    { emoji: '😊', label: 'Happy' },
    { emoji: '😢', label: 'Sad' },
    { emoji: '😡', label: 'Angry' },
    { emoji: '😰', label: 'Anxious' },
    { emoji: '😴', label: 'Tired' }
];

let moods = [...defaultMoods];

// Load settings from localStorage
function loadSettings() {
    const savedDurations = localStorage.getItem('time-durations');
    const savedActivities = localStorage.getItem('time-activities');
    const savedTrackItems = localStorage.getItem('track-items');
    const savedMoods = localStorage.getItem('mood-config');
    
    if (savedDurations) timeDurations = JSON.parse(savedDurations);
    if (savedActivities) timeActivities = JSON.parse(savedActivities);
    if (savedTrackItems) trackItems = JSON.parse(savedTrackItems);
    if (savedMoods) moods = JSON.parse(savedMoods);
}

// Save settings to localStorage
function saveSettingsToStorage() {
    localStorage.setItem('time-durations', JSON.stringify(timeDurations));
    localStorage.setItem('time-activities', JSON.stringify(timeActivities));
    localStorage.setItem('track-items', JSON.stringify(trackItems));
    localStorage.setItem('mood-config', JSON.stringify(moods));
}

// Load data from localStorage
function loadData() {
    const saved = localStorage.getItem('timeline-entries');
    if (saved) {
        entries = JSON.parse(saved);
    }
    renderTimeline();
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('timeline-entries', JSON.stringify(entries));
    if (!isOfflineMode && currentUser) {
        saveDataToFirebase();
    }
}


// Sync/Refresh data
function syncData() {
    location.reload();
}

// Toggle forms
function toggleForm() {
    const form = document.getElementById('form-window');
    const timer = document.getElementById('timer-window');
    const track = document.getElementById('track-window');
    const spent = document.getElementById('spent-window');
    timer.classList.add('hidden');
    track.classList.add('hidden');
    spent.classList.add('hidden');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
        clearForm();
        renderMoodSelector();
        setCurrentDateTime('datetime-input');
    }
}

function toggleTimer() {
    const timer = document.getElementById('timer-window');
    const form = document.getElementById('form-window');
    const track = document.getElementById('track-window');
    const spent = document.getElementById('spent-window');
    form.classList.add('hidden');
    track.classList.add('hidden');
    spent.classList.add('hidden');
    timer.classList.toggle('hidden');
    if (!timer.classList.contains('hidden')) {
        resetTimerSelections();
        setCurrentDateTime('datetime-input-time');
    }
}

function toggleTrack() {
    const track = document.getElementById('track-window');
    const form = document.getElementById('form-window');
    const timer = document.getElementById('timer-window');
    const spent = document.getElementById('spent-window');
    form.classList.add('hidden');
    timer.classList.add('hidden');
    spent.classList.add('hidden');
    track.classList.toggle('hidden');
    if (!track.classList.contains('hidden')) {
        renderTrackSelector();
        setCurrentDateTime('datetime-input-track');
        selectedTrackItem = null;
        document.getElementById('save-track-btn').disabled = true;
        document.getElementById('delete-track-btn').classList.add('hidden');
        document.getElementById('track-optional-note').value = '';
    }
}

function toggleSpent() {
    const spent = document.getElementById('spent-window');
    const form = document.getElementById('form-window');
    const timer = document.getElementById('timer-window');
    const track = document.getElementById('track-window');
    form.classList.add('hidden');
    timer.classList.add('hidden');
    track.classList.add('hidden');
    spent.classList.toggle('hidden');
    if (!spent.classList.contains('hidden')) {
        document.getElementById('spent-description').value = '';
        document.getElementById('spent-amount').value = '';
        setCurrentDateTime('datetime-input-spent');
        document.getElementById('delete-spent-btn').classList.add('hidden');
    }
}

// Set current date/time in input
function setCurrentDateTime(inputId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`;
    document.getElementById(inputId).value = dateTimeString;
}

// Get timestamp from datetime input
function getTimestampFromInput(inputId) {
    const value = document.getElementById(inputId).value;
    if (!value) return new Date().toISOString();
    return new Date(value).toISOString();
}

// Clear form
function clearForm() {
    document.getElementById('note-input').value = '';
    document.getElementById('location-input').value = '';
    document.getElementById('weather-input').value = '';
    currentImages = [];
    currentAudio = null;
    currentCoords = null;
    editingEntryId = null;
    selectedMood = null;
    document.getElementById('image-previews').innerHTML = '';
    document.getElementById('audio-preview').innerHTML = '';
    document.getElementById('delete-btn').classList.add('hidden');
    document.getElementById('save-btn').textContent = '💾 Save';
    document.getElementById('mood-config').classList.add('hidden');
    const mapContainer = document.getElementById('form-map');
    if (mapContainer) {
        mapContainer.style.display = 'none';
        mapContainer.innerHTML = '';
    }
}

function cancelEdit() {
    clearForm();
    toggleForm();
}

// GPS functions
function getGPS() {
    const btn = document.getElementById('gps-btn');
    const locationInput = document.getElementById('location-input');
    btn.textContent = '⏳ Searching...';
    btn.disabled = true;

    if (!navigator.geolocation) {
        alert('Geolocation not available');
        btn.textContent = '🌍 Use GPS';
        btn.disabled = false;
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            currentCoords = { lat, lon };
            
            locationInput.placeholder = 'Getting location...';
            
            showMiniMap(lat, lon, 'form-map');
            getWeather(lat, lon);
            
            btn.textContent = '🌍 GPS OK';
            btn.disabled = false;
        },
        (error) => {
            console.error('GPS Error:', error);
            btn.textContent = '🌍 Use GPS';
            btn.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

async function getWeather(lat, lon) {
    const weatherInput = document.getElementById('weather-input');
    const locationInput = document.getElementById('location-input');
    
    weatherInput.value = '⏳ Getting weather...';
    
    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric&lang=en`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Weather API returned ' + response.status);
        }
        
        const data = await response.json();
        
        const temp = Math.round(data.main.temp);
        const description = data.weather[0].description;
        const emoji = getWeatherEmoji(data.weather[0].id);
        const city = data.name || 'Unknown';
        
        weatherInput.value = `${emoji} ${description}, ${temp}°C in ${city}`;
        locationInput.value = city;
    } catch (error) {
        console.error('Error getting weather:', error);
        weatherInput.value = '';
        locationInput.value = '';
    }
}

function getWeatherEmoji(code) {
    if (code >= 200 && code < 300) return '⛈️';
    if (code >= 300 && code < 400) return '🌦️';
    if (code >= 500 && code < 600) return '🌧️';
    if (code >= 600 && code < 700) return '❄️';
    if (code >= 700 && code < 800) return '🌫️';
    if (code === 800) return '☀️';
    if (code > 800) return '☁️';
    return '🌤️';
}

function showMiniMap(lat, lon, containerId) {
    const mapContainer = document.getElementById(containerId);
    if (!mapContainer) return;

    mapContainer.innerHTML = '';
    mapContainer.style.display = 'block';

    const map = L.map(containerId).setView([lat, lon], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }).addTo(map);

    L.marker([lat, lon]).addTo(map);

    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}

// Image handling
function handleImages(event) {
    const files = Array.from(event.target.files);
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let width = img.width;
                let height = img.height;
                const maxSize = 800;
                
                if (width > height && width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                const resizedImage = canvas.toDataURL('image/jpeg', 0.8);
                
                currentImages.push(resizedImage);
                renderImagePreviews();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Audio recording - iOS compatible
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            } 
        });
        
        // Detectar formato compatible con iOS
        let options = {};
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
            options = { mimeType: 'audio/mp4' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            options = { mimeType: 'audio/ogg' };
        }
        
        mediaRecorder = new MediaRecorder(stream, options);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const mimeType = mediaRecorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            const reader = new FileReader();
            reader.onloadend = () => {
                currentAudio = reader.result;
                renderAudioPreview();
            };
            reader.readAsDataURL(audioBlob);
            
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        document.getElementById('record-btn').disabled = true;
        document.getElementById('stop-record-btn').disabled = false;
        document.querySelector('.audio-recorder').classList.add('recording');
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access microphone.');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        document.getElementById('record-btn').disabled = false;
        document.getElementById('stop-record-btn').disabled = true;
        document.querySelector('.audio-recorder').classList.remove('recording');
    }
}

function renderImagePreviews() {
    const container = document.getElementById('image-previews');
    container.innerHTML = currentImages.map((img, idx) => `
        <div class="image-preview">
            <img src="${img}" alt="">
            <div class="image-remove" onclick="removeImage(${idx})">✕</div>
        </div>
    `).join('');
}

function renderAudioPreview() {
    const container = document.getElementById('audio-preview');
    if (currentAudio) {
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                <audio controls style="flex: 1;">
                    <source src="${currentAudio}" type="audio/webm">
                </audio>
                <button class="mac-button" onclick="removeAudio()" style="padding: 4px 8px;">✕</button>
            </div>
        `;
    } else {
        container.innerHTML = '';
    }
}

function removeImage(index) {
    currentImages.splice(index, 1);
    renderImagePreviews();
}

function removeAudio() {
    currentAudio = null;
    renderAudioPreview();
}
// Mood functions
function renderMoodSelector() {
    const container = document.getElementById('mood-selector');
    container.innerHTML = moods.map((mood, index) => `
        <div class="mood-option ${selectedMood === index ? 'selected' : ''}" onclick="selectMood(${index})">
            ${mood.emoji}
            <span class="mood-label">${mood.label}</span>
        </div>
    `).join('');
}

function selectMood(index) {
    selectedMood = index;
    renderMoodSelector();
}

function toggleMoodConfig() {
    const panel = document.getElementById('mood-config');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        renderMoodConfig();
    }
}

function renderMoodConfig() {
    const container = document.getElementById('mood-config-list');
    container.innerHTML = moods.map((mood, index) => `
        <div class="config-item">
            <input type="text" value="${mood.emoji}" id="mood-emoji-${index}" maxlength="2">
            <input type="text" value="${mood.label}" id="mood-label-${index}" placeholder="Label">
        </div>
    `).join('');
}

function saveMoodConfig() {
    moods = moods.map((mood, index) => ({
        emoji: document.getElementById(`mood-emoji-${index}`).value || mood.emoji,
        label: document.getElementById(`mood-label-${index}`).value || mood.label
    }));
    localStorage.setItem('mood-config', JSON.stringify(moods));
    if (currentUser && !isOfflineMode) {
        saveSettingsToFirebase();
    }
    renderMoodSelector();
    toggleMoodConfig();
    alert('✅ Configuration saved');
}

// Save/Edit entry functions
function saveEntry() {
    const note = document.getElementById('note-input').value.trim();
    if (!note) {
        alert('Please write a note');
        return;
    }

    const moodData = selectedMood !== null ? moods[selectedMood] : null;
    const timestamp = getTimestampFromInput('datetime-input');

    if (editingEntryId) {
        const entryIndex = entries.findIndex(e => e.id === editingEntryId);
        if (entryIndex !== -1) {
            entries[entryIndex] = {
                ...entries[entryIndex],
                timestamp: timestamp,
                note: note,
                location: document.getElementById('location-input').value,
                weather: document.getElementById('weather-input').value,
                images: [...currentImages],
                audio: currentAudio,
                coords: currentCoords ? { ...currentCoords } : entries[entryIndex].coords,
                mood: moodData
            };
        }
    } else {
        const entry = {
            id: Date.now(),
            timestamp: timestamp,
            note: note,
            location: document.getElementById('location-input').value,
            weather: document.getElementById('weather-input').value,
            images: [...currentImages],
            audio: currentAudio,
            coords: currentCoords ? { ...currentCoords } : null,
            mood: moodData
        };
        entries.unshift(entry);
    }

    saveData();
    renderTimeline();
    toggleForm();
}

function editEntry(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    if (entry.isTimedActivity) {
        editTimeEvent(entry);
        return;
    }
    
    if (entry.isQuickTrack) {
        editTrackEvent(entry);
        return;
    }
    
    if (entry.isSpent) {
        editSpentEvent(entry);
        return;
    }

    editingEntryId = id;
    document.getElementById('note-input').value = entry.note;
    document.getElementById('location-input').value = entry.location || '';
    document.getElementById('weather-input').value = entry.weather || '';
    currentImages = [...(entry.images || [])];
    currentAudio = entry.audio || null;
    currentCoords = entry.coords ? { ...entry.coords } : null;

    // Set datetime
    const date = new Date(entry.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    document.getElementById('datetime-input').value = `${year}-${month}-${day}T${hours}:${minutes}`;

    if (entry.mood) {
        const moodIndex = moods.findIndex(m => m.emoji === entry.mood.emoji && m.label === entry.mood.label);
        selectedMood = moodIndex !== -1 ? moodIndex : null;
    } else {
        selectedMood = null;
    }

    renderImagePreviews();
    renderAudioPreview();
    renderMoodSelector();

    if (entry.coords) {
        showMiniMap(entry.coords.lat, entry.coords.lon, 'form-map');
    }

    document.getElementById('delete-btn').classList.remove('hidden');
    document.getElementById('save-btn').textContent = '💾 Update';
    
    const formWindow = document.getElementById('form-window');
    formWindow.classList.remove('hidden');
    formWindow.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Time Event functions
function editTimeEvent(entry) {
    editingEntryId = entry.id;
    
    selectedDuration = entry.duration;
    selectedActivity = entry.activity;
    
    // Set datetime
    const date = new Date(entry.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    document.getElementById('datetime-input-time').value = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    document.querySelectorAll('.duration-option').forEach(el => {
        el.classList.remove('selected');
        const text = el.textContent.trim();
        if ((selectedDuration === 15 && text.includes('15')) ||
            (selectedDuration === 30 && text.includes('30')) ||
            (selectedDuration === 60 && text.includes('1 hour')) ||
            (selectedDuration === 120 && text.includes('2')) ||
            (selectedDuration === 180 && text.includes('3'))) {
            el.classList.add('selected');
        }
    });
    
    document.querySelectorAll('#activity-selector .activity-option').forEach(el => {
        el.classList.remove('selected');
        if (el.textContent.includes(selectedActivity)) {
            el.classList.add('selected');
        }
    });
    
    checkTimerReady();
    
    const timerWindow = document.getElementById('timer-window');
    const createBtn = document.getElementById('create-time-btn');
    createBtn.textContent = '💾 Update Event';
    document.getElementById('delete-time-btn').classList.remove('hidden');
    
    timerWindow.classList.remove('hidden');
    timerWindow.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectDuration(minutes) {
    selectedDuration = minutes;
    const options = document.querySelectorAll('.duration-option');
    options.forEach(el => {
        el.classList.remove('selected');
        const text = el.textContent.trim();
        if ((minutes === 15 && text.includes('15')) ||
            (minutes === 30 && text.includes('30')) ||
            (minutes === 60 && text.includes('1 hour')) ||
            (minutes === 120 && text.includes('2')) ||
            (minutes === 180 && text.includes('3'))) {
            el.classList.add('selected');
        }
    });
    
    checkTimerReady();
}

function selectActivity(activity) {
    selectedActivity = activity;
    const options = document.querySelectorAll('#activity-selector .activity-option');
    options.forEach(el => {
        el.classList.remove('selected');
        if (el.textContent.includes(activity)) {
            el.classList.add('selected');
        }
    });
    
    checkTimerReady();
}

function checkTimerReady() {
    const createBtn = document.getElementById('create-time-btn');
    if (selectedDuration && selectedActivity) {
        createBtn.disabled = false;
    } else {
        createBtn.disabled = true;
    }
}

function createTimeEvent() {
    if (!selectedDuration || !selectedActivity) return;
    
    const timestamp = getTimestampFromInput('datetime-input-time');
    const optionalNote = document.getElementById('time-optional-note').value.trim();
    
    if (editingEntryId) {
        const entryIndex = entries.findIndex(e => e.id === editingEntryId);
        if (entryIndex !== -1) {
            entries[entryIndex] = {
                ...entries[entryIndex],
                timestamp: timestamp,
                note: `${selectedActivity} - ${selectedDuration} minutes`,
                activity: selectedActivity,
                duration: selectedDuration,
                optionalNote: optionalNote
            };
        }
        editingEntryId = null;
    } else {
        const entry = {
            id: Date.now(),
            timestamp: timestamp,
            note: `${selectedActivity} - ${selectedDuration} minutes`,
            location: '',
            weather: '',
            images: [],
            audio: null,
            coords: null,
            mood: null,
            activity: selectedActivity,
            duration: selectedDuration,
            isTimedActivity: true,
            optionalNote: optionalNote
        };
        
        entries.unshift(entry);
    }
    
    saveData();
    renderTimeline();
    
    alert(`✅ Time event ${editingEntryId ? 'updated' : 'created'}!`);
    toggleTimer();
    
    document.getElementById('create-time-btn').textContent = 'Create Event';
    document.getElementById('delete-time-btn').classList.add('hidden');
    document.getElementById('time-optional-note').value = '';
}

function resetTimerSelections() {
    selectedDuration = null;
    selectedActivity = null;
    editingEntryId = null;
    document.querySelectorAll('.duration-option').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('#activity-selector .activity-option').forEach(el => el.classList.remove('selected'));
    document.getElementById('create-time-btn').disabled = true;
    document.getElementById('create-time-btn').textContent = 'Create Event';
    document.getElementById('delete-time-btn').classList.add('hidden');
    document.getElementById('time-optional-note').value = '';
}

// Track Event functions
function renderTrackSelector() {
    const container = document.getElementById('track-selector');
    const allItems = [...trackItems.meals, ...trackItems.tasks];
    
    container.innerHTML = allItems.map((item, index) => `
        <div class="activity-option" onclick="selectTrackItem('${item}')">
            ${item}
        </div>
    `).join('');
}

function selectTrackItem(item) {
    selectedTrackItem = item;
    document.querySelectorAll('#track-selector .activity-option').forEach(el => {
        el.classList.remove('selected');
        if (el.textContent.trim() === item) {
            el.classList.add('selected');
        }
    });
    document.getElementById('save-track-btn').disabled = false;
}

function editTrackEvent(entry) {
    editingEntryId = entry.id;
    selectedTrackItem = entry.note;
    
    // Set datetime
    const date = new Date(entry.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    document.getElementById('datetime-input-track').value = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    document.getElementById('track-optional-note').value = entry.optionalNote || '';
    
    renderTrackSelector();
    
    document.querySelectorAll('#track-selector .activity-option').forEach(el => {
        if (el.textContent.trim() === selectedTrackItem) {
            el.classList.add('selected');
        }
    });
    
    document.getElementById('save-track-btn').disabled = false;
    document.getElementById('save-track-btn').textContent = '💾 Update Track';
    document.getElementById('delete-track-btn').classList.remove('hidden');
    
    const trackWindow = document.getElementById('track-window');
    trackWindow.classList.remove('hidden');
    trackWindow.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveTrackEvent() {
    if (!selectedTrackItem) return;
    
    const timestamp = getTimestampFromInput('datetime-input-track');
    const optionalNote = document.getElementById('track-optional-note').value.trim();
    
    if (editingEntryId) {
        const entryIndex = entries.findIndex(e => e.id === editingEntryId);
        if (entryIndex !== -1) {
            entries[entryIndex] = {
                ...entries[entryIndex],
                timestamp: timestamp,
                note: selectedTrackItem,
                optionalNote: optionalNote
            };
        }
        editingEntryId = null;
        alert(`✅ Track updated: ${selectedTrackItem}`);
    } else {
        const entry = {
            id: Date.now(),
            timestamp: timestamp,
            note: selectedTrackItem,
            location: '',
            weather: '',
            images: [],
            audio: null,
            coords: null,
            mood: null,
            isQuickTrack: true,
            optionalNote: optionalNote
        };
        
        entries.unshift(entry);
        alert(`✅ Tracked: ${selectedTrackItem}`);
    }
    
    saveData();
    renderTimeline();
    toggleTrack();
    
    document.getElementById('save-track-btn').textContent = 'Save Track';
    document.getElementById('delete-track-btn').classList.add('hidden');
}

// Spent Event functions
function editSpentEvent(entry) {
    editingEntryId = entry.id;
    
    document.getElementById('spent-description').value = entry.note;
    document.getElementById('spent-amount').value = entry.spentAmount;
    
    // Set datetime
    const date = new Date(entry.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    document.getElementById('datetime-input-spent').value = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    document.getElementById('delete-spent-btn').classList.remove('hidden');
    
    const spentWindow = document.getElementById('spent-window');
    spentWindow.classList.remove('hidden');
    spentWindow.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveSpent() {
    const description = document.getElementById('spent-description').value.trim();
    const amount = parseFloat(document.getElementById('spent-amount').value);

    if (!description) {
        alert('Please enter a description');
        return;
    }

    if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }

    const timestamp = getTimestampFromInput('datetime-input-spent');

    if (editingEntryId) {
        const entryIndex = entries.findIndex(e => e.id === editingEntryId);
        if (entryIndex !== -1) {
            entries[entryIndex] = {
                ...entries[entryIndex],
                timestamp: timestamp,
                note: description,
                spentAmount: amount
            };
        }
        editingEntryId = null;
        alert(`✅ Spent updated: €${amount.toFixed(2)}`);
    } else {
        const entry = {
            id: Date.now(),
            timestamp: timestamp,
            note: description,
            location: '',
            weather: '',
            images: [],
            audio: null,
            coords: null,
            mood: null,
            spentAmount: amount,
            isSpent: true
        };
        
        entries.unshift(entry);
        alert(`✅ Spent tracked: €${amount.toFixed(2)}`);
    }
    
    saveData();
    renderTimeline();
    toggleSpent();
    document.getElementById('delete-spent-btn').classList.add('hidden');
}

// Delete entry
function deleteCurrentEntry() {
    if (!editingEntryId) return;
    
    if (confirm('Delete this entry?')) {
        entries = entries.filter(e => e.id !== editingEntryId);
        
        if (currentUser && !isOfflineMode) {
            deleteEntryFromFirebase(editingEntryId);
        }
        
        saveData();
        renderTimeline();
        
        // Close all windows
        document.getElementById('form-window').classList.add('hidden');
        document.getElementById('timer-window').classList.add('hidden');
        document.getElementById('track-window').classList.add('hidden');
        document.getElementById('spent-window').classList.add('hidden');
        
        editingEntryId = null;
    }
}
// Preview functions
function previewEntry(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    const modal = document.getElementById('preview-modal');
    const body = document.getElementById('preview-body');
    
    let html = `
        <div style="margin-bottom: 16px;">
            <strong>Time:</strong> ${formatDate(entry.timestamp)} at ${formatTime(entry.timestamp)}
        </div>
        
        ${entry.mood ? `
            <div style="margin-bottom: 16px;">
                <strong>Mood:</strong> <span style="font-size: 24px;">${entry.mood.emoji}</span> ${entry.mood.label}
            </div>
        ` : ''}
        
        <div style="margin-bottom: 16px;">
            <strong>Note:</strong>
            <div style="margin-top: 8px; line-height: 1.6;">${entry.note}</div>
        </div>
        
        ${entry.location ? `
            <div style="margin-bottom: 16px;">
                <strong>Location:</strong> ${entry.location}
            </div>
        ` : ''}
        
        ${entry.weather ? `
            <div style="margin-bottom: 16px;">
                <strong>Weather:</strong> ${entry.weather}
            </div>
        ` : ''}
        
        ${entry.coords ? `
            <div style="margin-bottom: 16px;">
                <strong>Map:</strong>
                <div class="preview-map-full" id="preview-map-modal"></div>
            </div>
        ` : ''}
        
        ${entry.audio ? `
            <div style="margin-bottom: 16px;">
                <strong>Audio:</strong>
                <audio controls style="width: 100%; margin-top: 8px;">
                    <source src="${entry.audio}" type="audio/webm">
                </audio>
            </div>
        ` : ''}
        
        ${entry.images && entry.images.length > 0 ? `
            <div style="margin-bottom: 16px;">
                <strong>Images:</strong>
                <div class="preview-images-full">
                    ${entry.images.map(img => `
                        <img src="${img}" class="preview-image-full" onclick="event.stopPropagation(); showImageInModal('${entry.id}', ${entry.images.indexOf(img)});">
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        ${entry.isTimedActivity ? `
            <div style="margin-bottom: 16px;">
                <strong>Activity:</strong> ${entry.activity} (${entry.duration} minutes)
            </div>
        ` : ''}
        
        ${entry.isSpent ? `
            <div style="margin-bottom: 16px;">
                <strong>Amount Spent:</strong> €${entry.spentAmount.toFixed(2)}
            </div>
        ` : ''}
    `;
    
    body.innerHTML = html;
    modal.classList.add('show');
    
    if (entry.coords) {
        setTimeout(() => {
            const mapContainer = document.getElementById('preview-map-modal');
            if (mapContainer) {
                const map = L.map('preview-map-modal').setView([entry.coords.lat, entry.coords.lon], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(map);
                L.marker([entry.coords.lat, entry.coords.lon]).addTo(map);
                
                setTimeout(() => map.invalidateSize(), 100);
            }
        }, 100);
    }
}

function closePreview(event) {
    if (event && event.target.id !== 'preview-modal') return;
    const modal = document.getElementById('preview-modal');
    modal.classList.remove('show');
    document.getElementById('preview-body').innerHTML = '';
}

// Settings functions
function openSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.add('show');
    renderSettingsConfig();
}

// Show image preview
function showImagePreview(entryId, imageIndex) {
    const entry = entries.find(e => e.id == entryId);
    if (!entry || !entry.images || !entry.images[imageIndex]) {
        console.error('Image not found:', entryId, imageIndex);
        return;
    }
    
    const modal = document.getElementById('preview-modal');
    const body = document.getElementById('preview-body');
    
    body.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <img src="${entry.images[imageIndex]}" style="max-width: 100%; max-height: 80vh; border: 2px solid #000;">
        </div>
    `;
    
    modal.classList.add('show');
}


function closeSettings(event) {
    if (event && event.target.id !== 'settings-modal') return;
    const modal = document.getElementById('settings-modal');
    modal.classList.remove('show');
}

function renderSettingsConfig() {
    const durationsContainer = document.getElementById('time-durations-config');
    durationsContainer.innerHTML = timeDurations.map((duration, index) => `
        <div class="config-item">
            <input type="number" value="${duration}" id="duration-${index}" style="flex: 0 0 100px;">
            <span>minutes</span>
            <button class="mac-button" onclick="removeDuration(${index})" style="padding: 4px 8px; margin-left: auto;">✕</button>
        </div>
    `).join('') + `
        <button class="mac-button" onclick="addDuration()" style="margin-top: 8px;">➕ Add Duration</button>
    `;

    const activitiesContainer = document.getElementById('time-activities-config');
    activitiesContainer.innerHTML = timeActivities.map((activity, index) => `
        <div class="config-item">
            <input type="text" value="${activity}" id="activity-${index}">
            <button class="mac-button" onclick="removeActivity(${index})" style="padding: 4px 8px;">✕</button>
        </div>
    `).join('') + `
        <button class="mac-button" onclick="addActivity()" style="margin-top: 8px;">➕ Add Activity</button>
    `;

    const trackContainer = document.getElementById('track-items-config');
    trackContainer.innerHTML = `
        <div style="margin-bottom: 16px;">
            <strong>Meals:</strong>
            ${trackItems.meals.map((item, index) => `
                <div class="config-item">
                    <input type="text" value="${item}" id="meal-${index}">
                    <button class="mac-button" onclick="removeMeal(${index})" style="padding: 4px 8px;">✕</button>
                </div>
            `).join('')}
            <button class="mac-button" onclick="addMeal()" style="margin-top: 8px;">➕ Add Meal</button>
        </div>
        <div>
            <strong>Tasks:</strong>
            ${trackItems.tasks.map((item, index) => `
                <div class="config-item">
                    <input type="text" value="${item}" id="task-${index}">
                    <button class="mac-button" onclick="removeTask(${index})" style="padding: 4px 8px;">✕</button>
                </div>
            `).join('')}
            <button class="mac-button" onclick="addTask()" style="margin-top: 8px;">➕ Add Task</button>
        </div>
    `;
}

function addDuration() {
    timeDurations.push(60);
    renderSettingsConfig();
}

function removeDuration(index) {
    timeDurations.splice(index, 1);
    renderSettingsConfig();
}

function addActivity() {
    timeActivities.push('New Activity');
    renderSettingsConfig();
}

function removeActivity(index) {
    timeActivities.splice(index, 1);
    renderSettingsConfig();
}

function addMeal() {
    trackItems.meals.push('🍴 New Meal');
    renderSettingsConfig();
}

function removeMeal(index) {
    trackItems.meals.splice(index, 1);
    renderSettingsConfig();
}

function addTask() {
    trackItems.tasks.push('✓ New Task');
    renderSettingsConfig();
}

function removeTask(index) {
    trackItems.tasks.splice(index, 1);
    renderSettingsConfig();
}

function saveSettings() {
    timeDurations = timeDurations.map((_, index) => {
        const val = document.getElementById(`duration-${index}`);
        return val ? parseInt(val.value) || 60 : 60;
    });

    timeActivities = timeActivities.map((_, index) => {
        const val = document.getElementById(`activity-${index}`);
        return val ? val.value : 'Activity';
    });

    trackItems.meals = trackItems.meals.map((_, index) => {
        const val = document.getElementById(`meal-${index}`);
        return val ? val.value : 'Meal';
    });

    trackItems.tasks = trackItems.tasks.map((_, index) => {
        const val = document.getElementById(`task-${index}`);
        return val ? val.value : 'Task';
    });

    saveSettingsToStorage();
    
    if (currentUser && !isOfflineMode) {
        saveSettingsToFirebase();
    }
    
    updateTimerOptions();
    updateTrackOptions();
    closeSettings();
    alert('✅ Settings saved!');
}

function updateTimerOptions() {
    const container = document.getElementById('duration-selector');
    if (!container) return;
    
    container.innerHTML = timeDurations.map(duration => `
        <div class="duration-option" onclick="selectDuration(${duration})">
            ${duration < 60 ? duration + ' min' : (duration / 60) + ' hour' + (duration > 60 ? 's' : '')}
        </div>
    `).join('');

    const actContainer = document.getElementById('activity-selector');
    if (!actContainer) return;
    
    actContainer.innerHTML = timeActivities.map(activity => `
        <div class="activity-option" onclick="selectActivity('${activity}')">
            ${activity}
        </div>
    `).join('');
}

function updateTrackOptions() {
    renderTrackSelector();
}

// Timeline rendering
function toggleReadMore(id) {
    const noteEl = document.getElementById(`note-${id}`);
    const btnEl = document.getElementById(`read-more-${id}`);
    
    if (noteEl.classList.contains('expanded')) {
        noteEl.classList.remove('expanded');
        btnEl.textContent = 'Read more';
    } else {
        noteEl.classList.add('expanded');
        btnEl.textContent = 'Show less';
    }
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en', { 
        weekday: 'long',
        day: 'numeric', 
        month: 'long', 
        year: 'numeric'
    });
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function calculateEndTime(timestamp, durationMinutes) {
    const date = new Date(timestamp);
    date.setMinutes(date.getMinutes() + durationMinutes);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getDayKey(timestamp) {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0];
}

function toggleDay(dayKey) {
    const content = document.getElementById(`day-content-${dayKey}`);
    const chevron = document.getElementById(`chevron-${dayKey}`);
    
    content.classList.toggle('expanded');
    chevron.classList.toggle('expanded');
}


// Show image in modal
function showImageInModal(entryId, imageIndex) {
    const entry = entries.find(e => e.id == entryId);
    if (!entry || !entry.images || !entry.images[imageIndex]) {
        console.error('Image not found');
        return;
    }
    
    const modal = document.getElementById('preview-modal');
    const body = document.getElementById('preview-body');
    
    body.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <img src="${entry.images[imageIndex]}" style="max-width: 100%; max-height: 80vh; border: 2px solid #000;">
        </div>
    `;
    
    modal.classList.add('show');
}


// Toggle note expansion
function toggleNote(entryId) {
    const noteDiv = document.getElementById('note-' + entryId);
    const btn = event.target;
    
    if (noteDiv) {
        if (noteDiv.classList.contains('expanded')) {
            noteDiv.classList.remove('expanded');
            btn.textContent = 'Read more';
        } else {
            noteDiv.classList.add('expanded');
            btn.textContent = 'Read less';
        }
    }
}

function renderTimeline() {
    const container = document.getElementById('timeline-container');
    const emptyState = document.getElementById('empty-state');
    const footer = document.getElementById('footer');

    if (entries.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        footer.style.display = 'none';
        return;
    }

    emptyState.classList.add('hidden');
    footer.style.display = 'flex';

    const groupedByDay = {};
    entries.forEach(entry => {
        const dayKey = getDayKey(entry.timestamp);
        if (!groupedByDay[dayKey]) {
            groupedByDay[dayKey] = [];
        }
        groupedByDay[dayKey].push(entry);
    });

    const html = `
        <div class="timeline">
            <div class="timeline-line"></div>
            ${Object.keys(groupedByDay).map(dayKey => {
                const dayEntries = groupedByDay[dayKey];
                const firstEntry = dayEntries[0];
                
                return `
                    <div class="day-block">
                        <div class="day-header" onclick="toggleDay('${dayKey}')">
                            <span>${formatDate(firstEntry.timestamp)}</span>
                            <span class="chevron" id="chevron-${dayKey}">▼</span>
                        </div>
                        <div class="day-content" id="day-content-${dayKey}">
                            ${dayEntries.map(entry => {
                                const heightStyle = entry.isTimedActivity && entry.duration ? `min-height: ${Math.min(150 + entry.duration * 0.5, 300)}px;` : '';
                                const trackClass = entry.isQuickTrack ? 'track-event' : '';
                                const spentClass = entry.isSpent ? 'spent-event' : '';
                                
                                return `
                                <div class="breadcrumb-entry ${entry.isTimedActivity ? 'edit-mode' : ''} ${trackClass} ${spentClass}" style="${heightStyle}">
                                    <button class="mac-button edit-button" onclick="editEntry(${entry.id})">✏️ Edit</button>
                                    
                                    ${entry.isTimedActivity ? 
                                        `<div class="breadcrumb-time">⏰ ${formatTime(entry.timestamp)} - ${calculateEndTime(entry.timestamp, entry.duration)}</div>
                                        <div class="activity-label">${entry.activity}</div>
                                        <div style="font-size: 13px; color: #666; margin-top: 8px;">Duration: ${entry.duration} minutes</div>
                                        ${entry.optionalNote ? `
                                            <div class="optional-note" id="note-${entry.id}">${entry.optionalNote}</div>
                                            ${entry.optionalNote.length > 200 ? `<button class="read-more-btn" id="read-more-${entry.id}" onclick="toggleReadMore(${entry.id})">Read more</button>` : ''}
                                        ` : ''}` :
                                        `<div class="breadcrumb-time">
                                            ${entry.isQuickTrack ?
                                                `<span class="compact-time">⏰ ${formatTime(entry.timestamp)} ${entry.note}</span>` :
                                                `⏰ ${formatTime(entry.timestamp)}`
                                            }
                                            ${entry.isSpent ? `<span class="spent-badge">💰 €${entry.spentAmount.toFixed(2)}</span>` : ''}
                                        </div>`
                                    }
                                    
                                    ${entry.isTimedActivity ? '' : ''}
                                    ${entry.isQuickTrack && entry.optionalNote ? `
                                        <div class="optional-note" id="note-${entry.id}">${entry.optionalNote}</div>
                                        ${entry.optionalNote.length > 200 ? `<button class="read-more-btn" id="read-more-${entry.id}" onclick="toggleReadMore(${entry.id})">Read more</button>` : ''}
                                    ` : ''}
                                    
                                    ${!entry.isTimedActivity && !entry.isQuickTrack ? `
                                        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
                                            ${entry.mood ? `<span class="mood-display">${entry.mood.emoji}</span>` : ''}
                                            <div style="flex: 1;">
                                                <div class="breadcrumb-note" id="note-${entry.id}">${entry.note}</div>
                                                ${entry.note && entry.note.length > 200 ? `<button class="read-more-btn" id="read-more-${entry.id}" onclick="toggleReadMore(${entry.id})">Read more</button>` : ''}
                                            </div>
                                        </div>
                                    ` : ''}
                                    
                                    ${entry.weather || entry.location ? `
                                        <div style="font-size: 12px; color: ${entry.isQuickTrack ? '#ccc' : '#666'}; margin-bottom: 8px;">
                                            ${entry.weather ? `${entry.weather}` : ''}
                                            ${entry.weather && entry.location && entry.location.length < 20 ? ` • 📍 ${entry.location}` : ''}
                                            ${!entry.weather && entry.location ? `📍 ${entry.location}` : ''}
                                        </div>
                                    ` : ''}
                                    
                                    ${entry.audio ? `
                                        <div style="margin-top: 12px; margin-bottom: 12px;">
                                            <audio controls style="width: 100%; max-width: 300px;">
                                                <source src="${entry.audio}" type="audio/webm">
                                            </audio>
                                        </div>
                                    ` : ''}
                                    
                                    <div class="breadcrumb-preview">
                                        ${entry.images && entry.images.length > 0 ? entry.images.map(img => `
                                            <img src="${img}" class="preview-image-thumb" onclick="event.stopPropagation(); showImageInModal('${entry.id}', ${entry.images.indexOf(img)});">
                                        `).join('') : ''}
                                        ${entry.coords ? `<div class="preview-map-thumb" id="mini-map-${entry.id}"></div>` : ''}
                                        ${(entry.images && entry.images.length > 0) || entry.coords || entry.audio ? `
                                            <button class="mac-button preview-button" onclick="previewEntry(${entry.id})">🔍</button>
                                        ` : ''}
                                    </div>
                                </div>
                            `}).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    container.innerHTML = html;
    
    entries.forEach(entry => {
        if (entry.coords) {
            setTimeout(() => {
                const mapEl = document.getElementById(`mini-map-${entry.id}`);
                if (mapEl && !mapEl.classList.contains('leaflet-container')) {
                    try {
                        const miniMap = L.map(`mini-map-${entry.id}`, {
                            zoomControl: false,
                            attributionControl: false,
                            dragging: false,
                            scrollWheelZoom: false,
                            doubleClickZoom: false,
                            boxZoom: false,
                            keyboard: false
                        }).setView([entry.coords.lat, entry.coords.lon], 13);
                        
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            maxZoom: 19
                        }).addTo(miniMap);
                        
                        L.marker([entry.coords.lat, entry.coords.lon]).addTo(miniMap);
                        
                        mapEl.style.cursor = 'pointer';
                        mapEl.onclick = () => previewEntry(entry.id);
                    } catch (e) {
                        console.error('Error creating mini map:', e);
                    }
                }
            }, 100);
        }
    });
}

// Export functions
function exportCSV() {
    openExportModal('csv');
}

function exportICS() {
    openExportModal('ical');
}

function openExportModal(format) {
    const modal = document.getElementById('export-modal');
    if (!modal) {
        createExportModal();
    }
    
    // Configurar el modal según el formato
    document.getElementById('export-format-type').textContent = format === 'csv' ? 'CSV' : 'iCal';
    document.getElementById('export-modal').classList.add('show');
}

function createExportModal() {
    const modalHTML = `
        <div id="export-modal" class="preview-modal" onclick="closeExportModal(event)">
            <div class="preview-content" onclick="event.stopPropagation()">
                <div class="mac-title-bar">
                    <span>📤 Export <span id="export-format-type">CSV</span></span>
                    <button onclick="closeExportModal()" style="background: #fff; border: 2px solid #000; padding: 2px 8px; cursor: pointer;">✕</button>
                </div>
                <div class="mac-content">
                    <h3 style="margin-bottom: 16px;">Select Export Range</h3>
                    
                    <div style="margin-bottom: 20px;">
                        <label class="mac-label">
                            <input type="radio" name="export-range" value="all" checked onchange="updateExportOptions()"> 
                            Export All Entries
                        </label>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label class="mac-label">
                            <input type="radio" name="export-range" value="month" onchange="updateExportOptions()"> 
                            Export Specific Month
                        </label>
                        <div id="month-selector" style="margin-left: 20px; margin-top: 8px; display: none;">
                            <input type="month" class="mac-input" id="export-month" style="max-width: 200px;">
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label class="mac-label">
                            <input type="radio" name="export-range" value="day" onchange="updateExportOptions()"> 
                            Export Specific Day
                        </label>
                        <div id="day-selector" style="margin-left: 20px; margin-top: 8px; display: none;">
                            <input type="date" class="mac-input" id="export-day" style="max-width: 200px;">
                        </div>
                    </div>
                    
                    <hr style="margin: 20px 0; border: 1px solid #ddd;">
                    
                    <h3 style="margin-bottom: 16px;">iCal Options (Only for iCal export)</h3>
                    
                    <div style="margin-bottom: 20px;">
                        <label class="mac-label">
                            <input type="radio" name="ical-grouping" value="individual" checked> 
                            Each event as separate calendar entry
                        </label>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label class="mac-label">
                            <input type="radio" name="ical-grouping" value="daily"> 
                            Group all events per day as one calendar entry
                        </label>
                    </div>
                    
                    <button class="mac-button mac-button-primary" onclick="performExport()" style="width: 100%; margin-top: 24px;">
                        📥 Export
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Establecer fechas por defecto
    const today = new Date();
    const monthInput = document.getElementById('export-month');
    const dayInput = document.getElementById('export-day');
    
    monthInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    dayInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function updateExportOptions() {
    const range = document.querySelector('input[name="export-range"]:checked').value;
    
    document.getElementById('month-selector').style.display = range === 'month' ? 'block' : 'none';
    document.getElementById('day-selector').style.display = range === 'day' ? 'block' : 'none';
}

function closeExportModal(event) {
    if (event && event.target.id !== 'export-modal') return;
    const modal = document.getElementById('export-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function performExport() {
    const format = document.getElementById('export-format-type').textContent.toLowerCase();
    const range = document.querySelector('input[name="export-range"]:checked').value;
    const icalGrouping = document.querySelector('input[name="ical-grouping"]:checked').value;
    
    // Filtrar entradas según el rango seleccionado
    let filteredEntries = [...entries];
    let filenameSuffix = 'all';
    
    if (range === 'month') {
        const monthValue = document.getElementById('export-month').value;
        const [year, month] = monthValue.split('-');
        filteredEntries = entries.filter(e => {
            const date = new Date(e.timestamp);
            return date.getFullYear() === parseInt(year) && 
                   date.getMonth() + 1 === parseInt(month);
        });
        filenameSuffix = `${year}-${month}`;
    } else if (range === 'day') {
        const dayValue = document.getElementById('export-day').value;
        filteredEntries = entries.filter(e => {
            const date = new Date(e.timestamp);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return dateStr === dayValue;
        });
        filenameSuffix = dayValue;
    }
    
    if (filteredEntries.length === 0) {
        alert('No entries found for the selected period.');
        return;
    }
    
    // Realizar la exportación
    if (format === 'csv') {
        exportCSVData(filteredEntries, filenameSuffix);
    } else {
        exportICSData(filteredEntries, filenameSuffix, icalGrouping);
    }
    
    closeExportModal();
}

function exportCSVData(data, suffix) {
    const headers = ['Date and Time', 'Note', 'Activity', 'Duration (min)', 'Location', 'Weather', 'Mood', 'Spent', 'Images'];
    const rows = data.map(e => [
        new Date(e.timestamp).toLocaleString(),
        e.note || '',
        e.activity || '',
        e.duration || '',
        e.location || '',
        e.weather || '',
        e.mood ? `${e.mood.emoji} ${e.mood.label}` : '',
        e.spentAmount ? `€${e.spentAmount}` : '',
        e.images ? e.images.length : 0
    ]);
    
    const csv = [headers, ...rows].map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `breadcrumbs-${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportICSData(data, suffix, grouping) {
    let icsEvents = '';
    
    if (grouping === 'daily') {
        // Agrupar por día
        const groupedByDay = {};
        data.forEach(e => {
            const date = new Date(e.timestamp);
            const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            if (!groupedByDay[dayKey]) {
                groupedByDay[dayKey] = [];
            }
            groupedByDay[dayKey].push(e);
        });
        
        // Crear un evento por día
        icsEvents = Object.keys(groupedByDay).map(dayKey => {
            const dayEntries = groupedByDay[dayKey];
            const firstEntry = dayEntries[0];
            const date = new Date(firstEntry.timestamp);
            const dateStr = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            
            // Crear descripción con todos los eventos del día
            const description = dayEntries.map(e => {
                const time = new Date(e.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                let text = `${time}: ${e.note || e.activity || 'Event'}`;
                if (e.duration) text += ` (${e.duration} min)`;
                return text;
            }).join('\\n');
            
            return `BEGIN:VEVENT
UID:${dayKey}@breadcrumbs
DTSTAMP:${dateStr}
DTSTART;VALUE=DATE:${dayKey.replace(/-/g, '')}
SUMMARY:Breadcrumbs - ${dayEntries.length} events
DESCRIPTION:${description.replace(/\n/g, '\\n')}
END:VEVENT`;
        }).join('\n');
    } else {
        // Evento individual por cada entrada
        icsEvents = data.map(e => {
            const date = new Date(e.timestamp);
            const dateStr = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            
            let endDate = new Date(date);
            if (e.duration) {
                endDate.setMinutes(endDate.getMinutes() + e.duration);
            } else {
                endDate.setMinutes(endDate.getMinutes() + 30); // 30 min por defecto
            }
            const endDateStr = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            
            const summary = e.activity || e.note?.substring(0, 50) || 'Breadcrumb Event';
            const description = (e.note || '') + (e.location ? `\\nLocation: ${e.location}` : '') + (e.weather ? `\\nWeather: ${e.weather}` : '');
            
            return `BEGIN:VEVENT
UID:${e.id}@breadcrumbs
DTSTAMP:${dateStr}
DTSTART:${dateStr}
DTEND:${endDateStr}
SUMMARY:${summary.replace(/\n/g, ' ')}
DESCRIPTION:${description.replace(/\n/g, '\\n')}
LOCATION:${e.location || ''}
END:VEVENT`;
        }).join('\n');
    }

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Breadcrumbs Timeline//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH
${icsEvents}
END:VCALENDAR`;

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `breadcrumbs-${suffix}.ics`;
    a.click();
    URL.revokeObjectURL(url);
}

// Stats functions
function openStats() {
    calculateStats();
    const modal = document.getElementById('stats-modal');
    if (modal) {
        modal.classList.add('show');
    }
}

function calculateStats() {
    const totalEntries = entries.length;
    const breadcrumbs = entries.filter(e => !e.isTimedActivity && !e.isQuickTrack && !e.isSpent).length;
    const timeEvents = entries.filter(e => e.isTimedActivity).length;
    const trackEvents = entries.filter(e => e.isQuickTrack).length;
    const spentEvents = entries.filter(e => e.isSpent).length;
    
    const totalSpent = entries
        .filter(e => e.isSpent)
        .reduce((sum, e) => sum + (e.spentAmount || 0), 0);
    
    const totalMinutes = entries
        .filter(e => e.isTimedActivity)
        .reduce((sum, e) => sum + (e.duration || 0), 0);
    
    const totalHours = (totalMinutes / 60).toFixed(1);
    
    // Actividades más frecuentes
    const activityCount = {};
    entries.filter(e => e.isTimedActivity).forEach(e => {
        activityCount[e.activity] = (activityCount[e.activity] || 0) + 1;
    });
    const topActivity = Object.keys(activityCount).length > 0 
        ? Object.keys(activityCount).reduce((a, b) => activityCount[a] > activityCount[b] ? a : b)
        : 'None';
    
    // Tracks más frecuentes
    const trackCount = {};
    entries.filter(e => e.isQuickTrack).forEach(e => {
        trackCount[e.note] = (trackCount[e.note] || 0) + 1;
    });
    const topTrack = Object.keys(trackCount).length > 0
        ? Object.keys(trackCount).reduce((a, b) => trackCount[a] > trackCount[b] ? a : b)
        : 'None';
    
    const statsHTML = `
        <div class="stat-card">
            <div class="stat-number">${totalEntries}</div>
            <div class="stat-label">Total Entries</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${breadcrumbs}</div>
            <div class="stat-label">📝 Breadcrumbs</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${timeEvents}</div>
            <div class="stat-label">⏱️ Time Events</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${trackEvents}</div>
            <div class="stat-label">📊 Tracked Items</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${spentEvents}</div>
            <div class="stat-label">💰 Expenses</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">€${totalSpent.toFixed(2)}</div>
            <div class="stat-label">Total Spent</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${totalHours}h</div>
            <div class="stat-label">Hours Tracked</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" style="font-size: 18px;">${topActivity}</div>
            <div class="stat-label">Top Activity</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" style="font-size: 16px;">${topTrack}</div>
            <div class="stat-label">Most Tracked</div>
        </div>
    `;
    
    document.getElementById('stats-content').innerHTML = statsHTML;
}

function closeStats(event) {
    if (event && event.target.id !== 'stats-modal') return;
    const modal = document.getElementById('stats-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}
// Initialize app
loadData();
loadSettings();

// ===== RECAP FUNCTIONS =====

function showRecapForm() {
    // Ocultar otros formularios
    ['crumb-form', 'time-form', 'track-form', 'spent-form'].forEach(id => {
        const form = document.getElementById(id);
        if (form) form.classList.add('hidden');
    });
    
    document.getElementById('recap-form').classList.remove('hidden');
    
    // Listener para el slider
    const slider = document.getElementById('recap-rating');
    const valueDisplay = document.getElementById('recap-rating-value');
    
    slider.oninput = function() {
        valueDisplay.textContent = this.value;
    };
}

function closeRecapForm() {
    document.getElementById('recap-form').classList.add('hidden');
    // Limpiar formulario
    document.getElementById('recap-reflection').value = '';
    document.getElementById('recap-rating').value = '5';
    document.getElementById('recap-rating-value').textContent = '5';
    document.getElementById('recap-highlight-1').value = '';
    document.getElementById('recap-highlight-2').value = '';
    document.getElementById('recap-highlight-3').value = '';
    document.getElementById('recap-bso').value = '';
    document.getElementById('recap-bso-results').innerHTML = '';
    document.getElementById('recap-selected-track').value = '';
}

async function buscarBSO() {
    const query = document.getElementById('recap-bso').value.trim();
    if (!query) {
        alert('Please enter a song or artist name');
        return;
    }
    
    const resultsDiv = document.getElementById('recap-bso-results');
    resultsDiv.innerHTML = '<div style="padding: 12px; text-align: center;">Searching...</div>';
    
    try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const html = data.results.map(track => `
                <div class="bso-result" style="display: flex; align-items: center; gap: 12px; padding: 8px; border: 2px solid #999; margin-bottom: 8px; cursor: pointer; background: white;" onclick="selectTrack('${track.trackName.replace(/'/g, "\'")}', '${track.artistName.replace(/'/g, "\'")}', '${track.trackViewUrl}', '${track.artworkUrl100}')">
                    <img src="${track.artworkUrl100}" style="width: 50px; height: 50px; border: 2px solid #000;">
                    <div style="flex: 1;">
                        <div style="font-weight: bold; font-size: 13px;">${track.trackName}</div>
                        <div style="font-size: 11px; color: #666;">${track.artistName}</div>
                    </div>
                    <div style="font-size: 18px;">▶️</div>
                </div>
            `).join('');
            resultsDiv.innerHTML = html;
        } else {
            resultsDiv.innerHTML = '<div style="padding: 12px; text-align: center; color: #666;">No results found</div>';
        }
    } catch (error) {
        console.error('Error searching BSO:', error);
        resultsDiv.innerHTML = '<div style="padding: 12px; text-align: center; color: red;">Error searching. Try again.</div>';
    }
}

function selectTrack(trackName, artistName, url, artwork) {
    const trackData = {
        name: trackName,
        artist: artistName,
        url: url,
        artwork: artwork
    };
    
    document.getElementById('recap-selected-track').value = JSON.stringify(trackData);
    document.getElementById('recap-bso-results').innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 3px solid #000; background: #f0f0f0;">
            <img src="${artwork}" style="width: 60px; height: 60px; border: 2px solid #000;">
            <div style="flex: 1;">
                <div style="font-weight: bold;">${trackName}</div>
                <div style="font-size: 12px; color: #666;">${artistName}</div>
            </div>
            <a href="${url}" target="_blank" style="text-decoration: none; font-size: 20px;">🔗</a>
        </div>
    `;
}

function saveRecap() {
    const reflection = document.getElementById('recap-reflection').value.trim();
    const rating = document.getElementById('recap-rating').value;
    const highlight1 = document.getElementById('recap-highlight-1').value.trim();
    const highlight2 = document.getElementById('recap-highlight-2').value.trim();
    const highlight3 = document.getElementById('recap-highlight-3').value.trim();
    const selectedTrackJson = document.getElementById('recap-selected-track').value;
    
    if (!reflection && !highlight1 && !highlight2 && !highlight3) {
        alert('Please add at least one reflection or highlight');
        return;
    }
    
    const recap = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: 'recap',
        reflection: reflection,
        rating: parseInt(rating),
        highlights: [highlight1, highlight2, highlight3].filter(h => h),
        track: selectedTrackJson ? JSON.parse(selectedTrackJson) : null
    };
    
    entries.push(recap);
    saveData();
    renderTimeline();
    closeRecapForm();
    
    alert('🌟 Recap saved!');
}

// ===== FAB MENU =====

let fabMenuOpen = false;

function toggleFabMenu() {
    const fabActions = document.querySelectorAll('.fab-action');
    const fabIcon = document.getElementById('fab-icon');
    
    fabMenuOpen = !fabMenuOpen;
    
    if (fabMenuOpen) {
        fabIcon.textContent = '×';
        fabIcon.style.transform = 'rotate(45deg)';
        
        fabActions.forEach((btn, index) => {
            setTimeout(() => {
                btn.classList.remove('hidden');
                setTimeout(() => btn.classList.add('show'), 10);
            }, index * 50);
        });
    } else {
        fabIcon.textContent = '+';
        fabIcon.style.transform = 'rotate(0deg)';
        
        fabActions.forEach((btn, index) => {
            setTimeout(() => {
                btn.classList.remove('show');
                setTimeout(() => btn.classList.add('hidden'), 300);
            }, index * 30);
        });
    }
}

// Cerrar FAB menu al hacer click en una acción
function closeFabMenu() {
    if (fabMenuOpen) {
        toggleFabMenu();
    }
}

// Modificar las funciones toggle para cerrar el menú
const originalToggleCrumb = window.toggleCrumb;
window.toggleCrumb = function() {
    closeFabMenu();
    if (originalToggleCrumb) originalToggleCrumb();
};

const originalToggleTime = window.toggleTime;
window.toggleTime = function() {
    closeFabMenu();
    if (originalToggleTime) originalToggleTime();
};

const originalToggleTrack = window.toggleTrack;
window.toggleTrack = function() {
    closeFabMenu();
    if (originalToggleTrack) originalToggleTrack();
};

const originalToggleSpent = window.toggleSpent;
window.toggleSpent = function() {
    closeFabMenu();
    if (originalToggleSpent) originalToggleSpent();
};

// Agregar para Recap
const originalShowRecapForm = window.showRecapForm;
window.showRecapForm = function() {
    closeFabMenu();
    document.getElementById('recap-form').classList.remove('hidden');
    ['crumb-form', 'time-form', 'track-form', 'spent-form'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });
};

