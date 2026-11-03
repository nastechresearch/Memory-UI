import { useEffect, useRef } from "react";
import { hudSettings, REGIONS } from "./canvases";
import { dprFor, perf, startPerf } from "./perf";

const N = (k: string) => Number(hudSettings[k]);
const REGION_COLORS = [[255, 150, 40], [70, 130, 255], [40, 230, 120], [170, 90, 255], [255, 60, 180], [60, 225, 255]];

type P = { x: number; y: number; z: number; reg: number; ph: number; s: number; a: number; nx: number; ny: number; nz: number; st: number };
type V3 = { x: number; y: number; z: number };
/** A space neuron: wired to the brain surface, with soma, dendritic tree and axon. */
type Cell = {
  wire: V3[]; soma: V3; dend: V3[][]; axon: V3[];
  reg: number; size: number; hue: number; ph: number; rot: number; rs: number;
  dr: V3 & { s: number };
  pulses: { p: number; v: number; dir: number }[];
};

function regionOf(x: number, y: number, z: number, part: number) {
  if (part === 1) return 4;
  if (part === 2) return 5;
  if (y < 0.05 && Math.abs(z) > 0.45 && x > -0.6) return 3;
  if (x > 0.35) return 0;
  if (x < -0.55) return 2;
  return 1;
}

/** Gyri/sulci pattern: domain-warped stripes, ~0 on ridge crests. */
function fold(x: number, y: number, z: number) {
  const wx = x + 0.25 * Math.sin(y * 5 + z * 3), wy = y + 0.25 * Math.sin(z * 6 - x * 4), wz = z + 0.2 * Math.sin(x * 5 + y * 2);
  return Math.sin(wx * 8.5 + 2.2 * Math.sin(wy * 6 + wz * 4)) * Math.cos(wy * 7.5 - 1.8 * Math.sin(wz * 5 + wx * 3));
}

/** Lateral-profile cerebrum surface radius scale for a unit direction (x = front, y = up). */
function cerebrumPoint(dx: number, dy: number, dz: number) {
  let x = dx * 1.35, y = dy * 0.92, z = dz * 1.08;
  // flatter frontal underside, temporal lobe hangs lower in the middle-front
  const temporal = Math.exp(-((x - 0.25) ** 2) / 0.18) * (Math.abs(z) > 0.45 ? 1 : 0.4);
  const floor = -0.28 - 0.32 * temporal;
  if (y < floor) y = floor + (y - floor) * 0.25;
  // occipital back is slightly pointed and higher
  if (x < -0.9) y += 0.08 * (-0.9 - x);
  // taller crown toward the parietal area
  if (y > 0) y *= 1 + 0.12 * Math.exp(-((x + 0.15) ** 2) / 0.4);
  // Sylvian fissure: groove separating temporal lobe on lateral sides
  const sylv = y - (-0.05 + (0.55 - x) * -0.35);
  if (Math.abs(z) > 0.5 && x > -0.4 && x < 0.9 && Math.abs(sylv) < 0.06) { x *= 0.94; z *= 0.9; }
  return { x, y: y + 0.15, z };
}

