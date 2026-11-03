import { useEffect, useState } from "react";

const jitter = (v: number, amt: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v + (Math.random() - 0.5) * amt));

export const LOOP = ["INPUT", "RECALL", "EXTRACT", "DEEP VIEW", "DNA VIEW", "PLAN", "DRAFT", "CHALLENGE", "REVISE", "RESPOND", "LEARN"];
export const THOUGHTS = [
  "Analyzing input…", "Searching memory…", "Connecting concepts…", "Evaluating possibilities…",
  "Planning response…", "Generating output…", "Learning from this interaction…",
];

export function useLive() {
  const [s, set] = useState({
    tick: 0, hz: 238, neurons: 12458320, synapses: 89540112, signal: 0.87, load: 68,
    ram: 6.8, ltm: 2.4, cpu: 92, gpu: 41, recall: 92, latency: 230, output: 83,
    episodic: 1245320, semantic: 2843771, procedural: 982441, stm: 124553, lt: 4863210,
    learn: [72, 82, 68, 55, 49], now: "",
  });
  useEffect(() => {
    const id = setInterval(() => {
      set((p) => ({
        tick: p.tick + 1,
        hz: Math.round(jitter(p.hz, 20, 180, 320)),
        neurons: p.neurons + Math.floor(Math.random() * 900),
        synapses: p.synapses + Math.floor(Math.random() * 5000),
        signal: +jitter(p.signal, 0.06, 0.6, 0.99).toFixed(2),
        load: Math.round(jitter(p.load, 4, 55, 85)),
        ram: +jitter(p.ram, 0.3, 5, 9.5).toFixed(1),
        ltm: +(p.ltm + 0.001).toFixed(3),
        cpu: Math.round(jitter(p.cpu, 8, 60, 99)),
        gpu: Math.round(jitter(p.gpu, 8, 20, 90)),
        recall: Math.round(jitter(p.recall, 3, 85, 99)),
        latency: Math.round(jitter(p.latency, 30, 150, 320)),
        output: (p.output + 3) % 101,
        episodic: p.episodic + Math.floor(Math.random() * 40),
        semantic: p.semantic + Math.floor(Math.random() * 60),
        procedural: p.procedural + Math.floor(Math.random() * 15),
        stm: Math.round(jitter(p.stm, 400, 100000, 150000)),
        lt: p.lt + Math.floor(Math.random() * 80),
        learn: p.learn.map((v) => Math.round(jitter(v, 4, 30, 99))),
        now: new Date().toISOString().replace("T", " ").slice(0, 19),
      }));
    }, 900);
    return () => clearInterval(id);
  }, []);
  return s;
}

export type BridgeStats = {
  facts: number; avg_trust: number; recalls: number; helpful: number; recalled_facts: number;
  entities: number; links: number; categories: { category: string; n: number }[];
  recent: { id: number; content: string; category: string; trust: number; recalls: number }[];
  top_entities: { name: string; n: number }[];
};

export type BridgeStatus = "off" | "connecting" | "live" | "reconnecting" | "offline";

export const DEMO_STATS: BridgeStats = {
  facts: 1284, avg_trust: 0.71, recalls: 5630, helpful: 2210, recalled_facts: 812, entities: 342, links: 2975,
  categories: [{ category: "preference", n: 412 }, { category: "project", n: 388 }, { category: "fact", n: 301 }, { category: "skill", n: 183 }],
  recent: [
    { id: 9001, content: "User prefers concise answers with code first", category: "preference", trust: 0.92, recalls: 48 },
    { id: 9002, content: "Nastech HUD runs on a 3D point-cloud brain", category: "project", trust: 0.81, recalls: 22 },
    { id: 9003, content: "Bridge listens on localhost:8765", category: "fact", trust: 0.77, recalls: 15 },
    { id: 9004, content: "User is based in Johannesburg (UTC+2)", category: "fact", trust: 0.88, recalls: 9 },
    { id: 9005, content: "Holographic memory uses HRR vectors (dim 1024)", category: "skill", trust: 0.69, recalls: 31 },
    { id: 9006, content: "Keep the HUD fast: 4K default, auto quality", category: "preference", trust: 0.95, recalls: 6 },
  ],
  top_entities: [{ name: "Nastech", n: 120 }, { name: "HUD", n: 88 }, { name: "memory", n: 74 }],
};

function hintFor(err: unknown, url: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/^\d+$/.test(msg)) return `Bridge answered with error ${msg}. Check the --db path points to memory_store.db.`;
  if (msg.startsWith("db:")) return `Bridge can't read the memory file: ${msg.slice(3)}. Check the --db path.`;
  if (location.protocol === "https:" && url.startsWith("http:"))
    return "Couldn't reach the bridge. Make sure python holo_bridge.py is running; this https page may also block http://localhost — allow it in the browser (site settings → insecure content / local network).";
  return "Couldn't reach the bridge. Start it with: python holo_bridge.py — and check the port matches.";
}

/** Polls the local holographic bridge (holo_bridge.py) with backoff. Live → reconnecting (1–2 misses) → offline. */
export function useBridge(url: string) {
  const [state, set] = useState<{ data: BridgeStats | null; status: BridgeStatus; hint: string; lastOk: number; retryIn: number }>({ data: null, status: "off", hint: "", lastOk: 0, retryIn: 0 });
  useEffect(() => {
    if (!url) { set({ data: null, status: "off", hint: "", lastOk: 0, retryIn: 0 }); return; }
    let alive = true, fails = 0, timer = 0;
    set((p) => ({ ...p, status: "connecting", hint: "" }));
    const poll = async () => {
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 4000);
        const r = await fetch(`${url.replace(/\/$/, "")}/stats`, { signal: ctrl.signal }).finally(() => clearTimeout(to));
        if (!r.ok) {
          const body = await r.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error ? `db:${body.error}` : String(r.status));
        }
        const data = (await r.json()) as BridgeStats;
        fails = 0;
        if (alive) set({ data, status: "live", hint: "", lastOk: Date.now(), retryIn: 0 });
      } catch (e) {
        fails++;
        const wait = fails < 3 ? 2500 : Math.min(30000, 2500 * 2 ** (fails - 2));
        if (alive) set((p) => ({ ...p, status: fails < 3 && p.lastOk ? "reconnecting" : fails < 3 ? "connecting" : "offline", hint: hintFor(e, url), retryIn: Date.now() + wait }));
        if (alive) timer = window.setTimeout(poll, wait);
        return;
      }
      if (alive) timer = window.setTimeout(poll, 2500);
    };
    poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [url]);
  return state;
}
