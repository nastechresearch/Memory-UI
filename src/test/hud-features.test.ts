import { beforeEach, describe, expect, it } from "vitest";

import { filterFacts, type Fact } from "@/components/hud/explorer";
import { makeBrain } from "@/components/hud/Brain3D";
import { SETTINGS } from "@/components/hud/settings";
import { applyTheme, DEFAULT_THEME, THEMES, THEME_KEYS } from "@/components/hud/themes";

describe("HUD themes", () => {
  beforeEach(() => applyTheme(DEFAULT_THEME));

  it("default theme clears all overrides", () => {
    applyTheme("synthwave");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBeTruthy();
    applyTheme(DEFAULT_THEME);
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("");
  });

  it("non-default themes override every core token", () => {
    for (const t of THEMES.filter((x) => x.id !== DEFAULT_THEME)) {
      applyTheme(t.id);
      for (const k of THEME_KEYS) expect(document.documentElement.style.getPropertyValue(`--${k}`)).toBe(t.vars[k] ?? "");
    }
    applyTheme(DEFAULT_THEME);
  });

  it("keeps a sound-effects toggle on by default", () => {
    const sound = SETTINGS.find((s) => s.key === "sound");
    expect(sound?.type).toBe("toggle");
    expect(sound && "def" in sound && sound.def).toBe(true);
  });
});

describe("Memory Explorer filtering", () => {
  const facts: Fact[] = [
    { id: 1, content: "User prefers concise answers", category: "preference", trust: 0.9, recalls: 5 },
    { id: 2, content: "Bridge listens on localhost", category: "fact", trust: 0.4, recalls: 2 },
    { id: 3, content: "Holographic memory uses HRR", category: "skill", trust: 0.7, recalls: 9 },
  ];

  it("filters by search text", () => {
    expect(filterFacts(facts, "bridge", "all", 0).map((f) => f.id)).toEqual([2]);
  });

  it("filters by category and minimum trust", () => {
    expect(filterFacts(facts, "", "skill", 0).map((f) => f.id)).toEqual([3]);
    expect(filterFacts(facts, "", "all", 0.6).map((f) => f.id)).toEqual([1, 3]);
    expect(filterFacts(facts, "", "all", 0.95)).toEqual([]);
});

describe("3D brain cells", () => {
  it("places every cell INSIDE the brain with full anatomy", () => {
    const brain = makeBrain(0.15);
    expect(brain.cells.length).toBeGreaterThan(3);
    for (const c of brain.cells) {
      const d = Math.hypot(c.soma.x, c.soma.y - 0.15, c.soma.z);
      expect(d).toBeLessThan(1.35); // soma stays inside the brain volume
      expect(c.wire.length).toBeGreaterThan(2); // wired out to the surface
      expect(c.dend.length).toBeGreaterThan(3); // full dendritic tree
      expect(c.axon.length).toBeGreaterThan(5); // axon
      expect(c.reg).toBeGreaterThanOrEqual(0);
      expect(c.reg).toBeLessThanOrEqual(5);
    }
  });
});
});
