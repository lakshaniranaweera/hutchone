/* =========================================================
   SPIN & WIN — Wheel Game
   Canvas wheel, bag-draw selection, hard-coded win caps,
   7-second fullscreen video reward, confetti, sounds.
   ---------------------------------------------------------
   Prize definitions live in wheel-config.js (loaded before
   this file in index.html) so the admin panel can read the
   same prize list. Edit prizes there.
   ========================================================= */

/* ----------------- STATE ----------------- */
let isSpinning = false;
let currentRotation = 0;
let segmentImages = [];
let spinBag = [];  // Shuffled queue of item indices — guarantees each prize hits its maxWins quota.

mergePersistedState();
let analytics = loadAnalytics();

/* ----------------- DOM ----------------- */
const $ = (id) => document.getElementById(id);
const homePage   = $('homePage');
const gamePage   = $('gamePage');
const startBtn   = $('startBtn');
const spinBtn    = $('spinBtn');
const loader     = $('loader');
const canvas     = $('wheelCanvas');
const ctx        = canvas.getContext('2d');
const videoOverlay = $('videoOverlay');
const rewardImage  = $('rewardImage');
const centerLogo = $('centerLogo');
const spinSound  = $('spinSound');
const winSound   = $('winSound');
const confettiCanvas = $('confetti');
const adminHotspot   = $('adminHotspot');

/* ----------------- INIT ----------------- */
window.addEventListener('load', () => {
  setTimeout(() => loader.classList.add('hidden'), 700);
  applyGameOptions();
  setupHiDPICanvas();
  preloadSegmentImages();
  drawWheel(0);
});

window.addEventListener('resize', () => {
  setupHiDPICanvas();
  drawWheel(currentRotation);
  resizeConfetti();
});

['fullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'].forEach(ev => {
  document.addEventListener(ev, () => {
    setTimeout(() => {
      setupHiDPICanvas();
      drawWheel(currentRotation);
      resizeConfetti();
    }, 100);
  });
});

/* Live sync with the admin panel — if maxWins / enabled changes in
   localStorage (e.g. admin Saves in another tab), reapply immediately
   so the next spin respects the new caps without needing a reload. */
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) {
    mergePersistedState();
    spinBag = [];                  // force rebuild with new caps on next spin
    drawWheel(currentRotation);
  }
});

/* ----------------- EVENTS ----------------- */
startBtn.addEventListener('click', () => switchPage(gamePage));
spinBtn .addEventListener('click', spin);

/* Hidden admin entry — long-press top-left corner for 1.5s */
(function setupAdminGesture() {
  let timer = null;
  const begin = () => { timer = setTimeout(() => location.href = 'admin.html', 1500); };
  const cancel = () => { clearTimeout(timer); timer = null; };
  adminHotspot.addEventListener('mousedown',  begin);
  adminHotspot.addEventListener('touchstart', begin, { passive: true });
  ['mouseup','mouseleave','touchend','touchcancel'].forEach(ev =>
    adminHotspot.addEventListener(ev, cancel)
  );
})();

/* ----------------- SETTINGS PANEL (home page) ----------------- */
const SOUND_KEY = 'spinwin_sound_enabled';
let soundEnabled = localStorage.getItem(SOUND_KEY) !== 'off';

const settingsIcon     = $('settingsIcon');
const settingsPanel    = $('settingsPanel');
const settingsBackdrop = $('settingsBackdrop');
const settingsClose    = $('settingsClose');
const setSoundIcon     = $('setSoundIcon');
const setSoundDesc     = $('setSoundDesc');

function refreshSoundUI() {
  setSoundIcon.textContent = soundEnabled ? '🔊' : '🔇';
  setSoundDesc.textContent = soundEnabled ? 'Sound is ON' : 'Sound is OFF';
}
refreshSoundUI();

function openSettings()  { settingsBackdrop.classList.add('active');    settingsPanel.classList.add('active'); }
function closeSettings() { settingsBackdrop.classList.remove('active'); settingsPanel.classList.remove('active'); }

settingsIcon    .addEventListener('click', openSettings);
settingsClose   .addEventListener('click', closeSettings);
settingsBackdrop.addEventListener('click', closeSettings);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && settingsPanel.classList.contains('active')) closeSettings();
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

$('setSound').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem(SOUND_KEY, soundEnabled ? 'on' : 'off');
  refreshSoundUI();
});

$('setAdmin').addEventListener('click', () => {
  location.href = 'admin.html';
});

