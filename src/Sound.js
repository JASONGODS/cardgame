// Efek suara dibuat langsung lewat Web Audio API, jadi tidak perlu file mp3.
const KEY = "memory-game-muted";
let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem(KEY) === "1";
} catch {
  /* abaikan jika storage tidak tersedia */
}

export const isMuted = () => muted;

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    /* abaikan */
  }
}

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume(); // browser butuh klik dulu
  return ctx;
}

// Satu nada: frekuensi (Hz), jeda mulai (detik), durasi, bentuk gelombang, volume
function tone({ freq, start = 0, dur = 0.12, type = "sine", vol = 0.2, slideTo }) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  flip: () => tone({ freq: 520, slideTo: 760, dur: 0.08, type: "triangle", vol: 0.18 }),

  // Makin tinggi combo, makin tinggi nadanya
  match: (streak = 1) => {
    const base = 523.25 * 2 ** ((Math.min(streak, 8) - 1) / 6);
    tone({ freq: base, dur: 0.14, type: "triangle" });
    tone({ freq: base * 1.25, start: 0.08, dur: 0.14, type: "triangle" });
    tone({ freq: base * 1.5, start: 0.16, dur: 0.22, type: "triangle" });
  },

  miss: () => tone({ freq: 220, slideTo: 130, dur: 0.28, type: "sawtooth", vol: 0.1 }),

  win: () =>
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      tone({ freq, start: i * 0.12, dur: i === 3 ? 0.5 : 0.15, type: "square", vol: 0.1 })
    ),
};