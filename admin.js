/* =========================================================
   ADMIN PANEL — Spin & Win (5 segments)
   - First page: Admin Home (welcome) with Settings gear icon
   - Login screen (password protected)
   - Dashboard: stats, segment table, edit maxWins / enable
   ========================================================= */

const ADMIN_PASSWORD = 'admin123';    // <-- change in production
const STORAGE_KEY    = 'spinwin_state_v2';
const ANALYTICS_KEY  = 'spinwin_analytics_v2';
const SESSION_KEY    = 'spinwin_admin_session';
const PASSWORD_KEY   = 'spinwin_admin_pw';

/* Reference for labels/colors. Operational state (currentWins,
   enabled, maxWins) is loaded from localStorage. */
const DEFAULT_ITEMS = [
  { id: 1, label: "Prize 1",     color: "#ff2e9a", weight: 40, maxWins: 3,  currentWins: 0, enabled: true },
  { id: 2, label: "Prize 2",     color: "#00e5ff", weight: 25, maxWins: 10, currentWins: 0, enabled: true },
  { id: 3, label: "Grand Prize", color: "#ffcc33", weight: 5,  maxWins: 1,  currentWins: 0, enabled: true },
  { id: 4, label: "Prize 4",     color: "#8a2be2", weight: 15, maxWins: 5,  currentWins: 0, enabled: true },
  { id: 5, label: "Try Again",   color: "#00ff88", weight: 15, maxWins: 0,  currentWins: 0, enabled: true }
];

const $ = (id) => document.getElementById(id);

/* ----------------- DOM ----------------- */
const adminHome     = $('adminHome');
const loginScreen   = $('loginScreen');
const dashboard     = $('dashboard');
const enterAdminBtn = $('enterAdminBtn');
const pwInput       = $('pwInput');
const loginBtn      = $('loginBtn');
const logoutBtn     = $('logoutBtn');
const segBody       = $('segBody');
const saveBtn       = $('saveBtn');
const resetBtn      = $('resetBtn');
const refreshBtn    = $('refreshBtn');
const toast         = $('toast');

const settingsIcon     = $('settingsIcon');
const settingsPanel    = $('settingsPanel');
const settingsBackdrop = $('settingsBackdrop');
const settingsClose    = $('settingsClose');

let items = loadItems();

/* ----------------- INIT ----------------- */
renderHomeStats();
setInterval(renderHomeStats, 5000);

if (sessionStorage.getItem(SESSION_KEY) === 'ok') {
  adminHome.style.display = 'none';
  showDashboard();
}

/* ----------------- HOME ACTIONS ----------------- */
enterAdminBtn.addEventListener('click', () => {
  adminHome.style.display = 'none';
  if (sessionStorage.getItem(SESSION_KEY) === 'ok') {
    showDashboard();
  } else {
    loginScreen.style.display = 'block';
    setTimeout(() => pwInput.focus(), 100);
  }
});

function renderHomeStats() {
  const a = loadAnalytics();
  const it = loadItems();
  $('homePlays').textContent = a.totalPlays || 0;
  $('homeWins').textContent  = a.totalWins  || 0;
  $('homeActive').textContent = it.filter(i =>
    i.enabled !== false && (i.maxWins === 0 || i.currentWins < i.maxWins)
  ).length;
}

/* ----------------- AUTH ----------------- */
loginBtn.addEventListener('click', tryLogin);
pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });

function tryLogin() {
  const current = localStorage.getItem(PASSWORD_KEY) || ADMIN_PASSWORD;
  if (pwInput.value === current) {
    sessionStorage.setItem(SESSION_KEY, 'ok');
    showDashboard();
  } else {
    showToast('Wrong password');
    pwInput.value = '';
  }
}

logoutBtn.addEventListener('click', (e) => {
  e.preventDefault();
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
});

function showDashboard() {
  adminHome.style.display = 'none';
  loginScreen.style.display = 'none';
  dashboard.style.display = 'block';
  renderAll();
}

/* ----------------- DATA ----------------- */
function loadItems() {
  const result = JSON.parse(JSON.stringify(DEFAULT_ITEMS));
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return result;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return result;
    result.forEach(item => {
      const s = saved.find(x => x.id === item.id);
      if (s) {
        item.currentWins = s.currentWins || 0;
        if (typeof s.enabled === 'boolean') item.enabled = s.enabled;
        if (typeof s.maxWinsOverride === 'number') item.maxWins = s.maxWinsOverride;
      }
    });
  } catch (e) { /* ignore */ }
  return result;
}

