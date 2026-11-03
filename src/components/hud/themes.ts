/** HUD color themes: applied as CSS-variable overrides on <html> at runtime, saved with the settings. */

export type ThemeDef = { id: string; name: string; hue: number; swatch: string; vars: Record<string, string> };

export const DEFAULT_THEME = "cyan-ops";

/** Every token a theme may override (all exist in :root in styles.css). */
export const THEME_KEYS = [
  "background", "bg-glow", "card", "popover", "primary", "primary-foreground", "secondary", "secondary-foreground",
  "muted", "muted-foreground", "accent", "accent-foreground", "border", "input", "ring",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
];

export const THEMES: ThemeDef[] = [
  {
    id: DEFAULT_THEME,
    name: "Cyan Ops",
    hue: 0,
    swatch: "oklch(0.82 0.15 210)",
    vars: {}, // default — clears all overrides back to the stylesheet values
  },
  {
    id: "synthwave",
    name: "Synthwave",
    hue: 70,
    swatch: "oklch(0.8 0.22 340)",
    vars: {
      background: "oklch(0.14 0.05 305)",
      "bg-glow": "oklch(0.22 0.1 320)",
      card: "oklch(0.18 0.06 305 / 0.72)",
      popover: "oklch(0.18 0.06 305)",
      primary: "oklch(0.8 0.22 340)",
      "primary-foreground": "oklch(0.14 0.05 305)",
      secondary: "oklch(0.24 0.08 300)",
      "secondary-foreground": "oklch(0.93 0.03 320)",
      muted: "oklch(0.24 0.06 300)",
      "muted-foreground": "oklch(0.7 0.06 320)",
      accent: "oklch(0.75 0.2 280)",
      "accent-foreground": "oklch(0.98 0 0)",
      border: "oklch(0.62 0.14 330 / 0.4)",
      input: "oklch(0.62 0.14 330 / 0.4)",
      ring: "oklch(0.8 0.22 340)",
      "chart-1": "oklch(0.8 0.22 340)",
      "chart-2": "oklch(0.8 0.2 280)",
      "chart-3": "oklch(0.78 0.18 200)",
      "chart-4": "oklch(0.82 0.16 70)",
      "chart-5": "oklch(0.72 0.22 310)",
    },
  },
  {
    id: "bio-green",
    name: "Bio Green",
    hue: 300,
    swatch: "oklch(0.82 0.2 150)",
    vars: {
      background: "oklch(0.11 0.03 150)",
      "bg-glow": "oklch(0.18 0.07 150)",
      card: "oklch(0.15 0.04 150 / 0.72)",
      popover: "oklch(0.15 0.04 150)",
      primary: "oklch(0.82 0.2 150)",
      "primary-foreground": "oklch(0.11 0.03 150)",
      secondary: "oklch(0.2 0.05 150)",
      "secondary-foreground": "oklch(0.93 0.04 140)",
      muted: "oklch(0.2 0.04 150)",
      "muted-foreground": "oklch(0.68 0.06 150)",
      accent: "oklch(0.75 0.18 180)",
      "accent-foreground": "oklch(0.98 0 0)",
      border: "oklch(0.6 0.12 150 / 0.35)",
      input: "oklch(0.6 0.12 150 / 0.35)",
      ring: "oklch(0.82 0.2 150)",
      "chart-1": "oklch(0.82 0.2 150)",
      "chart-2": "oklch(0.8 0.2 130)",
      "chart-3": "oklch(0.75 0.15 180)",
      "chart-4": "oklch(0.8 0.17 100)",
      "chart-5": "oklch(0.75 0.15 200)",
    },
  },
  {
    id: "ember",
    name: "Ember",
    hue: 170,
    swatch: "oklch(0.8 0.16 60)",
    vars: {
      background: "oklch(0.12 0.03 40)",
      "bg-glow": "oklch(0.2 0.08 35)",
      card: "oklch(0.16 0.04 40 / 0.72)",
      popover: "oklch(0.16 0.04 40)",
      primary: "oklch(0.8 0.16 60)",
      "primary-foreground": "oklch(0.12 0.03 40)",
      secondary: "oklch(0.22 0.05 40)",
      "secondary-foreground": "oklch(0.93 0.03 45)",
      muted: "oklch(0.22 0.04 40)",
      "muted-foreground": "oklch(0.7 0.05 50)",
      accent: "oklch(0.72 0.19 30)",
      "accent-foreground": "oklch(0.98 0 0)",
      border: "oklch(0.6 0.1 55 / 0.35)",
      input: "oklch(0.6 0.1 55 / 0.35)",
      ring: "oklch(0.8 0.16 60)",
      "chart-1": "oklch(0.8 0.16 60)",
      "chart-2": "oklch(0.72 0.19 35)",
      "chart-3": "oklch(0.82 0.14 85)",
      "chart-4": "oklch(0.72 0.14 200)",
      "chart-5": "oklch(0.68 0.2 350)",
    },
  },
  {
    id: "violet-ice",
    name: "Violet Ice",
    hue: 30,
    swatch: "oklch(0.78 0.2 285)",
    vars: {
      background: "oklch(0.12 0.04 285)",
      "bg-glow": "oklch(0.19 0.08 290)",
      card: "oklch(0.16 0.05 285 / 0.72)",
      popover: "oklch(0.16 0.05 285)",
      primary: "oklch(0.78 0.2 285)",
      "primary-foreground": "oklch(0.12 0.04 285)",
      secondary: "oklch(0.22 0.06 285)",
      "secondary-foreground": "oklch(0.93 0.03 290)",
      muted: "oklch(0.22 0.05 285)",
      "muted-foreground": "oklch(0.7 0.05 290)",
      accent: "oklch(0.8 0.15 210)",
      "accent-foreground": "oklch(0.98 0 0)",
      border: "oklch(0.62 0.12 285 / 0.38)",
      input: "oklch(0.62 0.12 285 / 0.38)",
      ring: "oklch(0.78 0.2 285)",
      "chart-1": "oklch(0.78 0.2 285)",
      "chart-2": "oklch(0.8 0.15 210)",
      "chart-3": "oklch(0.72 0.2 330)",
      "chart-4": "oklch(0.78 0.15 230)",
      "chart-5": "oklch(0.7 0.22 300)",
    },
  },
];

/** Apply a theme by setting inline CSS variables on <html>; the default clears them. */
export function applyTheme(id: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const k of THEME_KEYS) root.style.removeProperty(`--${k}`);
  const t = THEMES.find((x) => x.id === id);
  if (!t || t.id === DEFAULT_THEME) return;
  for (const [k, val] of Object.entries(t.vars)) root.style.setProperty(`--${k}`, val);
}
