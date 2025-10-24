// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAb-MLu8atl5hruOPLDhgftjkjc_1M2038",
    authDomain: "breadcrumbs-8b59e.firebaseapp.com",
    projectId: "breadcrumbs-8b59e",
    storageBucket: "breadcrumbs-8b59e.firebasestorage.app",
    messagingSenderId: "912286191427",
    appId: "1:912286191427:web:e78b665df6a6ff6d8529f6",
    measurementId: "G-GZYTDYNSRB"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;
let isOfflineMode = false;

// Auth state observer
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        console.log('Usuario autenticado:', user.email, 'UID:', user.uid);
        showMainApp();
        updateSyncStatus('online');
        // Esperar a que app.js se cargue
        if (typeof loadDataFromFirebase === 'function') {
            loadDataFromFirebase();
        }
        if (typeof loadSettingsFromFirebase === 'function') {
            loadSettingsFromFirebase();
        }
    }
});

// Sign in with Google
function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    
    auth.signInWithPopup(provider)
        .then((result) => {
            console.log('Signed in with Google:', result.user.email);
        })
        .catch((error) => {
            console.error('Google sign-in error:', error);
            alert('Sign in error: ' + error.message);
        });
}

// Sign in with Email/Password
function signInWithEmail() {
    const email = prompt('Enter your email:');
    const password = prompt('Enter your password:');
    
    if (!email || !password) return;
    
    auth.signInWithEmailAndPassword(email, password)
        .then((result) => {
            console.log('Signed in with email:', result.user.email);
        })
        .catch((error) => {
            // Si el usuario no existe, intentar crearlo
            if (error.code === 'auth/user-not-found') {
                auth.createUserWithEmailAndPassword(email, password)
                    .then((result) => {
                        console.log('New user created:', result.user.email);
                    })
                    .catch((createError) => {
                        console.error('Error creating user:', createError);
                        alert('Error: ' + createError.message);
                    });
            } else {
                console.error('Email sign-in error:', error);
                alert('Sign in error: ' + error.message);
            }
        });
}

// Sign out
function signOutUser() {
    if (confirm('Sign out?')) {
        auth.signOut().then(() => {
            location.reload();
        });
    }
}

// Continue offline
function continueOffline() {
    isOfflineMode = true;
    showMainApp();
    updateSyncStatus('offline');
    // Esperar a que app.js se cargue
    if (typeof loadData === 'function') {
        loadData();
    }
    if (typeof loadSettings === 'function') {
        loadSettings();
    }
}

// Show main app
function showMainApp() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    
    if (currentUser) {
        const email = currentUser.email;
        // Mostrar solo icono en el avatar
        document.getElementById('user-icon').textContent = '👤';
        // Guardar el email completo en el dropdown
        document.getElementById('user-email-full').textContent = email;
        document.getElementById('user-avatar').style.display = 'block';
    }
}

// Toggle user menu
function toggleUserMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('logout-menu');
    menu.classList.toggle('show');
}

// Close user menu on outside click
document.addEventListener('click', (e) => {
    const menu = document.getElementById('logout-menu');
    if (menu && !e.target.closest('.user-avatar')) {
        menu.classList.remove('show');
    }
});

// Update sync status
function updateSyncStatus(status) {
    const statusEl = document.getElementById('sync-status');
    if (status === 'online') {
        statusEl.textContent = '● Online';
        statusEl.style.color = '#00ff00';
        statusEl.style.borderColor = '#00ff00';
    } else if (status === 'syncing') {
        statusEl.textContent = '↻ Syncing...';
        statusEl.style.color = '#ffff00';
        statusEl.style.borderColor = '#ffff00';
    } else {
        statusEl.textContent = '● Offline';
        statusEl.style.color = '#ff0000';
        statusEl.style.borderColor = '#ff0000';
    }
}