export function makeBrain(d: number) {
  const pts: P[] = [];
  const n = Math.round(11000 * Math.max(0.05, d));
  let guard = 0;
  while (pts.length < n && guard++ < n * 20) {
    const i = pts.length;
    const part = i % 9 === 0 ? 1 : i % 31 === 0 ? 2 : 0;
    let x: number, y: number, z: number;
    if (part === 0) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
      const sq = Math.sqrt(1 - u * u);
      const dx = sq * Math.cos(th), dy = u, dz = sq * Math.sin(th);
      const s = cerebrumPoint(dx, dy, dz);
      const g = fold(s.x, s.y, s.z);
      // keep mostly ridge points so the folds read clearly, sparse fill in the sulci
      if (Math.abs(g) > 0.3 && Math.random() > 0.04) continue;
      const rr = (Math.abs(g) < 0.3 ? 1.0 - Math.abs(g) * 0.15 : 0.9) * (0.97 + Math.random() * 0.03);
      x = s.x * rr; y = (s.y - 0.15) * rr + 0.15; z = s.z * rr;
      // longitudinal fissure between hemispheres (deep at the top)
      if (Math.abs(z) < 0.08 && y > 0.2) continue;
      z += Math.sign(z || 1) * 0.05;
    } else if (part === 1) {
      // cerebellum with horizontal folia
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, sq = Math.sqrt(1 - u * u);
      const yy = u * 0.26;
      if (Math.sin(yy * 70) < 0.1 && Math.random() > 0.15) continue;
      const rr = 0.96 + Math.random() * 0.04;
      x = -0.82 + sq * Math.cos(th) * 0.42 * rr; y = -0.5 + yy * rr; z = sq * Math.sin(th) * 0.62 * rr;
      if (x > -0.5 && y > -0.42) continue; // tuck under occipital lobe
    } else {
      // brainstem
      const k = Math.random(), a = Math.random() * Math.PI * 2;
      x = -0.3 - k * 0.15 + Math.cos(a) * (0.14 - k * 0.03); y = -0.35 - k * 0.85; z = Math.sin(a) * (0.14 - k * 0.03);
    }
    const cx = part === 1 ? -0.82 : part === 2 ? -0.37 : 0, cy = part === 1 ? -0.5 : part === 2 ? y : 0.15;
    const nl = Math.hypot(x - cx, y - cy, z) || 1;
    pts.push({ x, y, z, reg: regionOf(x, y, z, part), ph: Math.random() * 7, s: 1 + Math.random() * 3, a: Math.random() * 6.28, nx: (x - cx) / nl, ny: (y - cy) / nl, nz: z / nl, st: 0 });
  }
  // particle tendrils streaming off the surface
  const surf = pts.length;
  for (let k = 0; k < Math.round(90 * Math.max(0.2, d)); k++) {
    const o = pts[Math.floor(Math.random() * surf)]!;
    let px = o.x, py = o.y, pz = o.z, dx = o.nx, dy = o.ny + 0.3, dz = o.nz;
    const len = 4 + Math.floor(Math.random() * 6);
    for (let j = 1; j <= len; j++) {
      dx += (Math.random() - 0.5) * 0.25; dy += (Math.random() - 0.5) * 0.25; dz += (Math.random() - 0.5) * 0.25;
      const m = Math.hypot(dx, dy, dz) || 1; dx /= m; dy /= m; dz /= m;
      px += dx * 0.03; py += dy * 0.03; pz += dz * 0.03;
      pts.push({ x: px, y: py, z: pz, reg: o.reg, ph: Math.random() * 7, s: 1 + Math.random() * 3, a: 0, nx: 0, ny: 0, nz: 0, st: j / len });
    }
  }
  const links: { a: number; b: number; p: number; v: number }[] = [];
  const L = Math.min(pts.length, 700);
  for (let i = 0; i < L; i++) {
    const a = Math.floor(Math.random() * pts.length);
    let best = -1, bd = 1e9;
    for (let j = 0; j < 40; j++) {
      const c = Math.floor(Math.random() * pts.length);
      if (c === a) continue;
      const pa = pts[a]!, pc = pts[c]!;
      const dd = (pa.x - pc.x) ** 2 + (pa.y - pc.y) ** 2 + (pa.z - pc.z) ** 2;
      if (dd < bd) { bd = dd; best = c; }
    }
    if (best >= 0) links.push({ a, b: best, p: Math.random(), v: 0.003 + Math.random() * 0.012 });
  }
  return { pts, links, cells: makeInterior(pts, d), d };
}

