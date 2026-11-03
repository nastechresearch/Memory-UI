import { useEffect, useRef } from "react";

/** Live-tunable settings read every frame by all canvases */
import { DEFAULTS } from "./settings";
import { dprFor } from "./perf";
export const hudSettings: Record<string, any> & { region: number } = { ...DEFAULTS, region: -1, thinking: 0, diveCount: 0 };
const N = (k: string) => Number(hudSettings[k]);

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, state: any) => void;

function useCanvas(draw: Draw, init?: (w: number, h: number) => any) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    let state: any = null;
    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      w = c.clientWidth; h = c.clientHeight;
      dpr = dprFor(w, h);
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state = init ? init(w, h) : null;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    let last = performance.now(), t = 0, check = 0;
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      if (++check % 30 === 0) { const nd = dprFor(w, h); if (Math.abs(nd - dpr) / dpr > 0.1) { dpr = nd; c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); } }
      if (!hudSettings.paused) { t += dt * hudSettings.speed; draw(ctx, w, h, t, state); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return ref;
}

/** Brain regions in normalized image coords (for hotspots + extraction) */
export const REGIONS = [
  { name: "Frontal Lobe", role: "Reasoning · Planning · Decision making", x: 0.27, y: 0.33, rx: 0.15, ry: 0.2, hue: 3, stat: "Executive control" },
  { name: "Parietal Lobe", role: "Spatial processing · Sensory integration · Attention", x: 0.55, y: 0.18, rx: 0.15, ry: 0.13, hue: 5, stat: "Attention binding" },
  { name: "Occipital Lobe", role: "Visual processing · Image recognition", x: 0.8, y: 0.38, rx: 0.1, ry: 0.17, hue: 2, stat: "Vision pipeline" },
  { name: "Temporal Lobe", role: "Memory formation · Language · Pattern recognition", x: 0.5, y: 0.5, rx: 0.2, ry: 0.09, hue: 1, stat: "Hippocampal encoding" },
  { name: "Cerebellum", role: "Motor control · Skill learning · Timing", x: 0.71, y: 0.67, rx: 0.1, ry: 0.08, hue: 4, stat: "Procedural memory" },
  { name: "Brain Stem", role: "Vital functions · Arousal · Neurotransmitters", x: 0.6, y: 0.85, rx: 0.05, ry: 0.12, hue: 0, stat: "Signal relay" },
];

const PALETTE = ["#38e1ff", "#a855f7", "#22e57a", "#ffa630", "#ff3fb4", "#4d7cff"];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Sparks + travelling signals over the brain photo */
export function BrainOverlay() {
  const ref = useCanvas(
    (ctx, w, h, t, s) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      // links + pulses
      if (s.d !== hudSettings.density) Object.assign(s, s.mk(hudSettings.density));
      for (const l of hudSettings.signals ? s.links : []) {
        const a = s.nodes[l.a], b = s.nodes[l.b];
        ctx.strokeStyle = a.c + "22"; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        l.p += l.v * N("signalSpeed"); if (l.p > 1) { l.p = 0; l.v = rnd(0.004, 0.02); }
        const x = a.x + (b.x - a.x) * l.p, y = a.y + (b.y - a.y) * l.p;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 6);
        g.addColorStop(0, "#ffffff"); g.addColorStop(0.3, a.c); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
      }
      for (const n of s.nodes) {
        const f = 0.5 + 0.5 * Math.sin(t * n.s + n.ph);
        const hot = hudSettings.region >= 0 && n.reg === hudSettings.region;
        const r = (2 + f * 9) * N("glow") * (hot ? 1.8 : hudSettings.region >= 0 ? 0.5 : 1);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 2);
        g.addColorStop(0, "#fff"); g.addColorStop(0.25, n.c); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.globalAlpha = 0.35 + f * 0.65;
        ctx.beginPath(); ctx.arc(n.x, n.y, r * 2, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (hudSettings.scan) {
      const cx = w * 0.5, cy = h * 0.45, R = ((t * 0.25 * N("scanSpeed")) % 1) * Math.max(w, h) * 0.6;
      ctx.strokeStyle = `rgba(56,225,255,${0.4 * (1 - R / (Math.max(w, h) * 0.6))})`;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0, R), Math.max(0, R * 0.7), 0, 0, 7); ctx.stroke(); }
      ctx.globalCompositeOperation = "source-over";
    },
    (w, h) => {
      const mk = (d: number) => {
      const nodes = Array.from({ length: Math.round(70 * d) }, () => {
        // sample within brain ellipse
        const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random());
        const x = w * 0.5 + Math.cos(ang) * rr * w * 0.36;
        const y = h * 0.4 + Math.sin(ang) * rr * h * 0.3;
        const c = PALETTE[[3, 3, 1, 5, 0, 2, 4][Math.max(0, Math.min(6, Math.floor((x / w) * 7)))] ?? 0]!;
        const reg = REGIONS.findIndex((r) => Math.hypot((x / w - r.x) / r.rx, (y / h - r.y) / r.ry) < 1);
        return { x, y, c, s: rnd(1, 4), ph: rnd(0, 7), reg };
      });
      const links = Array.from({ length: Math.round(60 * d) }, () => {
        const a = Math.floor(Math.random() * nodes.length);
        let b = a, best = 1e9;
        for (let i = 0; i < nodes.length; i++) {
          if (i === a) continue;
          const d = Math.hypot(nodes[i]!.x - nodes[a]!.x, nodes[i]!.y - nodes[a]!.y) * rnd(0.6, 1.4);
          if (d < best) { best = d; b = i; }
        }
        return { a, b, p: Math.random(), v: rnd(0.004, 0.02) };
      });
      return { nodes, links, d };
      };
      return { ...mk(hudSettings.density), mk };
    },
  );
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

