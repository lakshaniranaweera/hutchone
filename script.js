/* =========================================================
   SPIN & WIN — 5-Segment Wheel Game
   Canvas wheel, weighted random, hard-coded win caps,
   7-second fullscreen video reward, confetti, sounds.
   =========================================================
   EDIT wheelItems BELOW to customize prizes.
   ========================================================= */

/* ----------------- WHEEL CONFIG (edit me) ----------------- */
const wheelItems = [
  {
    id: 1,
    label: "Prize 1",
    image: "images/prize1.png",
    video: "videos/prize1.mp4",
    color: "#ff2e9a",
    weight: 40,
    maxWins: 3,
    currentWins: 0,
    enabled: true
  },
  {
    id: 2,
    label: "Prize 2",
    image: "images/prize2.png",
    video: "videos/prize2.mp4",
    color: "#00e5ff",
    weight: 25,
    maxWins: 10,
    currentWins: 0,
    enabled: true
  },
  {
    id: 3,
    label: "Grand Prize",
    image: "images/prize3.png",
    video: "videos/prize3.mp4",
    color: "#ffcc33",
    weight: 5,
    maxWins: 1,
    currentWins: 0,
    enabled: true
  },
  {
    id: 4,
    label: "Prize 4",
    image: "images/prize4.png",
    video: "videos/prize4.mp4",
    color: "#8a2be2",
    weight: 15,
    maxWins: 5,
    currentWins: 0,
    enabled: true
  },
  {
    id: 5,
    label: "Try Again",
    image: "images/prize5.png",
    video: "videos/prize5.mp4",
    color: "#00ff88",
    weight: 15,
    maxWins: 0,     // 0 = UNLIMITED
    currentWins: 0,
    enabled: true
  }
];

/* ----------------- GLOBAL OPTIONS ----------------- */
const GAME_OPTIONS = {
  centerLogo:    "images/logo.png",
  spinSound:     "sounds/spin.mp3",
  winSound:      "sounds/win.mp3",
  videoDuration: 7        // seconds (per spec)
};

const STORAGE_KEY   = 'spinwin_state_v2';
const ANALYTICS_KEY = 'spinwin_analytics_v2';

/* ----------------- STATE ----------------- */
let isSpinning = false;
let currentRotation = 0;
let segmentImages = [];

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
const rewardVideo  = $('rewardVideo');
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
    img.crossOrigin = 'anonymous';
    img.src = item.image;
    img.onload = () => drawWheel(currentRotation);
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

    // Label + image
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation + i * arc - Math.PI / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 6;
    ctx.font = `800 ${Math.max(14, radius * 0.08)}px Segoe UI, sans-serif`;
    ctx.fillText(item.label, radius - 22, 6);

    const img = segmentImages[i];
    if (img && img.complete && img.naturalWidth) {
      const size = radius * 0.22;
      ctx.shadowBlur = 0;
      ctx.drawImage(img, radius * 0.45, -size / 2, size, size);
    }
    ctx.restore();
  }

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffcc33';
  ctx.stroke();
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

/* ----------------- SPIN ----------------- */
function spin() {
  if (isSpinning) return;

  // Filter eligible segments — respects hard-coded win caps
  const eligible = wheelItems
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => !isExhausted(item));

  if (eligible.length === 0) return;     // all prizes exhausted

  isSpinning = true;
  spinBtn.disabled = true;

  // Weighted random selection
  const totalW = eligible.reduce((sum, { item }) => sum + Math.max(1, item.weight), 0);
  let r = Math.random() * totalW;
  let winnerIdx = eligible[0].idx;
  for (const { item, idx } of eligible) {
    r -= Math.max(1, item.weight);
    if (r <= 0) { winnerIdx = idx; break; }
  }

  analytics.totalPlays++;
  saveAnalytics();

  const n = wheelItems.length;
  const arc = (Math.PI * 2) / n;
  const turns = 6 + Math.random() * 2;
  const targetSeg = -winnerIdx * arc;
  const final = (Math.PI * 2 * turns) + targetSeg;
  const start = currentRotation;
  const delta = final - (start % (Math.PI * 2));

  playSound(spinSound);

  const duration = 5200;
  const t0 = performance.now();

  function animate(now) {
    const t = Math.min(1, (now - t0) / duration);
    const eased = easeOutCubic(t);
    currentRotation = start + delta * eased;
    drawWheel(currentRotation);
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      currentRotation = currentRotation % (Math.PI * 2);
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

/* ----------------- VIDEO REWARD ----------------- */
function showVideoReward(item) {
  if (!item.video) { finishSpin(); return; }

  rewardVideo.src = item.video;
  rewardVideo.muted = false;
  videoOverlay.classList.add('active');

  const p = rewardVideo.play();
  if (p) p.catch(() => {
    rewardVideo.muted = true;
    rewardVideo.play().catch(() => {});
  });

  setTimeout(() => {
    rewardVideo.pause();
    rewardVideo.removeAttribute('src');
    rewardVideo.load();
    videoOverlay.classList.remove('active');
    finishSpin();
  }, (GAME_OPTIONS.videoDuration || 7) * 1000);
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