/** Interior layer: anatomically complete neuron cells living INSIDE the brain volume, each wired out to the surface by a fibre that carries travelling pulses. */
function makeInterior(pts: P[], d: number): Cell[] {
  const n = Math.min(20, Math.round(10 * Math.max(0.35, d)));
  const cells: Cell[] = [];
  const surf = pts.filter((p) => !p.st);
  const C = { x: 0, y: 0.15, z: 0 };
  let guard = 0;
  while (cells.length < n && guard++ < n * 40) {
    const o = surf[Math.floor(Math.random() * surf.length)]!;
    const dist = Math.hypot(o.x - C.x, o.y - C.y, o.z) || 1;
    const frac = 0.5 + Math.random() * 0.3; // how deep inside the volume the soma sits
    const soma = {
      x: o.x + (C.x - o.x) * frac + (Math.random() - 0.5) * 0.15,
      y: o.y + (C.y - o.y) * frac + (Math.random() - 0.5) * 0.12,
      z: o.z + (C.z - o.z) * frac + (Math.random() - 0.5) * 0.15,
    };
    if (Math.hypot(soma.x - C.x, soma.y - C.y, soma.z - C.z) > dist * 0.65) continue; // must sit well inside, never poke out
    const size = 0.07 + Math.random() * 0.07;
    // wire: noisy fibre from the soma out to its anchor point on the surface
    const steps = 10 + Math.floor(Math.random() * 8);
    const wire: V3[] = [{ ...soma }];
    for (let j = 1; j <= steps; j++) {
      const f = j / steps, wob = (1 - f) * 0.1;
      wire.push({
        x: soma.x + (o.x - soma.x) * f + (Math.random() - 0.5) * wob,
        y: soma.y + (o.y - soma.y) * f + (Math.random() - 0.5) * wob,
        z: soma.z + (o.z - soma.z) * f + (Math.random() - 0.5) * wob,
      });
    }
    wire[wire.length - 1] = { x: o.x, y: o.y, z: o.z };
    // dendritic tree radiating from the soma, kept inside the volume
    const dend: V3[][] = [];
    const arms = 5 + Math.floor(Math.random() * 3);
    for (let k = 0; k < arms; k++) {
      const segs: V3[] = [];
      let ax = Math.random() - 0.5, ay = Math.random() - 0.5, az = Math.random() - 0.5;
      let al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
      let bx = 0, by = 0, bz = 0;
      const nseg = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < nseg; j++) {
        ax += (Math.random() - 0.5) * 0.8; ay += (Math.random() - 0.5) * 0.8; az += (Math.random() - 0.5) * 0.8;
        const m = Math.hypot(ax, ay, az) || 1; ax /= m; ay /= m; az /= m;
        const L = size * (1.1 + Math.random() * 0.9);
        bx += ax * L; by += ay * L; bz += az * L;
        segs.push({ x: bx, y: by, z: bz });
      }
      dend.push(segs);
    }
    // axon running through the interior, folded back toward the centre so it never leaves the brain
    let ax2 = Math.random() - 0.5, ay2 = Math.random() - 0.5, az2 = Math.random() - 0.5;
    let am = Math.hypot(ax2, ay2, az2) || 1; ax2 /= am; ay2 /= am; az2 /= am;
    const axon: V3[] = [];
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < 7 + Math.floor(Math.random() * 4); j++) {
      ax2 += (Math.random() - 0.5) * 0.3; ay2 += (Math.random() - 0.5) * 0.3; az2 += (Math.random() - 0.5) * 0.3;
      const m = Math.hypot(ax2, ay2, az2) || 1; ax2 /= m; ay2 /= m; az2 /= m;
      const L = size * (1.3 + Math.random() * 0.6);
      cx += ax2 * L; cy += ay2 * L; cz += az2 * L;
      const rl = Math.hypot(soma.x + cx - C.x, soma.y + cy - C.y, soma.z + cz - C.z);
      if (rl > dist * 0.85) {
        ax2 -= ((soma.x + cx - C.x) / rl) * 1.2; ay2 -= ((soma.y + cy - C.y) / rl) * 1.2; az2 -= ((soma.z + cz - C.z) / rl) * 1.2;
      }
      axon.push({ x: cx, y: cy, z: cz });
    }
    cells.push({
      wire, soma, dend, axon, size,
      reg: o.reg, hue: o.reg, ph: Math.random() * 7,
      rot: Math.random() * 6.28, rs: (Math.random() - 0.5) * 0.4,
      dr: { x: 0.008 + Math.random() * 0.012, y: 0.008 + Math.random() * 0.012, z: 0.008 + Math.random() * 0.012, s: 0.3 + Math.random() * 0.6 },
      pulses: [0, 1].map(() => ({ p: Math.random(), v: 0.25 + Math.random() * 0.5, dir: Math.random() > 0.5 ? 1 : -1 })),
    });
  }
  return cells;
}