/** Live scrolling waveform */
export function Wave({ color = "#38e1ff", speed = 1, amp = 1 }: { color?: string; speed?: number; amp?: number }) {
  const ref = useCanvas(
    (ctx, w, h, t, s) => {
      s.acc += speed;
      while (s.acc > 1) {
        s.acc -= 1;
        s.data.shift();
        s.data.push((Math.sin(t * 9) * 0.3 + (Math.random() - 0.5) * 1.2 + (Math.random() > 0.94 ? rnd(-1, 1) * 1.6 : 0)) * amp * N("waveAmp"));
      }
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color + "22"; ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.beginPath();
      s.data.forEach((v: number, i: number) => {
        const x = (i / (s.data.length - 1)) * w, y = h / 2 - v * h * 0.3;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke(); ctx.shadowBlur = 0;
    },
    () => ({ data: Array.from({ length: 90 }, () => 0), acc: 0 }),
  );
  return <canvas ref={ref} className="h-full w-full" />;
}

/** Neurotransmitter multi-wave */
export function SignalFlow() {
  const ref = useCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    PALETTE.forEach((c, k) => {
      ctx.strokeStyle = c; ctx.lineWidth = 1.6; ctx.shadowColor = c; ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const y = h / 2 + Math.sin(x * 0.03 + t * (1.2 + k * 0.3) + k) * h * 0.28 * Math.sin(t * 0.5 + k);
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    });
    ctx.shadowBlur = 0; ctx.globalCompositeOperation = "source-over";
  });
  return <canvas ref={ref} className="h-full w-full" />;
}