function persistItems() {
  const snapshot = items.map(i => ({
    id: i.id,
    currentWins: i.currentWins,
    enabled: i.enabled,
    maxWinsOverride: i.maxWins
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function loadAnalytics() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    if (raw) {
      const a = JSON.parse(raw);
      if (a.date === today) return a;
    }
  } catch (e) { /* ignore */ }
  return { date: today, totalPlays: 0, totalWins: 0 };
}

/* ----------------- DASHBOARD RENDER ----------------- */
function renderAll() {
  renderStats();
  renderSegments();
}

function renderStats() {
  const a = loadAnalytics();
  $('statPlays').textContent = a.totalPlays || 0;
  $('statWins').textContent  = a.totalWins  || 0;
  $('statSegs').textContent  = items.length;
  $('statActive').textContent = items.filter(i =>
    i.enabled && (i.maxWins === 0 || i.currentWins < i.maxWins)
  ).length;
}

function renderSegments() {
  segBody.innerHTML = '';
  items.forEach(item => {
    const exhausted = item.maxWins > 0 && item.currentWins >= item.maxWins;
    const remaining = item.maxWins === 0
      ? '∞'
      : Math.max(0, item.maxWins - item.currentWins);
    const pct = item.maxWins === 0
      ? 0
      : Math.min(100, (item.currentWins / item.maxWins) * 100);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="seg-name">
          <span class="swatch" style="background:${item.color}"></span>
          <span>${escapeHtml(item.label)}</span>
        </div>
      </td>
      <td>${item.currentWins}</td>
      <td><input type="number" min="0" id="max-${item.id}" value="${item.maxWins}" /></td>
      <td class="${exhausted ? 'exhausted' : ''}">${remaining}</td>
      <td><div class="progress"><span style="width:${pct}%"></span></div></td>
      <td><input type="checkbox" id="en-${item.id}" ${item.enabled ? 'checked' : ''} /></td>
    `;
    segBody.appendChild(tr);
  });
}

/* ----------------- DASHBOARD ACTIONS ----------------- */
saveBtn.addEventListener('click', () => {
  items.forEach(item => {
    item.maxWins = Math.max(0, parseInt($(`max-${item.id}`).value, 10) || 0);
    item.enabled = $(`en-${item.id}`).checked;
  });
  persistItems();
  renderAll();
  showToast('Saved');
});

resetBtn.addEventListener('click', () => {
  if (!confirm('Reset ALL win counts AND today\'s analytics?')) return;
  resetAllCounts();
  renderAll();
  showToast('All counts reset');
});

refreshBtn.addEventListener('click', () => {
  items = loadItems();
  renderAll();
  showToast('Refreshed');
});

setInterval(() => {
  if (dashboard.style.display !== 'none') {
    items = loadItems();
    renderAll();
  }
}, 5000);

function resetAllCounts() {
  items.forEach(i => { i.currentWins = 0; });
  persistItems();
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(ANALYTICS_KEY, JSON.stringify({
    date: today, totalPlays: 0, totalWins: 0
  }));
  renderHomeStats();
}

/* ----------------- SETTINGS PANEL ----------------- */
function openSettings()  { settingsBackdrop.classList.add('active');    settingsPanel.classList.add('active'); }
function closeSettings() { settingsBackdrop.classList.remove('active'); settingsPanel.classList.remove('active'); }

settingsIcon.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
settingsBackdrop.addEventListener('click', closeSettings);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && settingsPanel.classList.contains('active')) closeSettings();
});

$('setOpenDash').addEventListener('click', () => {
  closeSettings();
  enterAdminBtn.click();
});

$('setReset').addEventListener('click', () => {
  if (!confirm('Reset ALL win counts AND today\'s analytics?')) return;
  resetAllCounts();
  if (dashboard.style.display !== 'none') renderAll();
  closeSettings();
  showToast('All counts reset');
});

$('setFullscreen').addEventListener('click', () => {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)?.call(document);
  }
  closeSettings();
});

$('setExport').addEventListener('click', () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    items,
    analytics: loadAnalytics()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spinwin-state-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  closeSettings();
  showToast('Exported');
});

$('setChangePw').addEventListener('click', () => {
  const current = localStorage.getItem(PASSWORD_KEY) || ADMIN_PASSWORD;
  const old = prompt('Enter current password:');
  if (old === null) return;
  if (old !== current) { showToast('Wrong password'); return; }
  const next = prompt('Enter NEW password (min 4 chars):');
  if (!next || next.length < 4) { showToast('Password too short'); return; }
  localStorage.setItem(PASSWORD_KEY, next);
  closeSettings();
  showToast('Password updated');
});

$('setLogout').addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  closeSettings();
  showToast('Logged out');
  setTimeout(() => location.reload(), 600);
});

/* ----------------- HELPERS ----------------- */
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
