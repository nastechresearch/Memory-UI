import { useEffect, useRef, useState, type ReactNode, type UIEvent } from "react";
import { Brain3D } from "./Brain3D";
import { DEFAULTS, PLUGIN_CONFIG, PLUGIN_DEFAULTS, SETTINGS } from "./settings";
import brain from "@/assets/neural-brain.jpg";
import { hudSettings, REGIONS, AttentionMap, BrainOverlay, DNA, KnowledgeGraph, NeuronField, SignalFlow, Wave } from "./canvases";
import { DEMO_STATS, LOOP, THOUGHTS, useBridge, useLive } from "./useLive";
import { perf, QUALITY_LABEL, startPerf } from "./perf";
import { applyTheme, DEFAULT_THEME, THEMES } from "./themes";
import { initSound, sfx } from "./sound";
import { filterFacts } from "./explorer";
import { RegionCards } from "./RegionCards";

const fmt = (n: number) => n.toLocaleString("en-US");
const COLORS = ["text-chart-1", "text-chart-2", "text-chart-3", "text-chart-4", "text-chart-5"];
const BGS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
const BUILD_MODE = import.meta.env.VITE_HUD_MODE === "demo" ? "demo" : "production";

function Panel({ title, children, className = "", id }: { title: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`hud-panel p-3 ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 animate-scan bg-gradient-to-b from-transparent via-primary/10 to-transparent" />
      <h2 className="hud-title mb-2 flex items-center gap-2 text-xs">
        <span className="h-2 w-2 animate-blink rounded-full bg-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Bar({ v, i = 0 }: { v: number; i?: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full transition-all duration-700 ${i < 0 ? "bar-flow" : BGS[i % 5]}`} style={{ width: `${v}%` }} />
    </div>
  );
}

function Ring({ v, label, i = 0, size = 64 }: { v: number; label: string; i?: number; size?: number }) {
  const r = size / 2 - 6, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} className="fill-none stroke-muted" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} className={`fill-none ${["stroke-chart-1", "stroke-chart-2", "stroke-chart-3", "stroke-chart-4"][i % 4]} transition-all duration-700`}
          strokeWidth={5} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ filter: "drop-shadow(var(--glow))" }} />
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" transform={`rotate(90 ${size / 2} ${size / 2})`} className="fill-foreground font-mono text-sm">{v}%</text>
      </svg>
      <span className="text-[10px] tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex justify-between border-b border-border/40 py-1 text-xs"><span className="text-muted-foreground">{k}</span><span className="font-mono text-foreground">{v}</span></div>;
}

type Settings = Record<string, any> & { region: number };

function Slider({ label, v, min, max, step, on }: { label: string; v: number; min: number; max: number; step: number; on: (n: number) => void }) {
  return (
    <label className="block text-xs">
      <span className="flex items-center justify-between gap-2"><span>{label}</span>
        <input type="number" value={v} step={step} min={min} onChange={(e) => on(Math.max(min, +e.target.value || 0))} className="w-16 rounded border border-input bg-background px-1 text-right font-mono text-primary" /></span>
      <input type="range" min={min} max={Math.max(max, v)} step={step} value={v} onChange={(e) => on(+e.target.value)} className="w-full accent-[var(--primary)]" />
    </label>
  );
}

function Toggle({ label, v, on }: { label: string; v: boolean; on: (b: boolean) => void }) {
  return (
    <button onClick={() => on(!v)} className="flex w-full items-center justify-between py-1 text-xs">
      {label}
      <span className={`relative h-4 w-8 rounded-full transition-colors ${v ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-foreground transition-all ${v ? "left-4" : "left-0.5"}`} />
      </span>
    </button>
  );
}

const TABS = [["Overview", "top"], ["Brain", "brain"], ["Memory", "memory"], ["Explorer", "explorer"], ["Learning", "learning"], ["Reasoning", "reasoning"], ["Analytics", "analytics"]];

