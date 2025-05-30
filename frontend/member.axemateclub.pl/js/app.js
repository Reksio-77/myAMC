// js/app.js

const API_BASE = 'https://api.axemateclub.pl/api';

// — DOM —
const tabLogin     = document.getElementById('tab-login');
const tabRegister  = document.getElementById('tab-register');
const btnLogout    = document.getElementById('btn-logout');
const greetingEl   = document.getElementById('greeting');

const authSect     = document.getElementById('auth');
const regSect      = document.getElementById('register');
const dashSect     = document.getElementById('dashboard');

const authForm     = document.getElementById('authForm');
const registerForm = document.getElementById('registerForm');

const authMsg      = document.getElementById('authMsg');
const regMsg       = document.getElementById('registerMsg');

const packageInfo  = document.getElementById('packageInfo');
const creditsInfo  = document.getElementById('creditsInfo');
const historyList  = document.getElementById('historyList');

const slotSelect   = document.getElementById('slotSelect');
const qrBtn        = document.getElementById('qrBtn');
const qrContainer  = document.getElementById('qrContainer');
const qrMsg        = document.getElementById('qrMsg');

// — Stan globalny —
let previousRemaining = null;
let qrDisplayed       = false;

// — Helpers —
const isLoggedIn = () => !!localStorage.getItem('token');
const typeLabel  = t => t === 'usage' ? 'rozliczone' : t;

function showLoggedOut() {
  tabLogin.classList.remove('hidden');
  tabRegister.classList.remove('hidden');
  btnLogout.classList.add('hidden');
  authSect.classList.remove('hidden');
  regSect.classList.add('hidden');
  dashSect.classList.add('hidden');
}

function showLoggedIn() {
  tabLogin.classList.add('hidden');
  tabRegister.classList.add('hidden');
  btnLogout.classList.remove('hidden');
  authSect.classList.add('hidden');
  regSect.classList.add('hidden');
  dashSect.classList.remove('hidden');
}

// — Zakładki —
tabLogin.addEventListener('click', () => showLoggedOut());
tabRegister.addEventListener('click', () => {
  authSect.classList.add('hidden');
  regSect.classList.remove('hidden');
  dashSect.classList.add('hidden');
});

// — Logout —
btnLogout.addEventListener('click', () => {
  localStorage.removeItem('token');
  location.reload();
});

// — Init —
if (isLoggedIn()) {
  showLoggedIn();
  loadDashboard();
} else {
  showLoggedOut();
}

// — Logowanie —
authForm.addEventListener('submit', async e => {
  e.preventDefault();
  authMsg.textContent = '';
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e.target.email.value.trim() })
    });
    if (!res.ok) throw new Error('Błąd logowania');
    const { token } = await res.json();
    localStorage.setItem('token', token);
    showLoggedIn();
    loadDashboard();
  } catch (err) {
    authMsg.textContent = err.message;
  }
});

// — Rejestracja —
registerForm.addEventListener('submit', async e => {
  e.preventDefault();
  regMsg.textContent = '';
  try {
    const payload = {
      first_name: e.target.first_name.value.trim(),
      last_name:  e.target.last_name.value.trim(),
      phone:      e.target.phone.value.trim(),
      email:      e.target.email.value.trim()
    };
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Błąd rejestracji');
    }
    regMsg.textContent = 'Rejestracja OK. Zaloguj się.';
    tabLogin.click();
  } catch (err) {
    regMsg.textContent = err.message;
  }
});

// — Load Dashboard & detect scan —
async function loadDashboard() {
  const token = localStorage.getItem('token');
  if (!token) return showLoggedOut();

  showLoggedIn();
  const headers = { 'Authorization': 'Bearer ' + token };

  // 1) Pobierz kredyty
  const me = await fetch(`${API_BASE}/me/credits`, { headers }).then(r => r.json());
  greetingEl.textContent = `Witaj ${me.first_name}`;
  greetingEl.classList.remove('hidden');

  packageInfo.textContent = me.package ? `Karnet: ${me.package}` : 'Karnet: Brak';
  if (me.remaining === 0) {
    creditsInfo.textContent = 'Brak kredytów, zakup nowe';
  } else if (me.remaining <= 2) {
    creditsInfo.textContent = `Kredyty na wyczerpaniu (${me.remaining}), zakup nowe`;
  } else {
    creditsInfo.textContent = `Kredyty: ${me.remaining}`;
  }

  // 2) Jeśli QR był wyświetlony i kredyty spadły → ukryj QR
  if (qrDisplayed && previousRemaining !== null && me.remaining < previousRemaining) {
    qrContainer.innerHTML = '';
    qrMsg.textContent      = 'QR zniknął po zeskanowaniu.';
    qrBtn.disabled         = false;
    qrDisplayed            = false;
  }
  previousRemaining = me.remaining;

  // 3) Historia
  const history = await fetch(`${API_BASE}/me/history`, { headers }).then(r => r.json());
  historyList.innerHTML = history
    .map(h => `<li>${new Date(h.timestamp).toLocaleString()}: ${h.change > 0 ? '+' : ''}${h.change} (${typeLabel(h.type)})</li>`)
    .join('');

  // 4) pokaż i odblokuj QR button
  qrBtn.classList.remove('hidden');
  qrBtn.disabled = false;
}

// — Auto-refresh co 5s —
setInterval(() => {
  if (isLoggedIn()) loadDashboard();
}, 5000);

// — Generowanie QR —
qrBtn.addEventListener('click', async () => {
  qrBtn.disabled       = true;
  qrMsg.textContent     = '';
  qrContainer.innerHTML = '';

  const token   = localStorage.getItem('token');
  const minutes = Number(slotSelect.value);

  try {
    const res = await fetch(`${API_BASE}/me/qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ minutes })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    // render QR
    QRCode.toCanvas(data.code, { width: 200 }, (err, canvas) => {
      if (canvas) qrContainer.appendChild(canvas);
    });

    qrDisplayed = true;
  } catch (err) {
    qrMsg.textContent = 'Błąd: ' + err.message;
    qrBtn.disabled    = false;
  }
});