$('setAbout').addEventListener('click', () => {
  alert('SPIN & WIN\nVersion 1.0\n\nA premium casino-style spin wheel game.\n5 segments · weighted random · video rewards.');
});

/* ----------------- PERSISTENCE ----------------- */
function mergePersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return;
    wheelItems.forEach(item => {
      const s = saved.find(x => x.id === item.id);
      if (s) {
        item.currentWins = s.currentWins || 0;
        if (typeof s.enabled === 'boolean') item.enabled = s.enabled;
        if (typeof s.maxWinsOverride === 'number') item.maxWins = s.maxWinsOverride;
      }
    });
  } catch (e) { /* ignore */ }
}

function persistState() {
  const snapshot = wheelItems.map(i => ({
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

function saveAnalytics() {
  localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
}

function applyGameOptions() {
  if (GAME_OPTIONS.centerLogo) {
    centerLogo.src = GAME_OPTIONS.centerLogo;
    centerLogo.style.display = 'block';
  }
  if (GAME_OPTIONS.spinSound) spinSound.src = GAME_OPTIONS.spinSound;
  if (GAME_OPTIONS.winSound)  winSound.src  = GAME_OPTIONS.winSound;
}

/* ----------------- CANVAS WHEEL ----------------- */
function setupHiDPICanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr  = window.devicePixelRatio || 1;
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function preloadSegmentImages() {
  segmentImages = wheelItems.map(item => {
    if (!item.image) return null;
    const img = new Image();
    img.onload  = () => drawWheel(currentRotation);
    img.onerror = () => console.warn('Wheel image failed to load:', item.image);
    img.src = item.image;
    return img;
  });
}

function drawWheel(rotation) {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  const cx = w / 2, cy = h / 2;
  const radius = Math.min(w, h) / 2 - 6;
  const n = wheelItems.length;
  const arc = (Math.PI * 2) / n;

  ctx.clearRect(0, 0, w, h);

  // Segments
  for (let i = 0; i < n; i++) {
    const item = wheelItems[i];
    const start = rotation + i * arc - Math.PI / 2 - arc / 2;
    const end   = start + arc;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();

    const sg = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
    sg.addColorStop(0, lighten(item.color, 25));
    sg.addColorStop(1, item.color);
    ctx.fillStyle = sg;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Prize image (labels removed). Per-item `scale` (default 1) shrinks/grows the image.
    const img = segmentImages[i];
    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation + i * arc - Math.PI / 2);
      const scale = typeof item.scale === 'number' ? item.scale : 1;
      const baseSize = radius * 0.34;
      const size = baseSize * scale;
      const center = radius * 0.57;
      ctx.drawImage(img, center - size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  // (Outer gold ring removed)
}

function lighten(hex, percent) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + percent);
  const g = Math.min(255, ((num >> 8) & 0xff) + percent);
  const b = Math.min(255, (num & 0xff) + percent);
  return `rgb(${r},${g},${b})`;
}

function isExhausted(item) {
  if (!item.enabled) return true;
  if (item.maxWins > 0 && item.currentWins >= item.maxWins) return true;
  return false;
}

/* Build a shuffled "bag" of item indices. Each eligible item contributes
   one ticket per remaining win-slot (maxWins - currentWins). Unlimited
   items (maxWins === 0) contribute one ticket per refill. Drawing from
   this bag guarantees the exact distribution configured in the admin. */
function rebuildBag() {
  spinBag = [];
  wheelItems.forEach((item, idx) => {
    if (!item.enabled) return;
    if (item.maxWins === 0) {
      spinBag.push(idx);
    } else {
      const remaining = Math.max(0, item.maxWins - item.currentWins);
      for (let i = 0; i < remaining; i++) spinBag.push(idx);
    }
  });
  // Fisher-Yates shuffle
  for (let i = spinBag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [spinBag[i], spinBag[j]] = [spinBag[j], spinBag[i]];
  }
}

/* ----------------- SPIN ----------------- */
function spin() {
  if (isSpinning) return;

  // Refill bag if empty (first spin, or after the previous bag is drained).
  if (spinBag.length === 0) rebuildBag();

  // Pop the next ticket that still corresponds to a non-exhausted item.
  let winnerIdx;
  while (spinBag.length > 0) {
    const candidate = spinBag.shift();
    if (!isExhausted(wheelItems[candidate])) { winnerIdx = candidate; break; }
  }
  if (winnerIdx === undefined) return;     // every item exhausted

  isSpinning = true;
  spinBtn.disabled = true;

  analytics.totalPlays++;
  saveAnalytics();

  const TWO_PI = Math.PI * 2;
  const n = wheelItems.length;
  const arc = TWO_PI / n;
  // `turns` MUST be an integer — any fractional part adds a leftover rotation
  // to the final angle and the winner lands offset from the arrow.
  const turns = 6 + Math.floor(Math.random() * 3);   // 6, 7, or 8 full spins
  const targetSeg = -winnerIdx * arc;                // exact rest angle (winner slice centered at top)
  const final = (TWO_PI * turns) + targetSeg;
  const start = currentRotation;
  const delta = final - (start % TWO_PI);

  playSound(spinSound);

  const duration = 5200;
  const t0 = performance.now();

  function animate(now) {
    const t = Math.min(1, (now - t0) / duration);
    const eased = easeOutCubic(t);
    if (t < 1) {
      currentRotation = start + delta * eased;
      drawWheel(currentRotation);
      requestAnimationFrame(animate);
    } else {
      // Snap exactly to the target so floating-point easing error can't
      // leave the winner's slice a hair off-center under the arrow.
      currentRotation = ((targetSeg % TWO_PI) + TWO_PI) % TWO_PI;
      drawWheel(currentRotation);
      onWin(winnerIdx);
    }
  }
  requestAnimationFrame(animate);
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function onWin(idx) {
  const item = wheelItems[idx];
  item.currentWins++;
  analytics.totalWins++;
  persistState();
  saveAnalytics();

  playSound(winSound);
  launchConfetti();

  showVideoReward(item);
}

/* ----------------- WINNER IMAGE REWARD ----------------- */
function showVideoReward(item) {
  const src = item.winnerImage || item.image;
  if (!src) { finishSpin(); return; }

  rewardImage.src = src;
  videoOverlay.classList.add('active');

  setTimeout(() => {
    videoOverlay.classList.remove('active');
    rewardImage.removeAttribute('src');
    finishSpin();
  }, (GAME_OPTIONS.winnerDuration || 5) * 1000);
}

function finishSpin() {
  isSpinning = false;
  spinBtn.disabled = false;
  drawWheel(currentRotation);
}

/* ----------------- PAGE SWITCHING ----------------- */
function switchPage(target) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  target.classList.add('active');
  if (target === gamePage) {
    setTimeout(() => {
      setupHiDPICanvas();
      drawWheel(currentRotation);
      requestFullscreenIfPossible();
    }, 100);
  }
}

function requestFullscreenIfPossible() {
  const el = document.documentElement;
  if (document.fullscreenElement) return;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (req) { try { req.call(el).catch(() => {}); } catch (e) { /* ignore */ } }
}

/* ----------------- SOUND ----------------- */
function playSound(audioEl) {
  if (!audioEl || !audioEl.src) return;
  if (typeof soundEnabled !== 'undefined' && !soundEnabled) return;
  try {
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
  } catch (e) { /* ignore */ }
}

/* ----------------- CONFETTI ----------------- */
let confettiPieces = [];
let confettiAnimating = false;

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
resizeConfetti();

function launchConfetti() {
  const cctx = confettiCanvas.getContext('2d');
  const colors = ['#ff2e9a', '#00e5ff', '#ffcc33', '#8a2be2', '#00ff88'];
  confettiPieces = [];
  for (let i = 0; i < 160; i++) {
    confettiPieces.push({
      x: Math.random() * confettiCanvas.width,
      y: -20 - Math.random() * confettiCanvas.height,
      r: 3 + Math.random() * 6,
      c: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.2
    });
  }
  if (!confettiAnimating) {
    confettiAnimating = true;
    requestAnimationFrame(animateConfetti);
  }
  setTimeout(() => { confettiPieces = []; }, 4000);

  function animateConfetti() {
    cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiPieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      cctx.save();
      cctx.translate(p.x, p.y);
      cctx.rotate(p.rot);
      cctx.fillStyle = p.c;
      cctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.5);
      cctx.restore();
    });
    confettiPieces = confettiPieces.filter(p => p.y < confettiCanvas.height + 20);
    if (confettiPieces.length > 0) {
      requestAnimationFrame(animateConfetti);
    } else {
      cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiAnimating = false;
    }
  }
}

/* ----------------- TOUCH OPTIMIZATION ----------------- */
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());
