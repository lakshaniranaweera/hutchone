/* =========================================================
   ADMIN PANEL — Spin & Win (5 segments)
   - First page: Admin Home (welcome) with Settings gear icon
   - Login screen (password protected)
   - Dashboard: stats, segment table, edit maxWins / enable
   ========================================================= */

const ADMIN_PASSWORD = 'admin123';    // <-- change in production
const SESSION_KEY    = 'spinwin_admin_session';
const PASSWORD_KEY   = 'spinwin_admin_pw';
// STORAGE_KEY and ANALYTICS_KEY come from wheel-config.js

/* Prize definitions (labels, colors, IDs, default maxWins) come from
   wheelItems in wheel-config.js — single source of truth. The admin
   panel just layers operational state (currentWins, enabled, maxWins
   overrides) on top of those defaults via localStorage. */
const DEFAULT_ITEMS = wheelItems.map(item => ({
  id: item.id,
  label: item.label,
  color: item.color,
  weight: item.weight,
  maxWins: item.maxWins,
  currentWins: item.currentWins || 0,
  enabled: item.enabled !== false
}));

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
    const maxInput = $(`max-${item.id}`);
    const enInput  = $(`en-${item.id}`);
    if (maxInput) {
      const newMax = Math.max(0, parseInt(maxInput.value, 10) || 0);
      // If the cap was changed, reset that item's win count so the new
      // quota takes effect from now (e.g. "set to 2" means "wins 2 more
      // times", not "wins 2 total counting previous spins").
      if (newMax !== item.maxWins) item.currentWins = 0;
      item.maxWins = newMax;
    }
    if (enInput) item.enabled = enInput.checked;
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

/* Auto-refresh stats only — never re-render the segment table while the
   user might be editing inputs (that wiped unsaved changes). Use the
   "Refresh" button to reload segment values from storage on demand. */
setInterval(() => {
  if (dashboard.style.display !== 'none') {
    renderStats();
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

/* ----------------- LAYOUT & POSITIONS EDITOR ----------------- */
/* Lets the operator move/resize the wheel and START button from the UI.
   Values are stored in localStorage (LAYOUT_KEY from wheel-config.js) and
   read by the game (script.js) — no CSS edits or rebuilds required.
   The phone preview is a live iframe of the game; slider changes are pushed
   into it with postMessage, and SAVE persists them for the real game. */
const previewFrame   = $('previewFrame');
const rngWheelTop    = $('rngWheelTop');
const rngWheelSize   = $('rngWheelSize');
const rngBtnBottom   = $('rngBtnBottom');
const saveLayoutBtn  = $('saveLayoutBtn');
const resetLayoutBtn = $('resetLayoutBtn');

let layout = loadLayout();

function loadLayout() {
  const l = Object.assign({}, DEFAULT_LAYOUT);
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) Object.assign(l, JSON.parse(raw));
  } catch (e) { /* ignore */ }
  return l;
}

function syncLayoutInputs() {
  rngWheelTop.value  = layout.wheelTop;
  rngWheelSize.value = layout.wheelSize;
  rngBtnBottom.value = layout.buttonBottom;
  $('valWheelTop').textContent  = layout.wheelTop + '%';
  $('valWheelSize').textContent = layout.wheelSize + '%';
  $('valBtnBottom').textContent = layout.buttonBottom + '%';
}

function pushLayoutToPreview() {
  if (previewFrame && previewFrame.contentWindow) {
    previewFrame.contentWindow.postMessage({ type: 'spinwin-layout', layout }, '*');
  }
}

function onLayoutInput() {
  layout = {
    wheelTop:     parseInt(rngWheelTop.value, 10),
    wheelSize:    parseInt(rngWheelSize.value, 10),
    buttonBottom: parseInt(rngBtnBottom.value, 10)
  };
  syncLayoutInputs();
  pushLayoutToPreview();
}

if (rngWheelTop && rngWheelSize && rngBtnBottom) {
  [rngWheelTop, rngWheelSize, rngBtnBottom].forEach(r =>
    r.addEventListener('input', onLayoutInput)
  );

  saveLayoutBtn.addEventListener('click', () => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    showToast('Layout saved');
  });

  resetLayoutBtn.addEventListener('click', () => {
    layout = Object.assign({}, DEFAULT_LAYOUT);
    syncLayoutInputs();
    pushLayoutToPreview();
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    showToast('Layout reset to default');
  });

  // Push current values once the preview iframe has loaded the game.
  previewFrame.addEventListener('load', pushLayoutToPreview);

  syncLayoutInputs();
}

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