/** Realistic cell body at screen (sx,sy), radius R: wobbly double membrane, cytoplasm, ER, nucleus with nucleolus and chromatin, mitochondria, vesicles. */
function drawSoma(ctx: CanvasRenderingContext2D, sx: number, sy: number, R: number, r: number, g: number, bl: number, alpha: number, fire: number, seed: number, t: number) {
  if (R < 2.5) {
    ctx.fillStyle = `rgba(${r},${g},${bl},${alpha})`;
    ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.6, R), 0, 7); ctx.fill();
    return;
  }
  const wob = (a: number) => 1 + 0.07 * Math.sin(a * 3 + seed) + 0.04 * Math.sin(a * 5 + seed * 2.3) + 0.025 * Math.sin(a * 9 + t * 1.5);
  const blob = (rad: number) => {
    ctx.beginPath();
    for (let k = 0; k <= 26; k++) {
      const an = (k / 26) * 6.283, rr = rad * wob(an);
      const X = sx + Math.cos(an) * rr, Y = sy + Math.sin(an) * rr;
      if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    }
    ctx.closePath();
  };
  // cytoplasm
  const cg = ctx.createRadialGradient(sx - R * 0.25, sy - R * 0.3, R * 0.08, sx, sy, R);
  cg.addColorStop(0, `rgba(${Math.min(255, r + 70)},${Math.min(255, g + 55)},${Math.min(255, bl + 40)},${0.92 * alpha})`);
  cg.addColorStop(0.55, `rgba(${r},${g},${bl},${0.78 * alpha})`);
  cg.addColorStop(1, `rgba(${(r * 0.45) | 0},${(g * 0.45) | 0},${(bl * 0.6) | 0},${0.88 * alpha})`);
  ctx.fillStyle = cg; blob(R); ctx.fill();
  // double membrane
  ctx.strokeStyle = `rgba(${r >> 2},${g >> 2},${bl >> 2},${0.9 * alpha})`; ctx.lineWidth = Math.max(0.6, R * 0.07); blob(R); ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${0.16 * alpha})`; ctx.lineWidth = Math.max(0.4, R * 0.03); blob(R * 0.86); ctx.stroke();
  // endoplasmic reticulum arcs
  ctx.strokeStyle = `rgba(${r >> 1},${(g * 0.7) | 0},${bl},${0.35 * alpha})`; ctx.lineWidth = Math.max(0.4, R * 0.04);
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.ellipse(sx - R * 0.05 + Math.sin(seed + k) * R * 0.18, sy + Math.cos(seed * 1.7 + k) * R * 0.18, R * (0.16 + k * 0.04), R * (0.1 + k * 0.03), seed + k, 0.4, 4.2);
    ctx.stroke();
  }
  // nucleus + nucleolus + chromatin
  const nx = sx + R * 0.14, ny = sy - R * 0.06, nr = R * 0.4;
  const ng = ctx.createRadialGradient(nx - nr * 0.3, ny - nr * 0.3, nr * 0.15, nx, ny, nr);
  ng.addColorStop(0, `rgba(${(r * 0.55) | 0},${(g * 0.5) | 0},${Math.min(255, bl + 10)},${0.9 * alpha})`);
  ng.addColorStop(1, `rgba(${(r * 0.3) | 0},${(g * 0.3) | 0},${(bl * 0.55) | 0},${0.95 * alpha})`);
  ctx.fillStyle = ng;
  ctx.beginPath(); ctx.ellipse(nx, ny, nr, nr * 0.88, seed, 0, 7); ctx.fill();
  ctx.strokeStyle = `rgba(${r >> 2},${g >> 2},${bl >> 2},${0.8 * alpha})`; ctx.lineWidth = Math.max(0.5, R * 0.05); ctx.stroke();
  ctx.fillStyle = `rgba(${Math.min(255, r + 90)},${Math.min(255, g + 70)},255,${0.85 * alpha})`;
  ctx.beginPath(); ctx.arc(nx + nr * 0.25, ny + nr * 0.1, nr * 0.26, 0, 7); ctx.fill();
  ctx.fillStyle = `rgba(${(r * 0.35) | 0},${(g * 0.35) | 0},${(bl * 0.5) | 0},${0.5 * alpha})`;
  for (let k = 0; k < 5; k++) {
    const a = seed * 2 + k * 2.4;
    ctx.beginPath(); ctx.arc(nx + Math.cos(a) * nr * 0.55, ny + Math.sin(a) * nr * 0.45, nr * 0.07, 0, 7); ctx.fill();
  }
  // mitochondria with cristae
  for (let k = 0; k < 3; k++) {
    const a = seed * 1.3 + k * 2.1;
    const mx = sx + Math.cos(a) * R * 0.55, my = sy + Math.sin(a) * R * 0.5;
    const mr = R * (0.14 + 0.04 * ((k * 7) % 3));
    ctx.save(); ctx.translate(mx, my); ctx.rotate(a);
    ctx.fillStyle = `rgba(${Math.min(255, r + 40)},${Math.min(255, g + 80)},${(bl * 0.7) | 0},${0.55 * alpha})`;
    ctx.beginPath(); ctx.ellipse(0, 0, mr, mr * 0.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = `rgba(${(r * 0.5) | 0},${(g * 0.55) | 0},${(bl * 0.8) | 0},${0.6 * alpha})`;
    ctx.lineWidth = Math.max(0.3, mr * 0.18);
    for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.moveTo(j * mr * 0.45, -mr * 0.4); ctx.quadraticCurveTo(j * mr * 0.45 + mr * 0.15, 0, j * mr * 0.45, mr * 0.4); ctx.stroke(); }
    ctx.restore();
  }
  // vesicles
  ctx.fillStyle = `rgba(255,255,255,${0.28 * alpha})`;
  for (let k = 0; k < 4; k++) {
    const a = seed * 3.1 + k * 1.9;
    ctx.beginPath(); ctx.arc(sx + Math.cos(a) * R * 0.62, sy + Math.sin(a) * R * 0.58, Math.max(0.5, R * 0.05), 0, 7); ctx.fill();
  }
  if (fire > 0.9) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, (fire - 0.9) * 5) * alpha})`;
    blob(R * 1.05); ctx.fill();
  }
}