/** Rotating DNA helix with flowing bases */
export function DNA() {
  const ref = useCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    const n = 26;
    for (let i = 0; i < n; i++) {
      const y = (i / n) * h + ((t * 18) % (h / n));
      const ph = y * 0.06 + t * 2 * N("dnaSpeed");
      const x1 = w / 2 + Math.sin(ph) * w * 0.32, x2 = w / 2 - Math.sin(ph) * w * 0.32;
      const z = Math.cos(ph);
      ctx.strokeStyle = `rgba(160,140,255,${0.25 + 0.3 * Math.abs(z)})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
      [[x1, z, PALETTE[i % 3 === 0 ? 0 : 3]], [x2, -z, PALETTE[i % 2 ? 1 : 4]]].forEach(([x, zz, c]: any) => {
        const r = 2.5 + (zz + 1) * 1.6;
        ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      });
    }
    ctx.shadowBlur = 0;
  });
  return <canvas ref={ref} className="h-full w-full" />;
}

/** Floating knowledge graph with pulses */
export function KnowledgeGraph({ count = 34 }: { count?: number }) {
  const ref = useCanvas(
    (ctx, w, h, t, s) => {
      ctx.clearRect(0, 0, w, h);
      for (const n of s.nodes) {
        n.x += n.vx * N("graphSpeed"); n.y += n.vy * N("graphSpeed");
        if (n.x < 8 || n.x > w - 8) n.vx *= -1;
        if (n.y < 8 || n.y > h - 8) n.vy *= -1;
      }
      for (let i = 0; i < s.nodes.length; i++)
        for (let j = i + 1; j < s.nodes.length; j++) {
          const a = s.nodes[i], b = s.nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 70) {
            ctx.strokeStyle = `rgba(120,200,255,${(1 - d / 70) * 0.5})`; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            const p = (t * 0.6 + i * 0.13) % 1;
            if ((i + j) % 5 === 0) {
              ctx.fillStyle = "#fff";
              ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, 1.4, 0, 7); ctx.fill();
            }
          }
        }
      for (const n of s.nodes) {
        const f = 0.6 + 0.4 * Math.sin(t * 3 + n.ph);
        ctx.fillStyle = n.c; ctx.shadowColor = n.c; ctx.shadowBlur = 14 * f;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * f, 0, 7); ctx.fill();
      }
      ctx.shadowBlur = 0;
    },
    (w, h) => ({
      nodes: Array.from({ length: count }, () => ({
        x: rnd(10, w - 10), y: rnd(10, h - 10), vx: rnd(-0.25, 0.25), vy: rnd(-0.25, 0.25),
        r: rnd(2, 5), c: PALETTE[Math.floor(Math.random() * 6)], ph: rnd(0, 7),
      })),
    }),
  );
  return <canvas ref={ref} className="h-full w-full" />;
}

/** Dense neuron field for zoom tiles */
export function NeuronField({ hue = 0, mode = "net" }: { hue?: number; mode?: "net" | "synapse" | "bits" }) {
  const ref = useCanvas(
    (ctx, w, h, t, s) => {
      ctx.fillStyle = "rgba(5,8,25,0.28)"; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      if (mode === "synapse") {
        const cx = w / 2, cy = h / 2;
        for (let i = 0; i < 3; i++) {
          const g = ctx.createRadialGradient(cx + (i - 1) * w * 0.3, cy, 0, cx + (i - 1) * w * 0.3, cy, h * 0.6);
          g.addColorStop(0, PALETTE[(i + 1) % 6] + "55"); g.addColorStop(1, "transparent");
          ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        }
        for (const p of s.parts) {
          p.x += p.vx; p.y += p.vy;
          if (p.x > w || Math.abs(p.y - cy) > h / 2) { p.x = w * 0.3; p.y = cy + rnd(-10, 10); p.vx = rnd(0.5, 2.5); p.vy = rnd(-0.6, 0.6); }
          ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
        }
      } else if (mode === "bits") {
        ctx.font = "10px monospace";
        for (const p of s.parts) {
          p.x += p.vx; if (p.x > w) p.x = -10;
          ctx.fillStyle = p.c; ctx.fillText("ACGT"[p.k % 4]!, p.x, p.y + Math.sin(t * 2 + p.x * 0.05) * 6);
        }
      }
      for (const n of s.nodes) {
        n.x += Math.sin(t + n.ph) * 0.15; n.y += Math.cos(t + n.ph) * 0.15;
        for (const m of n.links) {
          const b = s.nodes[m];
          ctx.strokeStyle = n.c + "40"; ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(n.x, n.y);
          ctx.quadraticCurveTo((n.x + b.x) / 2 + 10, (n.y + b.y) / 2 - 10, b.x, b.y); ctx.stroke();
        }
        const f = 0.5 + 0.5 * Math.sin(t * n.s + n.ph);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 4 + f * 8);
        g.addColorStop(0, "#fff"); g.addColorStop(0.3, n.c); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, 4 + f * 8, 0, 7); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    },
    (w, h) => {
      const pal = PALETTE.map((_, i) => PALETTE[(i + hue) % 6]);
      const nodes = Array.from({ length: mode === "net" ? 22 : 10 }, () => ({
        x: rnd(0, w), y: rnd(0, h), c: pal[Math.floor(Math.random() * 3)], s: rnd(1, 4), ph: rnd(0, 7), links: [] as number[],
      }));
      nodes.forEach((n, i) => { n.links = [Math.floor(Math.random() * nodes.length), (i + 1) % nodes.length]; });
      const parts = Array.from({ length: 60 }, (_, k) => ({
        x: rnd(0, w), y: rnd(0, h), vx: rnd(0.3, 2), vy: rnd(-0.4, 0.4), r: rnd(0.8, 2), c: pal[k % 6], k,
      }));
      return { nodes, parts };
    },
  );
  return <canvas ref={ref} className="h-full w-full" />;
}

/** Moving attention heatmap blobs */
export function AttentionMap() {
  const ref = useCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.42, h * 0.4, 0, 0, 7); ctx.clip();
    ctx.fillStyle = "#0b1a6b"; ctx.fillRect(0, 0, w, h);
    const blobs = [["#ff2a2a", 0], ["#ffd23a", 1.7], ["#22e57a", 3.1], ["#38e1ff", 4.4]] as const;
    blobs.forEach(([c, o]) => {
      const x = w / 2 + Math.sin(t * 0.7 + o) * w * 0.25, y = h / 2 + Math.cos(t * 0.9 + o) * h * 0.22;
      const g = ctx.createRadialGradient(x, y, 0, x, y, h * 0.45);
      g.addColorStop(0, c); g.addColorStop(1, "transparent");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    ctx.restore();
  });
  return <canvas ref={ref} className="h-full w-full" />;
}