// Load data from Firebase - AHORA ESPECÍFICO POR USUARIO
async function loadDataFromFirebase() {
    if (!currentUser) return;
    
    updateSyncStatus('syncing');
    
    try {
        // Cargar desde users/{userId}/entries
        const snapshot = await db.collection('users')
            .doc(currentUser.uid)
            .collection('entries')
            .orderBy('timestamp', 'desc')
            .get();
        
        if (typeof entries !== 'undefined') {
            entries = [];
            snapshot.forEach((doc) => {
                entries.push({ id: doc.id, ...doc.data() });
            });
            
            console.log(`Cargadas ${entries.length} entradas del usuario ${currentUser.email}`);
            
            if (typeof renderTimeline === 'function') {
                renderTimeline();
            }
        }
        
        updateSyncStatus('online');
    } catch (error) {
        console.error('Error loading from Firebase:', error);
        updateSyncStatus('offline');
        if (typeof loadData === 'function') {
            loadData();
        }
    }
}

// Save data to Firebase - AHORA ESPECÍFICO POR USUARIO
async function saveDataToFirebase() {
    if (!currentUser || isOfflineMode) {
        if (typeof saveData === 'function') {
            saveData();
        }
        return;
    }
    
    updateSyncStatus('syncing');
    
    try {
        const batch = db.batch();
        
        if (typeof entries !== 'undefined') {
            entries.forEach((entry) => {
                // Guardar en users/{userId}/entries/{entryId}
                const docRef = db.collection('users')
                    .doc(currentUser.uid)
                    .collection('entries')
                    .doc(String(entry.id));
                batch.set(docRef, entry);
            });
            
            await batch.commit();
            console.log(`Guardadas ${entries.length} entradas para ${currentUser.email}`);
        }
        
        updateSyncStatus('online');
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        updateSyncStatus('offline');
        if (typeof saveData === 'function') {
            saveData();
        }
    }
}

// Load settings from Firebase - AHORA ESPECÍFICO POR USUARIO
async function loadSettingsFromFirebase() {
    if (!currentUser) return;
    
    try {
        // Cargar desde users/{userId}/settings/app-settings
        const doc = await db.collection('users')
            .doc(currentUser.uid)
            .collection('settings')
            .doc('app-settings')
            .get();
        
        if (doc.exists && typeof timeDurations !== 'undefined') {
            const data = doc.data();
            if (data.timeDurations) timeDurations = data.timeDurations;
            if (data.timeActivities) timeActivities = data.timeActivities;
            if (data.trackItems) trackItems = data.trackItems;
            if (data.moods) moods = data.moods;
            
            console.log('Configuración cargada para', currentUser.email);
            
            if (typeof updateTimerOptions === 'function') {
                updateTimerOptions();
            }
            if (typeof updateTrackOptions === 'function') {
                updateTrackOptions();
            }
        }
    } catch (error) {
        console.error('Error loading settings from Firebase:', error);
        if (typeof loadSettings === 'function') {
            loadSettings();
        }
    }
}

// Save settings to Firebase - AHORA ESPECÍFICO POR USUARIO
async function saveSettingsToFirebase() {
    if (!currentUser || isOfflineMode) {
        if (typeof saveSettingsToStorage === 'function') {
            saveSettingsToStorage();
        }
        return;
    }
    
    try {
        if (typeof timeDurations !== 'undefined') {
            // Guardar en users/{userId}/settings/app-settings
            await db.collection('users')
                .doc(currentUser.uid)
                .collection('settings')
                .doc('app-settings')
                .set({
                    timeDurations: timeDurations,
                    timeActivities: timeActivities,
                    trackItems: trackItems,
                    moods: moods,
                    updatedAt: new Date().toISOString()
                });
            
            console.log('Settings saved to Firebase for', currentUser.email);
        }
    } catch (error) {
        console.error('Error saving settings to Firebase:', error);
        if (typeof saveSettingsToStorage === 'function') {
            saveSettingsToStorage();
        }
    }
}

// Delete entry from Firebase - AHORA ESPECÍFICO POR USUARIO
async function deleteEntryFromFirebase(entryId) {
    if (!currentUser || isOfflineMode) return;
    
    try {
        // Eliminar desde users/{userId}/entries/{entryId}
        await db.collection('users')
            .doc(currentUser.uid)
            .collection('entries')
            .doc(String(entryId))
            .delete();
        console.log('Entry deleted from Firebase for', currentUser.email);
    } catch (error) {
        console.error('Error deleting from Firebase:', error);
    }
}
