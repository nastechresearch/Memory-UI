import { hudSettings } from "./canvases";

/** Shared performance monitor: measures FPS and picks a render scale so the HUD stays fast. */
export const perf = { fps: 60, auto: 1, reasons: [] as string[] };

const BUDGETS = [0, 1920 * 1080, 3840 * 2160, 7680 * 4320]; // index = quality setting (0 = auto)
export const QUALITY_LABEL = ["AUTO", "HD", "4K", "8K"];

let started = false;
export function startPerf() {
  if (started || typeof window === "undefined") return;
  started = true;
  let last = performance.now(), acc = 0, frames = 0, cool = 0;
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    const dt = now - last; last = now;
    if (dt > 500) return; // tab was hidden
    acc += dt; frames++;
    if (acc < 500) return;
    perf.fps = Math.round((frames * 1000) / acc); acc = 0; frames = 0;
    if (cool > 0) { cool--; return; }
    if (perf.fps < 45 && perf.auto > 0.2) { perf.auto = Math.max(0.2, perf.auto * 0.8); cool = 2; }
    else if (perf.fps > 57 && perf.auto < 1) { perf.auto = Math.min(1, perf.auto * 1.08); cool = 2; }
    const r: string[] = [];
    if (perf.fps < 40) {
      const q = Number(hudSettings.quality);
      if (q === 3) r.push("8K rendering — try 4K or Auto");
      if (Number(hudSettings.density) > 1.5) r.push("High neuron density");
      if (Number(hudSettings.signalCount) > 1.5) r.push("Many signal pulses");
      if (Number(hudSettings.glow) > 2) r.push("Strong glow");
      if (Number(hudSettings.cellDetail) > 1.5 && Number(hudSettings.diving) > 0.5) r.push("Detailed cell close-up");
      if (q === 0 && perf.auto <= 0.21) r.push("Device is at lowest auto quality");
      if (!r.length) r.push("Device GPU is busy");
    }
    perf.reasons = r;
  };
  requestAnimationFrame(loop);
}

/** Device-pixel ratio to use for a canvas of w×h CSS px, capped by the quality budget. */
export function dprFor(w: number, h: number) {
  const q = Math.round(Number(hudSettings.quality) || 0);
  const native = Math.min(window.devicePixelRatio || 1, q === 3 ? 4 : 2);
  const budget = q === 0 ? BUDGETS[2]! * perf.auto * perf.auto : BUDGETS[q]!;
  const area = Math.max(1, w * h);
  const cap = Math.sqrt(budget / area);
  return Math.max(0.35, Math.min(native, cap));
}
