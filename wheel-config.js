/* =========================================================
   SHARED WHEEL CONFIG
   Single source of truth for prize definitions.
   Loaded by both the game (script.js) and the admin (admin.js).
   ========================================================= */

const wheelItems = [
  {
    id: 1,
    label: "Cap",
    image: "images/Cap.png",
    winnerImage: "images/winners/1.png",
    scale: 1.0,            // 1.0 = default size, 1.2 = 20% bigger, 0.8 = 20% smaller
    video: "videos/prize1.mp4",
    color: "#ac263f",
    weight: 60,
    maxWins: 0,
    currentWins: 0,
    enabled: true
  },
  {
    id: 2,
    label: "Try Again",
    image: "images/try.png",
    winnerImage: "images/winners/6.png",
    scale: 1.5,
    video: "videos/prize2.mp4",
    color: "#e98223",
    weight: 25,
    maxWins: 0,
    currentWins: 0,
    enabled: true
  },
  {
    id: 3,
    label: "Notebook",
    image: "images/Book.png",
    winnerImage: "images/winners/5.png",
    scale: 1.0,
    video: "videos/prize3.mp4",
    color: "#bc2c34",
    weight: 5,
    maxWins: 0,
    currentWins: 0,
    enabled: true
  },
  {
    id: 4,
    label: "pen",
    image: "images/Pen.png",
    winnerImage: "images/winners/4.png",
    scale: 1.0,
    video: "videos/prize4.mp4",
    color: "#f0941b",
    weight: 15,
    maxWins: 0,
    currentWins: 0,
    enabled: true
  },
  {
    id: 5,
    label: "Umbrella",
    image: "images/Umbrella.png",
    winnerImage: "images/winners/2.png",
    scale: 1.4,
    video: "videos/prize5.mp4",
    color: "#bc2c34",
    weight: 15,
    maxWins: 0,
    currentWins: 0,
    enabled: true
  },
  {
    id: 6,
    label: "mug",
    image: "images/Mug.png",
    winnerImage: "images/winners/3.png",
    scale: 1.0,
    video: "videos/tryagain.mp4",
    color: "#e98223",
    weight: 20,
    maxWins: 1,
    currentWins: 0,
    enabled: true
  }
];

const GAME_OPTIONS = {
  centerLogo:    "logo.png",
  spinSound:     "sounds/spin.mp3",
  winSound:      "sounds/win.mp3",
  videoDuration: 7,
  winnerDuration: 5
};

/* =========================================================
   UI LAYOUT — positions/size of the on-screen components.
   Adjustable live from the admin panel (no CSS edits / rebuild).
   The game reads these and applies them as CSS variables.
     wheelTop     — vh, space above the wheel (moves it up/down)
     wheelSize    — vw, wheel diameter relative to screen width
     buttonBottom — vh, START button distance from the bottom
   ========================================================= */
const DEFAULT_LAYOUT = {
  wheelTop: 41,
  wheelSize: 86,
  buttonBottom: 22
};

const STORAGE_KEY   = 'spinwin_state_v2';
const ANALYTICS_KEY = 'spinwin_analytics_v2';
const LAYOUT_KEY    = 'spinwin_layout_v1';