/** Real 3D point-cloud brain: drag to rotate, wheel/pinch to zoom, dives into cells while thinking. */
export function Brain3D({ onPick }: { onPick?: (region: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const view = useRef({ yaw: 0.2, pitchOff: 0, zoomMul: 1, dragging: false, lx: 0, ly: 0, moved: 0, pinch: 0 });

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    startPerf();
    let w = 0, h = 0, raf = 0, last = performance.now(), t = 0, dpr = 1, frame = 0, lastFilter = "";
    let autoDens = 1;
    let brain = makeBrain(Math.round(N("density") * 10) / 10);
    const cam = { fx: 0, fy: 0, fz: 0, z: 1, dive: 0, diveT: -4, target: { x: 0, y: 0, z: 0 } };
    const resize = () => {
      w = c.clientWidth; h = c.clientHeight; dpr = dprFor(w, h);
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(c);

    // interaction
    const v = view.current;
    const pointers = new Map<number, { x: number; y: number }>();
    const down = (e: PointerEvent) => { c.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); v.moved = 0; hudSettings.brainActive = 1; };
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId); if (!p) return;
      if (pointers.size === 2) {
        const [a, b2] = [...pointers.values()];
        const d0 = Math.hypot(a!.x - b2!.x, a!.y - b2!.y);
        p.x = e.clientX; p.y = e.clientY;
        const [a2, b3] = [...pointers.values()];
        const d1 = Math.hypot(a2!.x - b3!.x, a2!.y - b3!.y);
        if (d0 > 0) v.zoomMul = Math.min(20, Math.max(0.2, v.zoomMul * (d1 / d0)));
        v.moved += 10; return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      v.yaw += dx * 0.008; v.pitchOff = Math.max(-1.4, Math.min(1.4, v.pitchOff + dy * 0.006));
      v.moved += Math.abs(dx) + Math.abs(dy);
      p.x = e.clientX; p.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (!pointers.size) hudSettings.brainActive = 0;
      if (v.moved < 4 && onPick) {
        // pick nearest projected point's region
        const rect = c.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        let best = -1, bd = 900;
        for (const q of proj) { const dd = (q.sx - mx) ** 2 + (q.sy - my) ** 2; if (dd < bd) { bd = dd; best = q.reg; } }
        onPick(best);
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      v.zoomMul = Math.min(20, Math.max(0.2, v.zoomMul * Math.exp(-dy * 0.0015)));
    };
    c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
    c.addEventListener("wheel", wheel, { passive: false });

    let proj: { sx: number; sy: number; reg: number }[] = [];
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      if (hudSettings.paused) return;
      if (++frame % 20 === 0) { const nd = dprFor(w, h); if (Math.abs(nd - dpr) / dpr > 0.1) resize(); }
      const sp = N("speed"); t += dt * sp;
      if (frame % 60 === 0 && frame > 120) {
        if (perf.fps < 42) autoDens = Math.max(0.3, autoDens * 0.8);
        else if (perf.fps > 57 && autoDens < 1) autoDens = Math.min(1, autoDens * 1.1);
      }
      const effD = Math.round(N("density") * autoDens * 10) / 10;
      if (brain.d !== effD) brain = makeBrain(effD);
      if (hudSettings.autoRotate && !pointers.size) v.yaw += dt * N("rotateSpeed") * 0.4 * sp;

      // thinking dive: pick a cell, zoom in, hold, zoom out
      const region = hudSettings.region;
      const every = Math.max(0.5, N("diveEvery"));
      if (hudSettings.thinkDive) {
        cam.diveT += dt * sp;
        if (cam.diveT > every) {
          cam.diveT = 0;
          let pool = region >= 0 ? brain.cells.filter((c) => c.reg === region) : brain.cells;
          if (!pool.length) pool = brain.cells;
          const pick = pool[Math.floor(Math.random() * pool.length)];
          if (pick) { cam.target = { x: pick.soma.x, y: pick.soma.y, z: pick.soma.z }; hudSettings.diveCount = Number(hudSettings.diveCount) + 1; hudSettings.diveRegion = pick.reg; }
        }
        const ph = Math.max(0, cam.diveT) / every; // 0..1
        cam.dive = ph < 0.35 ? ph / 0.35 : ph < 0.7 ? 1 : Math.max(0, 1 - (ph - 0.7) / 0.3);
        cam.dive = cam.dive * cam.dive * (3 - 2 * cam.dive);
      } else cam.dive = Math.max(0, cam.dive - dt);
      let focus = cam.target;
      if (region >= 0 && !hudSettings.thinkDive) {
        const r = REGIONS[region]!; // map region center roughly
        focus = { x: (0.5 - r.x) * -2.6, y: (0.45 - r.y) * 2, z: 0 };
      }
      const zoom = Math.max(0.05, N("zoom")) * v.zoomMul * (1 + cam.dive * N("diveDepth"));
      const fw = region >= 0 && !hudSettings.thinkDive ? 0.6 : cam.dive;
      cam.fx += (focus.x * fw - cam.fx) * 0.08; cam.fy += (focus.y * fw - cam.fy) * 0.08; cam.fz += (focus.z * fw - cam.fz) * 0.08;

      const pitch = N("pitch") + v.pitchOff;
      const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(pitch), sp2 = Math.sin(pitch);
      const D = 4, f0 = Math.min(w, h) * 0.25;
      // the brain sits small in the upper left; the space around it holds the wired cells
      const portrait = h > w;
      const bx = portrait ? w * 0.5 : w * 0.34, by = h * (portrait ? 0.32 : 0.36), sc = portrait ? 0.55 : 0.62;
      const P = (p: { x: number; y: number; z: number }) => {
        const x = p.x - cam.fx, y = p.y - cam.fy, z = p.z - cam.fz;
        const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
        const y1 = y * cp - z1 * sp2, z2 = y * sp2 + z1 * cp;
        const zz = z2 * zoom;
        if (zz > D - 0.15) return null;
        const k = (f0 * D) / (D - zz);
        return { sx: bx + x1 * zoom * k * sc, sy: by - y1 * zoom * k * sc, k: k * sc, zz };
      };

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      // CSS filter on the element is GPU-composited; ctx.filter per frame was the main slowdown
      const f = `hue-rotate(${N("hue")}deg) saturate(${N("saturation")}) brightness(${N("brightness")})`;
      if (f !== lastFilter) { c.style.filter = f; lastFilter = f; }
      ctx.globalCompositeOperation = "lighter";
      const glow = N("glow"), psz = N("pointSize"), cellDetail = N("cellDetail");

      // links + pulses
      const lc = Math.round(brain.links.length * Math.min(1, N("linkDist") / 1.5));
      for (let i = 0; i < lc; i++) {
        const l = brain.links[i]!;
        const a = brain.pts[l.a]!, b = brain.pts[l.b]!;
        const pa = P(a), pb = P(b); if (!pa || !pb) continue;
        const [r, g, bl] = REGION_COLORS[a.reg]!;
        const dim = region >= 0 && a.reg !== region ? 0.25 : 1;
        ctx.strokeStyle = `rgba(${r},${g},${bl},${0.05 * dim * glow})`; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(pa.sx, pa.sy); ctx.lineTo(pb.sx, pb.sy); ctx.stroke();
        if (hudSettings.signals && i < lc * Math.min(1, N("signalCount") / 2)) {
          l.p += l.v * N("signalSpeed") * sp; if (l.p > 1) l.p = 0;
          const x = pa.sx + (pb.sx - pa.sx) * l.p, y = pa.sy + (pb.sy - pa.sy) * l.p;
          ctx.fillStyle = `rgba(220,255,250,${0.35 * dim})`;
          ctx.beginPath(); ctx.arc(x, y, 0.8 + glow * 0.3, 0, 7); ctx.fill();
        }
      }

      // neurons
      ctx.globalCompositeOperation = "source-over";
      const newProj: typeof proj = [];
      for (const p of brain.pts) {
        let face = 1;
        if (!p.st) {
          const nx1 = p.nx * cy + p.nz * sy, nz1 = -p.nx * sy + p.nz * cy;
          const fz = p.ny * sp2 + nz1 * cp; // >0 faces camera
          if (fz < -0.25) continue;
          face = 0.55 + 0.45 * Math.max(0, fz) + 0.15 * Math.max(0, p.ny * cp - nz1 * sp2) + 0 * nx1;
        }
        const q = P(p); if (!q) continue;
        const gx = Math.max(0, Math.min(1, (p.x + 1.3) / 2.6));
        const r = Math.round(150 - 80 * gx), g = Math.round(90 + 150 * gx), bl = Math.round(255 - 40 * gx);
        const dim = region >= 0 && p.reg !== region ? 0.25 : 1;
        const fire = 0.5 + 0.5 * Math.sin(t * p.s + p.ph);
        const depth = Math.max(0.15, Math.min(1, (q.zz + 2) / 3));
        const size = Math.max(0.3, (q.k / (Math.min(w, h) * 0.3)) * zoom * 1.7 * psz);
        if (newProj.length < 1500 && size > 0.5) newProj.push({ sx: q.sx, sy: q.sy, reg: p.reg });
        if (size > 7 && cellDetail > 0) {
          // zoomed into a cell: soma + dendrites + axon
          const R = size * 0.6;
          ctx.strokeStyle = `rgba(${r},${g},${bl},${0.55 * dim})`; ctx.lineWidth = Math.max(0.6, R * 0.08);
          const arms = Math.round(4 + cellDetail * 2);
          for (let k = 0; k < arms; k++) {
            const ang = p.a + (k / arms) * 6.28 + Math.sin(t + k) * 0.08;
            const len = R * (2.5 + ((k * 37) % 5) * 0.6) * (0.9 + 0.1 * fire);
            ctx.beginPath(); ctx.moveTo(q.sx, q.sy);
            ctx.quadraticCurveTo(q.sx + Math.cos(ang + 0.4) * len * 0.5, q.sy + Math.sin(ang + 0.4) * len * 0.5, q.sx + Math.cos(ang) * len, q.sy + Math.sin(ang) * len);
            ctx.stroke();
          }
          // dendrite branches
          for (let k = 0; k < arms; k++) {
            const ang = p.a + (k / arms) * 6.28;
            const len = R * (2.5 + ((k * 37) % 5) * 0.6);
            const bx = q.sx + Math.cos(ang) * len * 0.6, by = q.sy + Math.sin(ang) * len * 0.6;
            ctx.lineWidth = Math.max(0.4, R * 0.04);
            for (const s2 of [-0.7, 0.7]) {
              ctx.beginPath(); ctx.moveTo(bx, by);
              ctx.lineTo(bx + Math.cos(ang + s2) * len * 0.45, by + Math.sin(ang + s2) * len * 0.45); ctx.stroke();
            }
          }
          // soma: realistic cell body — membrane, nucleus, organelles
          drawSoma(ctx, q.sx, q.sy, R, r, g, bl, dim, fire, p.a, t);
        } else if (p.st) {
          ctx.fillStyle = `rgba(${r},${g},${bl},${(1 - p.st) * dim * (0.5 + 0.5 * fire)})`;
          ctx.beginPath(); ctx.arc(q.sx, q.sy, size * 0.7 * (1 - p.st * 0.6), 0, 7); ctx.fill();
        } else {
          const rad = size * (0.9 + fire * glow * 0.25);
          ctx.fillStyle = `rgba(${Math.round(r * face)},${Math.round(g * face)},${Math.round(bl * face)},${(0.75 + 0.25 * fire) * dim})`;
          ctx.beginPath(); ctx.arc(q.sx, q.sy, rad, 0, 7); ctx.fill();
          if (fire > 0.985 && glow > 0) {
            ctx.fillStyle = `rgba(255,255,255,${0.7 * dim})`;
            ctx.beginPath(); ctx.arc(q.sx, q.sy, rad * 0.5, 0, 7); ctx.fill();
          }
        }
      }
      proj = newProj;

      // interior layer: real neuron cells living inside the brain, wired out to the surface, firing pulses along their fibres
      const sA = Math.min(1, 0.45 + cam.dive * 0.9);
      if (brain.cells.length) {
        const cellDrift = (c: Cell) => ({
          x: Math.sin(t * c.dr.s + c.ph) * c.dr.x,
          y: Math.sin(t * c.dr.s * 1.3 + c.ph * 2) * c.dr.y,
          z: Math.cos(t * c.dr.s + c.ph) * c.dr.z,
        });
        ctx.globalCompositeOperation = "lighter";
        for (const c of brain.cells) {
          const [r = 255, g = 128, bl = 255] = REGION_COLORS[c.hue]!;
          const dO = cellDrift(c);
          const wn = c.wire.length;
          const wpts: (ReturnType<typeof P>)[] = [];
          let prev: ReturnType<typeof P> | null = null;
          for (let j = 0; j < wn; j++) {
            const wp = c.wire[j]!;
            const f = j / (wn - 1);
            const q = P({ x: wp.x + dO.x * f, y: wp.y + dO.y * f, z: wp.z + dO.z * f });
            wpts.push(q);
            if (q && prev) {
              ctx.strokeStyle = `rgba(${r},${g},${bl},${0.1 * sA * glow})`; ctx.lineWidth = 0.7;
              ctx.beginPath(); ctx.moveTo(prev.sx, prev.sy); ctx.lineTo(q.sx, q.sy); ctx.stroke();
            }
            prev = q;
          }
          for (const pu of c.pulses) {
            pu.p += pu.v * N("signalSpeed") * sp * dt * (pu.dir > 0 ? 1 : -1);
            if (pu.p > 1) { pu.p = 1; pu.dir = -1; pu.v = 0.25 + Math.random() * 0.5; }
            if (pu.p < 0) { pu.p = 0; pu.dir = 1; pu.v = 0.25 + Math.random() * 0.5; }
            const fi = pu.p * (wn - 1), i0 = Math.floor(fi);
            const a = wpts[Math.min(wn - 1, i0)]!, b2 = wpts[Math.min(wn - 1, i0 + 1)]!;
            if (a && b2) {
              const f2 = fi - i0;
              ctx.fillStyle = `rgba(235,255,250,${0.55 * sA})`;
              ctx.beginPath(); ctx.arc(a.sx + (b2.sx - a.sx) * f2, a.sy + (b2.sy - a.sy) * f2, 1.2 + glow * 0.4, 0, 7); ctx.fill();
            }
          }
        }
        // cell bodies: soma + dendritic tree + axon, drawn with real cell anatomy
        ctx.globalCompositeOperation = "source-over";
        for (const c of brain.cells) {
          const [r = 255, g = 128, bl = 255] = REGION_COLORS[c.hue]!;
          const dO = cellDrift(c);
          const sp3 = { x: c.soma.x + dO.x, y: c.soma.y + dO.y, z: c.soma.z + dO.z };
          const q = P(sp3); if (!q) continue;
          const R = c.size * zoom * q.k;
          if (R < 3) {
            ctx.fillStyle = `rgba(${r},${g},${bl},${0.8 * sA})`;
            ctx.beginPath(); ctx.arc(q.sx, q.sy, Math.max(0.6, R), 0, 7); ctx.fill();
            continue;
          }
          const fire = 0.5 + 0.5 * Math.sin(t * 1.6 + c.ph);
          const rot = c.rot + t * c.rs;
          const cr = Math.cos(rot), srr = Math.sin(rot);
          const rp = (o: V3) => {
            const x1 = o.x * cr + o.z * srr, z1 = -o.x * srr + o.z * cr;
            return P({ x: sp3.x + x1, y: sp3.y + o.y, z: sp3.z + z1 });
          };
          // axon with synaptic boutons at the terminal
          ctx.strokeStyle = `rgba(${r},${g},${bl},${0.35 * sA})`; ctx.lineWidth = Math.max(0.6, R * 0.12);
          let prev = q;
          for (const a of c.axon) { const qp = rp(a); if (qp) { ctx.beginPath(); ctx.moveTo(prev.sx, prev.sy); ctx.lineTo(qp.sx, qp.sy); ctx.stroke(); prev = qp; } }
          const lastAx = c.axon[c.axon.length - 1]!;
          const lq = rp(lastAx);
          if (lq) for (let k2 = 0; k2 < 3; k2++) {
            const a2 = c.ph + k2 * 2.1;
            ctx.fillStyle = `rgba(${r},${g},${bl},${0.5 * sA})`;
            ctx.beginPath(); ctx.arc(lq.sx + Math.cos(a2) * R * 0.3, lq.sy + Math.sin(a2) * R * 0.3, Math.max(0.8, R * 0.14), 0, 7); ctx.fill();
          }
          // dendrites with little spines along the branches
          ctx.lineWidth = Math.max(0.5, R * 0.08);
          for (const segs of c.dend) {
            let p0 = q;
            for (let si = 0; si < segs.length; si++) {
              const qp = rp(segs[si]!); if (!qp) continue;
              ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(qp.sx, qp.sy); ctx.stroke();
              if (si > 0) {
                ctx.fillStyle = `rgba(${r},${g},${bl},${0.45 * sA})`;
                ctx.beginPath(); ctx.arc(qp.sx, qp.sy, Math.max(0.5, R * 0.05), 0, 7); ctx.fill();
              }
              p0 = qp;
            }
          }
          // soma: realistic cell body — double membrane, nucleus, organelles
          drawSoma(ctx, q.sx, q.sy, R, r, g, bl, sA, fire, c.ph, t);
        }
      }

      if (hudSettings.scan) {
        const Rmax = Math.max(w, h) * 0.6;
        const R = ((t * 0.25 * N("scanSpeed")) % 1) * Rmax * sc;
        ctx.strokeStyle = `rgba(56,225,255,${0.4 * (1 - R / Rmax)})`;
        ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(bx, by, Math.max(0, R), Math.max(0, R * 0.6), 0, 0, 7); ctx.stroke();
      }
      ctx.restore();
      hudSettings.camZoom = zoom; hudSettings.diving = cam.dive;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      c.removeEventListener("pointerdown", down); c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up); c.removeEventListener("pointercancel", up);
      c.removeEventListener("wheel", wheel);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing" aria-label="3D brain: drag to rotate, scroll or pinch to zoom" />;
}
