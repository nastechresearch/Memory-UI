/** Subtle WebAudio HUD sounds. Synthesized on the fly — no assets, no autoplay before a user gesture. */
import { hudSettings } from "./canvases";

let ctx: AudioContext | null = null;
let inited = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Create/resume the AudioContext on the first user gesture (autoplay policy). */
export function initSound() {
  if (inited || typeof window === "undefined") return;
  inited = true;
  window.addEventListener("pointerdown", () => ac());
  window.addEventListener("keydown", () => ac());
}

function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number) {
  if (!hudSettings.sound) return;
  const a = ac();
  if (!a || a.state !== "running") return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, a.currentTime);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), a.currentTime + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.linearRampToValueAtTime(vol, a.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur + 0.05);
}

export const sfx = {
  /** agent-loop step advanced */
  step: () => tone(660 + Math.random() * 120, 520, 0.09, "sine", 0.03),
  /** camera dives into a memory cell */
  dive: () => tone(880, 120, 0.5, "sawtooth", 0.025),
  /** bridge connected */
  connect: () => {
    tone(520, 520, 0.09, "sine", 0.045);
    setTimeout(() => tone(780, 780, 0.14, "sine", 0.045), 90);
  },
  /** bridge lost */
  drop: () => tone(300, 140, 0.25, "triangle", 0.035),
  /** UI click */
  click: () => tone(1400, 1400, 0.03, "square", 0.015),
};
