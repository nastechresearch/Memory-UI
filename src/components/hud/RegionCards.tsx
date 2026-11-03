import { useEffect, useRef, useState } from "react";
import { REGIONS } from "./canvases";
import { LOOP } from "./useLive";

const COLORS = ["#ffa630", "#4d7cff", "#22e57a", "#a855f7", "#ff3fb4", "#38e1ff"];
const activity = (tick: number, i: number) => 0.5 + 0.5 * Math.sin(tick * 0.9 * (i + 1) + i * 2.1);

/** Beside the small brain: wired cards, one per region, showing which brain part is active or running, plus a live activity log. */
export function RegionCards({ tick, step, region, onPick, dim }: { tick: number; step: number; region: number; onPick: (i: number) => void; dim: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [wires, setWires] = useState<{ x2: number; y2: number }[]>([]);
  const [log, setLog] = useState<{ t: string; msg: string }[]>([]);
  const lastRun = useRef(-1);

  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current; if (!wrap) return;
      const wr = wrap.getBoundingClientRect();
      setBox({ w: wr.width, h: wr.height });
      setWires(REGIONS.map((_, i) => {
        const el = cardRefs.current[i]; if (!el) return { x2: wr.width, y2: wr.height / 2 };
        const r = el.getBoundingClientRect();
        return { x2: r.left - wr.left - 2, y2: r.top + r.height / 2 - wr.top };
      }));
    };
    measure();
    const id = setTimeout(measure, 300);
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => { clearTimeout(id); ro.disconnect(); };
  }, []);

  useEffect(() => {
    let run = 0;
    for (let i = 1; i < REGIONS.length; i++) if (activity(tick, i) > activity(tick, run)) run = i;
    if (run === lastRun.current) return;
    lastRun.current = run;
    const t = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setLog((l) => [{ t, msg: `${REGIONS[run]!.name} → ${LOOP[step] ?? "PROCESS"}` }, ...l].slice(0, 7));
  }, [tick, step]);

  const run = REGIONS.reduce((b, _, i) => (activity(tick, i) > activity(tick, b) ? i : b), 0);
  const ax = box.w * 0.34, ay = box.h * 0.36; // the small brain sits at 34% / 36% of the canvas

  return (
    <div ref={wrapRef} className={`absolute inset-y-2 right-2 z-10 flex w-[46%] max-w-64 flex-col gap-1 transition-opacity duration-300 ${dim ? "pointer-events-none opacity-20" : "opacity-100"}`}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {wires.map((p2, i) => (
          <path key={i} d={`M ${ax} ${ay} Q ${(ax + p2.x2) / 2} ${ay + (p2.y2 - ay) * 0.25} ${p2.x2} ${p2.y2}`}
            fill="none" stroke={COLORS[i]} strokeOpacity={region === i ? 0.9 : 0.3} strokeWidth={region === i ? 1.4 : 0.8} strokeDasharray="3 3" />
        ))}
        {wires.map((p2, i) => (
          <circle key={`p${i}`} cx={p2.x2} cy={p2.y2} r={region === i ? 2.2 : 1.4} fill={COLORS[i]} fillOpacity={region === i ? 1 : 0.5} />
        ))}
      </svg>
      {REGIONS.map((r, i) => {
        const a = activity(tick, i);
        const status = region === i ? "EXTRACT" : i === run ? "RUNNING" : a > 0.6 ? "ACTIVE" : "IDLE";
        return (
          <button key={r.name} ref={(el) => { cardRefs.current[i] = el; }} onClick={() => onPick(region === i ? -1 : i)}
            className="relative rounded border bg-card/85 px-1.5 py-0.5 text-left backdrop-blur-sm transition-colors"
            style={{ borderColor: region === i ? COLORS[i] : `color-mix(in oklab, ${COLORS[i]} 35%, transparent)` }}>
            <span className="absolute -left-[3px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full" style={{ background: COLORS[i], boxShadow: `0 0 6px ${COLORS[i]}` }} />
            <div className="flex items-center justify-between gap-1 text-[9px] leading-tight">
              <span className="truncate font-semibold text-foreground">{r.name}</span>
              <span className="font-mono" style={{ color: status === "IDLE" ? "var(--muted-foreground)" : COLORS[i] }}>
                {status === "RUNNING" ? <span className="animate-blink">{status}</span> : status}
              </span>
            </div>
            <div className="mt-0.5 h-[3px] w-full rounded bg-muted">
              <div className="h-full rounded transition-all duration-500" style={{ width: `${Math.round(a * 100)}%`, background: COLORS[i] }} />
            </div>
          </button>
        );
      })}
      <div className="min-h-8 flex-1 overflow-hidden rounded border border-border bg-card/70 p-1 font-mono text-[8px] leading-snug backdrop-blur-sm">
        <p className="text-primary">ACTIVITY LOG</p>
        {log.map((e, i) => (
          <p key={i} className={`truncate ${i === 0 ? "text-chart-2" : "text-muted-foreground"}`}><span className="opacity-60">{e.t}</span> {e.msg}</p>
        ))}
        {!log.length && <p className="text-muted-foreground">waiting…</p>}
      </div>
    </div>
  );
}
