/* ===============================
   Breadcrumbs Timeline – Main Logic
   =============================== */

// ---------- DOM ELEMENTS ----------
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");

const continueOfflineBtn = document.getElementById("continue-offline");
const loginGoogleBtn = document.getElementById("login-google");
const signoutBtn = document.getElementById("signout-btn");

const addBreadcrumbBtn = document.getElementById("add-breadcrumb");
const timeBtn = document.getElementById("time-btn");
const trackBtn = document.getElementById("track-btn");
const spentBtn = document.getElementById("spent-btn");

const timeline = document.getElementById("timeline");

// Modals
const formModal = document.getElementById("form-modal");
const timeModal = document.getElementById("time-modal");
const trackModal = document.getElementById("track-modal");
const spentModal = document.getElementById("spent-modal");

// Form elements
const moodSelect = document.getElementById("mood-select");
const noteInput = document.getElementById("note-input");
const locationInput = document.getElementById("location-input");
const weatherInput = document.getElementById("weather-input");
const imageInput = document.getElementById("image-input");

const saveEntryBtn = document.getElementById("save-entry");
const cancelEntryBtn = document.getElementById("cancel-entry");

const durationButtons = document.querySelectorAll("#duration-options button");
const activityButtons = document.querySelectorAll("#activity-options button");

const createTimeEventBtn = document.getElementById("create-time-event");
const cancelTimeEventBtn = document.getElementById("cancel-time-event");

const closeTrackBtn = document.getElementById("close-track");

const spentDesc = document.getElementById("spent-desc");
const spentAmount = document.getElementById("spent-amount");
const saveSpentBtn = document.getElementById("save-spent");
const cancelSpentBtn = document.getElementById("cancel-spent");

// ---------- STATE ----------
let entries = JSON.parse(localStorage.getItem("breadcrumbs")) || [];

// ---------- HELPERS ----------
function saveToLocal() {
  localStorage.setItem("breadcrumbs", JSON.stringify(entries));
}

function toggleModal(modal, show = true) {
  modal.classList.toggle("hidden", !show);
}

function clearForm() {
  noteInput.value = "";
  locationInput.value = "";
  weatherInput.value = "";
  imageInput.value = "";
}

function renderTimeline() {
  timeline.innerHTML = "";
  if (entries.length === 0) {
    timeline.innerHTML = `<p class="no-entries">📍 No entries yet<br />Create your first breadcrumb</p>`;
    return;
  }

  entries
    .slice()
    .reverse()
    .forEach((entry) => {
      const div = document.createElement("div");
      div.className = "timeline-entry";

      const meta = `<div class="meta">${new Date(entry.date).toLocaleString()}</div>`;
      const mood = entry.mood ? `<span class="mood">${entry.mood}</span>` : "";
      const note = entry.note
        ? `<div class="note">${escapeHtml(entry.note)}</div>`
        : "";
      const location = entry.location
        ? `<div class="meta">📍 ${escapeHtml(entry.location)}</div>`
        : "";
      const weather = entry.weather
        ? `<div class="meta">☁️ ${escapeHtml(entry.weather)}</div>`
        : "";
      const images = entry.images
        ? entry.images
            .map(
              (src) =>
                `<img src="${src}" style="max-width:100%;border-radius:8px;margin-top:6px;" />`
            )
            .join("")
        : "";

      div.innerHTML = `${mood}${meta}${note}${location}${weather}${images}`;
      timeline.appendChild(div);
    });
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- LOGIN / OFFLINE ----------
continueOfflineBtn.addEventListener("click", () => {
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  renderTimeline();
});

// (Sign-in with Google could be added later with Firebase)
loginGoogleBtn.addEventListener("click", () => {
  alert("Google login not implemented yet – continue offline for now.");
});

// Sign out
signoutBtn.addEventListener("click", () => {
  appScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
});

// ---------- ADD BREADCRUMB ----------
addBreadcrumbBtn.addEventListener("click", () => toggleModal(formModal, true));
cancelEntryBtn.addEventListener("click", () => toggleModal(formModal, false));

saveEntryBtn.addEventListener("click", () => {
  const newEntry = {
    type: "breadcrumb",
    date: new Date().toISOString(),
    mood: moodSelect.value,
    note: noteInput.value,
    location: locationInput.value,
    weather: weatherInput.value,
    images: [],
  };

  // Convert uploaded images to base64
  const files = Array.from(imageInput.files);
  if (files.length > 0) {
    const promises = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(file);
        })
    );
    Promise.all(promises).then((base64Images) => {
      newEntry.images = base64Images;
      entries.push(newEntry);
      saveToLocal();
      renderTimeline();
      clearForm();
      toggleModal(formModal, false);
    });
  } else {
    entries.push(newEntry);
    saveToLocal();
    renderTimeline();
    clearForm();
    toggleModal(formModal, false);
  }
});

// ---------- TIME EVENT ----------
let selectedDuration = null;
let selectedActivity = null;

durationButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedDuration = btn.dataset.min;
    durationButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

activityButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedActivity = btn.textContent.trim();
    activityButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

timeBtn.addEventListener("click", () => toggleModal(timeModal, true));
cancelTimeEventBtn.addEventListener("click", () => toggleModal(timeModal, false));

createTimeEventBtn.addEventListener("click", () => {
  if (!selectedDuration || !selectedActivity) {
    alert("Please select both duration and activity.");
    return;
  }

  const newEvent = {
    type: "time",
    date: new Date().toISOString(),
    duration: selectedDuration,
    activity: selectedActivity,
  };

  entries.push(newEvent);
  saveToLocal();
  renderTimeline();
  toggleModal(timeModal, false);
  selectedDuration = null;
  selectedActivity = null;
});

// ---------- QUICK TRACK ----------
trackBtn.addEventListener("click", () => toggleModal(trackModal, true));
closeTrackBtn.addEventListener("click", () => toggleModal(trackModal, false));

trackModal.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const label = btn.textContent.trim();
    const newTrack = {
      type: "track",
      date: new Date().toISOString(),
      label,
    };
    entries.push(newTrack);
    saveToLocal();
    renderTimeline();
  });
});

// ---------- SPENT ----------
spentBtn.addEventListener("click", () => toggleModal(spentModal, true));
cancelSpentBtn.addEventListener("click", () => toggleModal(spentModal, false));

saveSpentBtn.addEventListener("click", () => {
  const desc = spentDesc.value.trim();
  const amount = parseFloat(spentAmount.value);
  if (!desc || isNaN(amount)) {
    alert("Please enter a valid description and amount.");
    return;
  }

  const newSpent = {
    type: "spent",
    date: new Date().toISOString(),
    desc,
    amount,
  };
  entries.push(newSpent);
  saveToLocal();
  renderTimeline();
  spentDesc.value = "";
  spentAmount.value = "";
  toggleModal(spentModal, false);
});

// ---------- GEOLOCATION ----------
document.getElementById("use-gps").addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation not supported in your browser.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      locationInput.value = `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`;
      const map = L.map(document.createElement("div")).setView([latitude, longitude], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
    },
    () => alert("Unable to get location.")
  );
});

// ---------- INITIALIZE ----------
renderTimeline();