export function MemoryHud() {
  const s = useLive();
  const [set, setSet] = useState<Settings>({ ...hudSettings } as Settings);
  const [plug, setPlug] = useState<Record<string, number | boolean>>(PLUGIN_DEFAULTS);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(0);
  const lastScrollSave = useRef(0);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [minTrust, setMinTrust] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [bridgeUrl, setBridgeUrl] = useState("");
  const [draftUrl, setDraftUrl] = useState("http://127.0.0.1:8765");
  const bridge = useBridge(BUILD_MODE === "demo" ? "" : bridgeUrl);
  const live = BUILD_MODE === "production" && bridge.status === "live";
  const demo = BUILD_MODE === "demo" || (!live && Boolean(set.demoData));
  const b = BUILD_MODE === "demo" ? DEMO_STATS : live ? bridge.data : demo ? DEMO_STATS : bridge.data;
  useEffect(() => { startPerf(); }, []);
  useEffect(() => {
    if (BUILD_MODE !== "production") return;
    try {
      const saved = localStorage.getItem("nastech-hud-bridge-url");
      if (saved) { setBridgeUrl(saved); setDraftUrl(saved); }
    } catch { /* local storage may be disabled */ }
  }, []);
  const stColor = { live: "text-chart-2", reconnecting: "text-chart-4", connecting: "text-chart-4", offline: "text-destructive", off: "text-muted-foreground" }[bridge.status];
  const stLabel = { live: "CONNECTED", reconnecting: "RECONNECTING…", connecting: "CONNECTING…", offline: "OFFLINE", off: "NOT CONNECTED" }[bridge.status];
  const linkLabel = BUILD_MODE === "demo" ? "DEMO BUILD" : live ? "LIVE MEMORY" : bridge.status === "reconnecting" ? "RECONNECTING" : demo ? "SAMPLE DATA" : "SIMULATED";
  const diving = Number(hudSettings.diving);
  const cell = b && b.recent.length ? b.recent[Number(hudSettings.diveCount) % b.recent.length] : null;
  const region = set.region;
  const upd = (p: Partial<Settings>) => setSet((o) => {
    const n = { ...o, ...p }; Object.assign(hudSettings, n);
    try { localStorage.setItem("hud-settings", JSON.stringify(n)); } catch { /* ignore */ }
    return n;
  });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("hud-settings") || "null");
      if (saved) { Object.assign(hudSettings, saved); setSet({ ...hudSettings } as Settings); }
      const sp = JSON.parse(localStorage.getItem("hud-plugin") || "null");
      if (sp) setPlug({ ...PLUGIN_DEFAULTS, ...sp });
      const ui = JSON.parse(localStorage.getItem("hud-ui") || "null");
      if (ui) { setOpen(Boolean(ui.open)); scrollRef.current = Number(ui.scroll) || 0; }
    } catch { /* ignore */ }
  }, []);
  const setDrawer = (v: boolean) => {
    setOpen(v);
    try { localStorage.setItem("hud-ui", JSON.stringify({ open: v, scroll: scrollRef.current })); } catch { /* ignore */ }
  };
  const onDrawerScroll = (e: UIEvent<HTMLDivElement>) => {
    scrollRef.current = e.currentTarget.scrollTop;
    const now = Date.now();
    if (now - lastScrollSave.current > 400) {
      lastScrollSave.current = now;
      try { localStorage.setItem("hud-ui", JSON.stringify({ open: true, scroll: scrollRef.current })); } catch { /* ignore */ }
    }
  };
  useEffect(() => { if (open && drawerRef.current) drawerRef.current.scrollTop = scrollRef.current; }, [open]);
  const updPlug = (k: string, v: number | boolean) => setPlug((o) => { const n = { ...o, [k]: v }; try { localStorage.setItem("hud-plugin", JSON.stringify(n)); } catch { /* ignore */ } return n; });
  useEffect(() => { applyTheme(String(set.theme || DEFAULT_THEME)); }, [set.theme]);
  useEffect(() => { initSound(); }, []);
  const [brainBusy, setBrainBusy] = useState(false);
  useEffect(() => { const id = setInterval(() => setBrainBusy(Boolean(hudSettings.brainActive)), 150); return () => clearInterval(id); }, []);
  const yaml = `plugins:\n  nastech-memory-store:\n${PLUGIN_CONFIG.map((d) => `    ${d.key}: ${plug[d.key]}`).join("\n")}\n`;
  const pick = (i: number) => upd({ region: i });
  const tick = set.paused ? 0 : Math.floor(s.tick * Number(set.thoughtSpeed));
  const step = tick % LOOP.length;
  const thought = tick % THOUGHTS.length;
  hudSettings.thinking = step;
  const groups = [...new Set(SETTINGS.map((d) => d.group))];
  const facts = b?.recent ?? [];
  const shown = filterFacts(facts, q, cat, minTrust);
  const selFact = shown.find((f) => f.id === sel) ?? null;

  // sound cues
  const prevStep = useRef(-1);
  useEffect(() => { if (prevStep.current >= 0 && step !== prevStep.current) sfx.step(); prevStep.current = step; }, [step]);
  const diveOn = diving > 0.5;
  const prevDive = useRef(false);
  useEffect(() => { if (diveOn && !prevDive.current) sfx.dive(); prevDive.current = diveOn; }, [diveOn]);
  const prevStatus = useRef(bridge.status);
  useEffect(() => {
    if (bridge.status !== prevStatus.current) {
      if (bridge.status === "live") sfx.connect();
      if (bridge.status === "offline") sfx.drop();
      prevStatus.current = bridge.status;
    }
  }, [bridge.status]);

  return (
    <div id="top" className="min-h-screen p-2 text-foreground md:p-3"
      style={{ ["--panel-alpha" as string]: String(set.panelOpacity), ["--panel-blur" as string]: `${set.panelBlur}px`, ["--scan-display" as string]: set.scanlines ? "block" : "none" }}>
      <button onClick={() => setDrawer(true)} className="hud-panel hud-title fixed bottom-3 right-3 z-40 px-3 py-2 text-xs">⚙ Brain Settings</button>
      {open && (
        <aside ref={drawerRef} onScroll={onDrawerScroll} className="hud-panel fixed inset-y-0 right-0 z-50 w-80 max-w-[92vw] space-y-3 overflow-y-auto bg-popover p-4">
          <div className="flex items-center justify-between"><h2 className="hud-title text-sm">Brain Settings · {SETTINGS.length}</h2><button onClick={() => setDrawer(false)} className="text-primary">✕</button></div>
          <p className="text-[10px] text-muted-foreground">Every value goes down to 0. Drag or type any number. Saved on this device.</p>
          {groups.map((g) => (
            <details key={g} open={g === "Brain" || g === "Camera"} className="rounded border border-border/60 p-2">
              <summary className="hud-title cursor-pointer text-[11px]">{g}</summary>
              <div className="mt-2 space-y-2">
                {SETTINGS.filter((d) => d.group === g).map((d) => d.type === "range"
                  ? <Slider key={d.key} label={d.label} v={Number(set[d.key])} min={d.min} max={d.max} step={d.step} on={(n) => upd({ [d.key]: n })} />
                  : <Toggle key={d.key} label={d.label} v={Boolean(set[d.key])} on={(x) => upd({ [d.key]: x })} />)}
              </div>
            </details>
          ))}
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Color theme</p>
            <div className="grid grid-cols-2 gap-1">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => { sfx.click(); upd({ theme: t.id, hue: t.hue }); }}
                  className={`flex items-center gap-2 rounded border px-2 py-1 text-[10px] ${String(set.theme || DEFAULT_THEME) === t.id ? "border-primary text-primary" : "border-border"}`}>
                  <span className="h-3 w-3 rounded-full border border-border" style={{ background: t.swatch }} />
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Extract region</p>
            <div className="grid grid-cols-2 gap-1">
              {REGIONS.map((r, i) => (
                <button key={r.name} onClick={() => pick(region === i ? -1 : i)} className={`rounded border px-1 py-1 text-[10px] ${region === i ? "border-primary text-primary" : "border-border"}`}>{r.name}</button>
              ))}
            </div>
          </div>
          <details className="rounded border border-border/60 p-2">
            <summary className="hud-title cursor-pointer text-[11px]">Holographic plugin config · {PLUGIN_CONFIG.length}</summary>
            <div className="mt-2 space-y-2">
              {PLUGIN_CONFIG.map((d) => d.type === "range"
                ? <Slider key={d.key} label={d.label} v={Number(plug[d.key])} min={d.min} max={d.max} step={d.step} on={(n) => updPlug(d.key, n)} />
                : <Toggle key={d.key} label={d.label} v={Boolean(plug[d.key])} on={(x) => updPlug(d.key, x)} />)}
              <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-[10px]">{yaml}</pre>
              <button onClick={() => { navigator.clipboard?.writeText(yaml); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="w-full rounded bg-primary py-1 text-xs text-primary-foreground">{copied ? "Copied" : "Copy for config.yaml"}</button>
            </div>
          </details>
          <div className="space-y-1 border-t border-border pt-2">
            {BUILD_MODE === "demo" ? (
              <p className="text-[10px] text-muted-foreground">Demo build uses synthetic sample data only and never connects to a local plugin or memory database.</p>
            ) : (
              <div className="space-y-1">
                <p className="hud-title text-[11px]">Holographic Plugin Link</p>
                <p className="text-[10px] text-muted-foreground">The browser reads local fact text and entity names when connected. Only connect from a Nastech Research page you trust.</p>
                <p className="text-[10px] text-muted-foreground">Run <span className="font-mono text-primary">python holo_bridge.py</span> beside your Nastech memory database.</p>
                <input value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} className="w-full rounded border border-input bg-background px-2 py-1 font-mono text-xs" />
                <div className="flex gap-1">
                  <button onClick={() => { const url = draftUrl.trim(); setBridgeUrl(url); try { localStorage.setItem("nastech-hud-bridge-url", url); } catch { /* local storage may be disabled */ } }} className="flex-1 rounded bg-primary py-1 text-xs text-primary-foreground">Connect</button>
                  <button onClick={() => { setBridgeUrl(""); try { localStorage.removeItem("nastech-hud-bridge-url"); } catch { /* local storage may be disabled */ } }} className="flex-1 rounded border border-border py-1 text-xs">Disconnect</button>
                </div>
                <a href={`${import.meta.env.BASE_URL}holo_bridge.py`} download className="block text-[10px] text-primary underline">Download holo_bridge.py</a>
                <p className="font-mono text-[10px]">Status: <span className={stColor}>{stLabel}</span>{demo && <span className="text-chart-4"> · showing sample data</span>}</p>
                {bridge.lastOk > 0 && <p className="font-mono text-[10px] text-muted-foreground">Last data: {new Date(bridge.lastOk).toLocaleTimeString()}</p>}
                {bridge.hint && !live && <p className="rounded border border-destructive/40 bg-destructive/10 p-1.5 text-[10px] text-destructive">{bridge.hint}{bridge.retryIn > 0 && ` Retrying in ${Math.max(0, Math.round((bridge.retryIn - Date.now()) / 1000))}s.`}</p>}
              </div>
            )}
          </div>
          <button onClick={() => upd({ ...DEFAULTS, region: -1, theme: DEFAULT_THEME } as Partial<Settings>)} className="w-full rounded border border-primary py-1 text-xs text-primary">Reset to default</button>
        </aside>
      )}
      {/* Header */}
      <header className="hud-panel mb-2 flex flex-wrap items-center justify-between gap-3 px-4 py-2">
        <div>
          <h1 className="hud-title text-lg md:text-2xl">Nastech Neural Memory HUD</h1>
          <p className="text-[11px] tracking-[0.2em] text-muted-foreground">
            {BUILD_MODE === "demo" ? "DEMO BUILD · SYNTHETIC SAMPLE DATA · NO LOCAL ACCESS" : "ANIMATED VISUALIZATION · LOCAL MEMORY WHEN CONNECTED"}
          </p>
        </div>
        <div className="h-10 w-48 md:w-72"><Wave speed={2} /></div>
        <div className="text-xs">
          <p className="hud-title">Simulated activity</p>
          <p className="font-mono text-muted-foreground">
            {["ANALYZE", "REASON", "PLAN", "RESPOND", "LEARN"].map((w, i) => (
              <span key={w} className={i === tick % 5 ? "text-chart-2 glow-text" : ""}>{w}{i < 4 ? " → " : ""}</span>
            ))}
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className={`h-3 w-3 rounded-full ${live ? "bg-chart-2 animate-blink" : bridge.status === "offline" ? "bg-destructive" : "bg-chart-4 animate-blink"}`} />
          <span>MEMORY LINK <b className={live ? "text-chart-2" : bridge.status === "offline" ? "text-destructive" : "text-chart-4"}>{linkLabel}</b></span>
          <span className="text-muted-foreground">{s.now || "—"}</span>
          <span className="hud-title text-xl" title={perf.reasons.join(" · ") || "Running smoothly"}>{QUALITY_LABEL[Math.round(Number(set.quality) || 0)]}</span>
          <span className={perf.fps < 40 ? "text-destructive" : "text-muted-foreground"}>{perf.fps} FPS</span>
          {perf.reasons.length > 0 && <span className="max-w-[16rem] text-[10px] text-destructive">SLOW: {perf.reasons.join(" · ")}</span>}
        </div>
      </header>
      <nav className="hud-panel mb-2 flex gap-1 overflow-x-auto p-1">
        {TABS.map(([l, id]) => (
          <a key={id} href={`#${id}`} className="hud-title shrink-0 rounded px-3 py-1.5 text-[10px] hover:bg-primary/15">{l}</a>
        ))}
        <button onClick={() => setDrawer(true)} className="hud-title shrink-0 rounded bg-primary/15 px-3 py-1.5 text-[10px]">Settings</button>
      </nav>

      <div className="grid gap-2 lg:grid-cols-[280px_1fr_300px]">
        {/* Left column */}
        <div className="flex flex-col gap-2">
          <Panel id="reasoning" title="Cognitive Flow (Agent Loop)">
            <ol className="space-y-0.5">
              {LOOP.map((l, i) => (
                <li key={l} className={`flex items-center gap-2 rounded px-1 py-0.5 text-xs transition-all duration-500 ${i === step ? "bg-primary/15 text-primary glow-text" : i < step ? "text-foreground" : "text-muted-foreground"}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${i === step ? "bg-primary text-primary-foreground animate-pulse" : "bg-muted"}`}>{i + 1}</span>
                  {l}
                  {i === step && <span className="ml-auto font-mono text-[10px] animate-blink">PROCESSING</span>}
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Brain Activity">
            <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Neural Activity</span><span className="font-mono">{s.hz} Hz</span></div>
            <div className="h-14"><Wave color="#38e1ff" speed={1.5} /></div>
            <Row k="Active Neurons" v={fmt(s.neurons)} />
            <Row k="Synapses Firing" v={fmt(s.synapses)} />
            <Row k="Signal Strength" v={s.signal} />
          </Panel>
          <Panel title="Memory Load">
            <div className="flex items-center gap-4">
              <div className="relative"><Ring v={s.load} label="TOTAL" size={92} /></div>
              <div className="flex-1">
                <Row k="RAM (Working)" v={`${s.ram} / 10 GB`} />
                <Row k="LTM Storage" v={`${s.ltm.toFixed(2)} / 5 TB`} />
                <Row k="Recall hit" v={`${s.recall}%`} />
              </div>
            </div>
          </Panel>
          <Panel id="learning" title="Learning Progress">
            {["Current Task", "Pattern Learning", "Knowledge Integration", "Skill Adaptation", "Generalization"].map((k, i) => (
              <div key={k} className="mb-1.5">
                <div className="flex justify-between text-xs"><span>{k}</span><span className="font-mono">{s.learn[i]}%</span></div>
                <Bar v={s.learn[i] ?? 0} i={i} />
              </div>
            ))}
          </Panel>
        </div>

        {/* Center brain */}
        <div className="order-first flex flex-col gap-2 lg:order-none">
          <section id="brain" className="hud-panel relative aspect-[4/3] w-full">
            {set.brain3d ? (
              <>
                <Brain3D onPick={(i) => pick(i === region ? -1 : i)} />
                <RegionCards tick={tick} step={step} region={region} onPick={pick} dim={brainBusy || diving > 0.5} />
                <div className="pointer-events-none absolute left-2 bottom-2 font-mono text-[10px] leading-relaxed">
                  <p className="text-primary">ZOOM ×{Number(hudSettings.camZoom ?? 1).toFixed(1)}</p>
                  <p className={Number(hudSettings.diving) > 0.4 ? "text-chart-2 animate-blink" : "text-muted-foreground"}>
                    {Number(hudSettings.diving) > 0.4 ? `DIVING INTO CELL · ${LOOP[step]}` : `THINKING · ${LOOP[step]}`}
                  </p>
                  <p className="text-muted-foreground">DRAG ROTATE · SCROLL/PINCH ZOOM · TAP REGION</p>
                </div>
                {diving > 0.6 && (
                  <div className="hud-panel pointer-events-none absolute right-2 top-2 w-56 p-2 font-mono text-[10px] animate-in fade-in" style={{ opacity: Math.min(1, (diving - 0.6) / 0.3) }}>
                    <p className="hud-title text-[11px] text-chart-2">MEMORY CELL CLOSE-UP</p>
                    <p className="text-muted-foreground">REGION · {REGIONS[Number(hudSettings.diveRegion ?? 0)]?.name ?? "—"}</p>
                    {cell ? (<>
                      <p className="my-1 text-xs text-foreground">“{cell.content}”</p>
                      <p>CELL #{cell.id} · {cell.category.toUpperCase()}</p>
                      <div className="mt-1 h-1 w-full rounded bg-muted"><div className="h-1 rounded bg-chart-2" style={{ width: `${Math.round(cell.trust * 100)}%` }} /></div>
                      <p>TRUST {cell.trust.toFixed(2)} · RECALLS {cell.recalls}</p>
                      <p className="text-muted-foreground">{live ? "LIVE FROM BRIDGE" : "DEMO CELL"} · STEP {LOOP[step]}</p>
                    </>) : <p className="mt-1 text-muted-foreground">No memory data — connect the bridge or turn on demo data.</p>}
                  </div>
                )}
                {set.showLabels && region >= 0 && (
                  <p className="hud-title pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-xs text-chart-2 animate-blink">{REGIONS[region]!.name}</p>
                )}
              </>
            ) : (<>
            <div className="absolute inset-0 animate-breathe" style={{ filter: `brightness(${0.7 + set.glow * 0.3}) hue-rotate(${set.hue}deg)` }}>
              <img src={brain} alt="Live neural brain" width={1536} height={1152} className="h-full w-full object-contain" />
            </div>
            <BrainOverlay />
            {set.showLabels && REGIONS.map((r, i) => (
              <button key={r.name} onClick={() => pick(region === i ? -1 : i)} aria-label={`Extract ${r.name}`}
                className={`absolute rounded-full border transition-all duration-500 ${region === i ? "border-primary bg-primary/10 shadow-[var(--glow)]" : "border-transparent hover:border-primary/60"}`}
                style={{ left: `${(r.x - r.rx) * 100}%`, top: `${(r.y - r.ry) * 100}%`, width: `${r.rx * 200}%`, height: `${r.ry * 200}%` }}>
                <span className={`hud-title absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] sm:text-[11px] ${COLORS[i % 5]} ${region === i ? "animate-blink" : `hidden sm:inline ${tick % 6 === i ? "animate-blink" : "opacity-70"}`}`}>{r.name}</span>
              </button>
            ))}
            </>)}
            <div className="pointer-events-none absolute left-2 top-2 font-mono text-[9px] text-muted-foreground">TAP A REGION TO EXTRACT</div>
            <div className="absolute bottom-2 right-2 hud-panel px-2 py-1 font-mono text-[10px] text-chart-2">
              ● CONSCIOUSNESS: SIMULATED · ACTIVE
            </div>
          </section>
          {region >= 0 && (() => {
            const r = REGIONS[region]!;
            return (
              <Panel title={`Region Extraction · ${r.name}`}>
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr]">
                  <div className="relative h-36 overflow-hidden rounded border border-border">
                    <div className="absolute inset-0 animate-breathe" style={{ backgroundImage: `url(${brain})`, backgroundSize: `${100 / (r.rx * 2)}% auto`, backgroundPosition: `${((r.x - r.rx) / (1 - r.rx * 2)) * 100}% ${((r.y - r.ry) / (1 - r.ry * 2)) * 100}%` }} />
                    <span className="absolute bottom-1 left-1 font-mono text-[9px] text-chart-1">4K ZOOM · LIVE</span>
                  </div>
                  <div className="h-36 overflow-hidden rounded border border-border"><NeuronField key={region} hue={r.hue} /></div>
                  <div className="text-xs">
                    <p className="text-muted-foreground">{r.role}</p>
                    <Row k="Function" v={r.stat} />
                    <Row k="Activity" v={`${(40 + ((s.hz * (region + 3)) % 60))}%`} />
                    <Row k="Firing neurons" v={fmt(Math.floor(s.neurons / (region + 4)))} />
                    <Row k="Memory traces" v={fmt(Math.floor(s.semantic / (region + 2)))} />
                    <div className="mt-1 h-8"><Wave key={region} color={["#38e1ff", "#a855f7", "#22e57a", "#ffa630", "#ff3fb4", "#4d7cff"][r.hue] ?? "#38e1ff"} speed={1.5} /></div>
                    <button onClick={() => pick(-1)} className="mt-1 text-[10px] text-primary underline">Close extraction</button>
                  </div>
                </div>
              </Panel>
            );
          })()}
          <div className="grid gap-2 sm:grid-cols-2">
            <Panel title="Live Thought Process">
              <ul className="space-y-1">
                {THOUGHTS.map((t, i) => (
                  <li key={t} className={`flex items-center gap-2 text-xs transition-all ${i === thought ? "text-primary glow-text" : i < thought ? "text-foreground/70" : "text-muted-foreground/60"}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${i === thought ? "bg-primary animate-ping" : i < thought ? "bg-chart-2" : "bg-muted"}`} />
                    {t}
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Tasks Run">
              {["Analyze input", "Update memory graph", "Generate response", "Validate output", "Learn from interaction"].map((t, i) => {
                const pos = (i - (tick % 5) + 5) % 5;
                const st = pos === 0 ? "RUNNING" : pos === 1 ? "QUEUED" : pos === 4 ? "DONE" : "WAITING";
                return (
                  <div key={t} className="flex justify-between py-0.5 text-xs">
                    <span>{i + 1}. {t}</span>
                    <span className={`font-mono ${st === "RUNNING" ? "text-chart-2 animate-blink" : st === "DONE" ? "text-chart-1" : "text-muted-foreground"}`}>[{st}]</span>
                  </div>
                );
              })}
            </Panel>
          </div>
          {b && (
            <Panel title="Live Memory Feed · Holographic">
              <ul className="space-y-1">
                {b.recent.map((f, i) => (
                  <li key={f.id} className={`flex gap-2 text-xs ${i === tick % Math.max(1, b.recent.length) ? "text-primary glow-text" : ""}`}>
                    <span className="font-mono text-muted-foreground">#{f.id}</span>
                    <span className="font-mono text-chart-4">[{f.trust.toFixed(2)}]</span>
                    <span className="flex-1 truncate">{f.content}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{f.recalls}×</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel id="explorer" title="Memory Explorer">
            {b ? (<>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search memories…" className="w-full rounded border border-input bg-background px-2 py-1 text-xs" />
              <div className="mt-1 flex flex-wrap gap-1">
                <button onClick={() => setCat("all")} className={`rounded border px-2 py-0.5 text-[10px] ${cat === "all" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>All</button>
                {b.categories.map((c) => (
                  <button key={c.category} onClick={() => setCat(cat === c.category ? "all" : c.category)}
                    className={`rounded border px-2 py-0.5 text-[10px] ${cat === c.category ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                    {c.category} · {c.n}
                  </button>
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                Min trust
                <input type="range" min={0} max={1} step={0.05} value={minTrust} onChange={(e) => setMinTrust(+e.target.value)} className="flex-1 accent-[var(--primary)]" />
                <span className="font-mono text-foreground">{minTrust.toFixed(2)}</span>
              </label>
              <ul className="mt-1 max-h-44 space-y-0.5 overflow-y-auto">
                {shown.map((f) => (
                  <li key={f.id}>
                    <button onClick={() => setSel(sel === f.id ? null : f.id)}
                      className={`flex w-full gap-2 rounded px-1 py-0.5 text-left text-xs ${sel === f.id ? "bg-primary/15 text-primary" : "hover:bg-primary/10"}`}>
                      <span className="font-mono text-muted-foreground">#{f.id}</span>
                      <span className="font-mono text-chart-4">[{f.trust.toFixed(2)}]</span>
                      <span className="flex-1 truncate">{f.content}</span>
                    </button>
                  </li>
                ))}
                {!shown.length && <li className="py-2 text-center text-[10px] text-muted-foreground">No memories match.</li>}
              </ul>
              {selFact && (
                <div className="mt-1 rounded border border-border p-2 text-xs">
                  <p className="text-foreground">“{selFact.content}”</p>
                  <div className="mt-1 h-1.5 w-full rounded bg-muted"><div className="h-full rounded bg-chart-2" style={{ width: `${Math.round(selFact.trust * 100)}%` }} /></div>
                  <Row k="Memory ID" v={`#${selFact.id}`} />
                  <Row k="Category" v={selFact.category} />
                  <Row k="Trust" v={selFact.trust.toFixed(2)} />
                  <Row k="Times recalled" v={`${selFact.recalls}×`} />
                  <Row k="Source" v={live ? "Live bridge" : "Demo data"} />
                </div>
              )}
            </>) : (
              <p className="text-xs text-muted-foreground">Connect the bridge or enable demo data to browse memories.</p>
            )}
          </Panel>
          <Panel id="analytics" title="System Metrics">
            <div className="flex flex-wrap justify-around gap-2">
              <Ring v={s.cpu} label="CPU" i={0} />
              <Ring v={s.load} label="MEMORY" i={1} />
              <Ring v={s.gpu} label="GPU" i={2} />
              <Ring v={s.recall} label="RECALL" i={3} />
            </div>
            <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground">FPS 60 · Latency {s.latency} ms · Model Nastech-8K · Status <span className="text-chart-2">Optimal</span></p>
          </Panel>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-2">
          <Panel title="Neural Signal Flow">
            <div className="h-20"><SignalFlow /></div>
            <div className="grid grid-cols-2 gap-x-2 text-[10px] text-muted-foreground">
              {["Glutamate", "GABA", "Dopamine", "Serotonin", "Acetylcholine", "Norepinephrine"].map((n, i) => (
                <span key={n} className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${BGS[i % 5]}`} />{n}</span>
              ))}
            </div>
          </Panel>
          <Panel id="memory" title="Memories">
            {b ? (<>
              <Row k="Facts stored" v={fmt(b.facts)} />
              <Row k="Entities" v={fmt(b.entities)} />
              <Row k="Entity links" v={fmt(b.links)} />
              <Row k="Total recalls" v={fmt(b.recalls)} />
              <Row k="Avg trust" v={b.avg_trust.toFixed(2)} />
              {b.categories.slice(0, 4).map((c) => <Row key={c.category} k={`· ${c.category}`} v={fmt(c.n)} />)}
            </>) : (<>
            <Row k="Episodic" v={fmt(s.episodic)} />
            <Row k="Semantic" v={fmt(s.semantic)} />
            <Row k="Procedural" v={fmt(s.procedural)} />
            <Row k="Short-Term" v={fmt(s.stm)} />
            <Row k="Long-Term" v={fmt(s.lt)} />
            </>)}
          </Panel>
          <Panel title="AI Agent Loop">
            <div className="relative mx-auto h-36 w-36">
              <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-dashed border-primary/60" />
              {["PLAN", "DRAFT", "CHALLENGE", "REVISE", "RESPOND"].map((l, i) => {
                const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
                return (
                  <span key={l} className={`absolute -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold ${tick % 5 === i ? "text-chart-2 glow-text" : "text-muted-foreground"}`}
                    style={{ left: `${50 + Math.cos(a) * 48}%`, top: `${50 + Math.sin(a) * 48}%` }}>{l}</span>
                );
              })}
              <span className="hud-title absolute inset-0 flex items-center justify-center text-sm animate-pulse">LEARN</span>
            </div>
          </Panel>
          <Panel title="Knowledge Graph"><div className="h-36"><KnowledgeGraph /></div></Panel>
          <Panel title="DNA View (Memory Encoding)">
            <div className="flex gap-2">
              <div className="h-32 w-20"><DNA /></div>
              <div className="flex-1 font-mono text-[10px] leading-relaxed">
                <p className="text-muted-foreground">Every byte → 4 bases</p>
                <p>"Hello" → 01001000 01100101</p>
                <p className="text-chart-4">{"ACGT".split("").map((_, i) => "ACGT"[(tick + i) % 4]).join(" ")} · {"ACGT"[(tick * 3) % 4]}GTC…</p>
                <p className="mt-1 text-muted-foreground">Encoded: {s.ltm.toFixed(3)} TB</p>
              </div>
            </div>
          </Panel>
          <Panel title="Output Status">
            <div className="flex gap-0.5">
              {Array.from({ length: 20 }).map((_, i) => (
                <span key={i} className={`h-3 flex-1 rounded-sm transition-colors ${i < s.output / 5 ? "bg-chart-2" : "bg-muted"}`} />
              ))}
            </div>
            <p className="mt-1 flex justify-between text-xs"><span className="animate-blink">Generating response…</span><span className="font-mono">{s.output}%</span></p>
          </Panel>
        </div>
      </div>

      {/* Bottom zoom tiles */}
      {set.showTiles && <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Synapse Zoom", "Neurotransmitter release", <NeuronField mode="synapse" hue={0} />],
          ["Neuron Network", `Active neurons: ${(s.neurons / 1e6).toFixed(2)}M`, <NeuronField hue={1} />],
          ["Deep Memory View", "Stored bits visualized", <NeuronField mode="bits" hue={2} />],
          ["Real-Time Learning", "New pattern detected", <KnowledgeGraph count={24} />],
          ["Memory Recall", "Reconstructing memory…", <NeuronField hue={4} />],
          ["Attention Map", "High · Medium · Low", <AttentionMap />],
        ].map(([t, c, el]: any) => (
          <Panel key={t} title={t}>
            <div className="h-28">{el}</div>
            <p className="mt-1 text-center text-[10px] text-chart-1">{c}</p>
          </Panel>
        ))}
        </div>
      }

      <footer className="mt-2 text-center font-mono text-[10px] tracking-[0.3em] text-muted-foreground">
        THINK ★ LEARN ★ REASON ★ EXPLORE · NASTECH RESEARCH PROJECT
      </footer>
    </div>
  );
}
