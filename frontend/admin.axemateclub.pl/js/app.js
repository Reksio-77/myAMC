// js/app.js

const API_BASE = 'https://api.axemateclub.pl/api';

// DOM
const loginForm     = document.getElementById('loginForm');
const authMsg       = document.getElementById('authMsg');
const greetingAdmin = document.getElementById('greetingAdmin');
const logoutBtn     = document.getElementById('logoutBtn');

const usersSection  = document.getElementById('usersSection');
const usersTbody    = document.getElementById('usersTable').querySelector('tbody');

const userSelect    = document.getElementById('userSelect');
const packageSelect = document.getElementById('packageSelect');
const assignForm    = document.getElementById('assignForm');
const assignMsg     = document.getElementById('assignMsg');

const scanBtn       = document.getElementById('scanBtn');
const scanMsg       = document.getElementById('scanMsg');
const qrReaderDiv   = document.getElementById('qr-reader');

let packagesCache = [];
let qrScanner     = null;

function isLoggedIn() {
  return !!localStorage.getItem('token');
}

// --- UI toggles ---
function showLogin() {
  document.getElementById('loginSection').classList.remove('hidden');
  usersSection.classList.add('hidden');
  greetingAdmin.classList.add('hidden');
}
function showUsers() {
  document.getElementById('loginSection').classList.add('hidden');
  usersSection.classList.remove('hidden');
  greetingAdmin.classList.remove('hidden');
}

// --- Init ---
if (isLoggedIn()) {
  loadAdminInfo();
  loadUsers();
  loadDropdowns();
} else {
  showLogin();
}

// --- LOGIN ---
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  authMsg.textContent = '';
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        email: e.target.email.value.trim(),
        password: e.target.password.value
      })
    });
    if (!res.ok) throw new Error('Nieprawidłowy email lub hasło');
    const { token } = await res.json();
    localStorage.setItem('token', token);
    loadAdminInfo();
    loadUsers();
    loadDropdowns();
  } catch (err) {
    authMsg.textContent = err.message;
  }
});

// --- LOGOUT ---
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('token');
  showLogin();
});

// --- Load admin name ---
async function loadAdminInfo() {
  const token = localStorage.getItem('token');
  const me    = await fetch(`${API_BASE}/me/credits`, {
    headers:{ 'Authorization':'Bearer '+token }
  }).then(r=>r.json());
  greetingAdmin.textContent = `Witaj ${me.first_name}`;
  greetingAdmin.classList.remove('hidden');
}

// --- Load users table ---
async function loadUsers() {
  const token = localStorage.getItem('token');
  if (!token) return showLogin();

  const res = await fetch(`${API_BASE}/users?role=member`, {
    headers:{ 'Authorization':'Bearer '+token }
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    return showLogin();
  }
  if (!res.ok) {
    return alert('Błąd pobierania użytkowników: ' + res.status);
  }
  const users = await res.json();
  usersTbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${u.first_name}</td>
      <td>${u.last_name}</td>
      <td>${u.email}</td>
      <td>${new Date(u.created_at).toLocaleString()}</td>
      <td>${u.credits}</td>
    </tr>
  `).join('');
  showUsers();
}

// --- Load dropdowns & auto-fill credits ---
async function loadDropdowns() {
  const token = localStorage.getItem('token');

  // users
  const users = await fetch(`${API_BASE}/users?role=member`, {
    headers:{ 'Authorization':'Bearer '+token }
  }).then(r=>r.json());
  userSelect.innerHTML = '<option value="">— wybierz —</option>' +
    users.map(u => `<option value="${u.id}">${u.first_name} ${u.last_name}</option>`).join('');

  // packages
  packagesCache = await fetch(`${API_BASE}/packages`, {
    headers:{ 'Authorization':'Bearer '+token }
  }).then(r=>r.json());
  packageSelect.innerHTML = '<option value="">— wybierz —</option>' +
    packagesCache.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  packageSelect.onchange = () => {
    const pkg = packagesCache.find(p => p.id === +packageSelect.value);
    assignForm.elements.credits.value = pkg ? pkg.credits_included : '';
  };
}

// --- Assign package + refresh table ---
assignForm.addEventListener('submit', async e => {
  e.preventDefault();
  assignMsg.textContent = '';
  const userId    = +e.target.user_id.value;
  const packageId = +e.target.package_id.value;
  try {
    const res = await fetch(`${API_BASE}/users/${userId}/package`, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer '+localStorage.getItem('token')
      },
      body: JSON.stringify({ package_id: packageId })
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    assignMsg.textContent = 'Pakiet przypisany pomyślnie.';
    await loadUsers();
  } catch (err) {
    assignMsg.textContent = 'Błąd: '+err.message;
  }
});
// --- QR Scanner: delay stop and hide UI after scan ---
scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  scanMsg.textContent = '';
  qrReaderDiv.innerHTML = '';

  try {
    if (typeof Html5Qrcode.getCameras !== 'function') {
      throw new Error('Twoja przeglądarka nie wspiera skanera QR');
    }
    const devices = await Html5Qrcode.getCameras();
    if (!devices || !devices.length) {
      throw new Error('Nie znaleziono kamery na urządzeniu');
    }
    const cameraId = devices.length > 1
      ? devices[devices.length - 1].id
      : devices[0].id;

    qrScanner = new Html5Qrcode("qr-reader");
    await qrScanner.start(
      cameraId,
      { fps: 10, qrbox: 250 },
      code => {
        // po zeskanowaniu poczekaj 1s, potem zatrzymaj kamerę i ukryj czytnik
        setTimeout(async () => {
          try {
            await qrScanner.stop();
          } catch(e) {
            console.warn('Błąd zatrzymania skanera:', e);
          }
          qrReaderDiv.innerHTML = '';
          scanBtn.disabled = false;

          // wysyłamy kod do backendu
          try {
            const res = await fetch(`${API_BASE}/qr/scan`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
              },
              body: JSON.stringify({ code })
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.message || 'Błąd serwera');
            const used = body.message.match(/\d+/)?.[0] || '?';
            scanMsg.textContent = `Skanowanie pomyślne, rozliczono ${used} kredytów`;
            // odśwież listę użytkowników
            await loadUsers();
          } catch (err) {
            console.error('Błąd podczas wysyłania skanu:', err);
            scanMsg.textContent = 'Nie udało się przetworzyć kodu: ' + (err.message || err);
          }
        }, 1000);
      },
      () => {
        // pojedyncze błędy klatki ignorujemy
      }
    );
  } catch (err) {
    console.error('Błąd inicjalizacji skanera:', err);
    scanBtn.disabled = false;
    scanMsg.textContent = 'Nie udało się uruchomić skanera: ' + (err.message || err.toString());
  }
});

