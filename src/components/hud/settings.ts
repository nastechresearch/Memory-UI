/** Every live-tunable HUD setting. All numeric ranges start at 0 so the user is in full control. */
export type SettingDef =
  | { key: string; label: string; group: string; type: "range"; min: number; max: number; step: number; def: number }
  | { key: string; label: string; group: string; type: "toggle"; def: boolean };

const r = (group: string, key: string, label: string, max: number, def: number, step = 0.05): SettingDef =>
  ({ group, key, label, type: "range", min: 0, max, step, def });
const b = (group: string, key: string, label: string, def: boolean): SettingDef => ({ group, key, label, type: "toggle", def });

export const SETTINGS: SettingDef[] = [
  // Brain
  b("Brain", "brain3d", "3D rotatable brain (off = photo)", true),
  r("Brain", "speed", "Animation speed", 5, 1),
  r("Brain", "density", "Neuron density", 3, 1.8),
  r("Brain", "pointSize", "Neuron size", 4, 1),
  r("Brain", "glow", "Glow intensity", 3, 1),
  r("Brain", "hue", "Color shift (°)", 360, 0, 1),
  r("Brain", "saturation", "Saturation", 3, 1),
  r("Brain", "brightness", "Brightness", 3, 1),
  r("Brain", "linkDist", "Synapse link reach", 3, 1),
  b("Brain", "showLabels", "Region labels", true),
  // Camera
  b("Camera", "autoRotate", "Auto-rotate", true),
  r("Camera", "rotateSpeed", "Rotate speed", 3, 0.6),
  r("Camera", "pitch", "Tilt", 1.5, 0.15),
  r("Camera", "zoom", "Zoom", 12, 1, 0.1),
  b("Camera", "thinkDive", "Dive into cells while thinking", true),
  r("Camera", "diveDepth", "Dive depth", 12, 5, 0.1),
  r("Camera", "diveEvery", "Dive interval (s)", 30, 9, 0.5),
  r("Camera", "cellDetail", "Cell detail when zoomed", 3, 1),
  // Signals
  b("Signals", "signals", "Signal pulses", true),
  r("Signals", "signalCount", "Pulse count", 3, 1),
  r("Signals", "signalSpeed", "Pulse speed", 5, 1),
  b("Signals", "scan", "Scan ring", true),
  r("Signals", "scanSpeed", "Scan speed", 5, 1),
  // HUD
  r("HUD", "quality", "Render quality (0 Auto · 1 HD · 2 4K · 3 8K)", 3, 0, 1),
  b("HUD", "demoData", "Demo data when bridge is offline", true),
  b("HUD", "sound", "Sound effects", true),
  b("HUD", "paused", "Pause all motion", false),
  r("HUD", "tickRate", "Data update rate (per s)", 10, 1.1),
  r("HUD", "thoughtSpeed", "Thinking step speed", 5, 1),
  r("HUD", "waveAmp", "Wave amplitude", 3, 1),
  r("HUD", "dnaSpeed", "DNA spin speed", 5, 1),
  r("HUD", "graphSpeed", "Graph drift speed", 5, 1),
  r("HUD", "panelOpacity", "Panel opacity", 1, 0.72),
  r("HUD", "panelBlur", "Panel blur (px)", 20, 6, 1),
  b("HUD", "scanlines", "Panel scanlines", true),
  b("HUD", "showTiles", "Zoom tiles row", true),
  b("HUD", "showFeatures", "Features list", true),
];

export const DEFAULTS: Record<string, number | boolean> = Object.fromEntries(SETTINGS.map((s) => [s.key, s.def]));

/** Plugin config (plugins.nastech-memory-store in config.yaml) — exported as YAML for the user. */
export const PLUGIN_CONFIG: SettingDef[] = [
  b("Plugin", "auto_extract", "auto_extract", false),
  b("Plugin", "mirror_memory_writes", "mirror_memory_writes", false),
  r("Plugin", "default_trust", "default_trust", 1, 0.5, 0.01),
  r("Plugin", "min_trust_threshold", "min_trust_threshold", 1, 0.3, 0.01),
  r("Plugin", "temporal_decay_half_life", "temporal_decay_half_life (days)", 365, 0, 1),
  r("Plugin", "hrr_dim", "hrr_dim", 8192, 1024, 64),
  r("Plugin", "hrr_weight", "hrr_weight", 1, 0.3, 0.01),
  r("Plugin", "prefetch_min_coverage", "prefetch_min_coverage", 1, 0.3, 0.01),
  r("Plugin", "prefetch_repeat_turns", "prefetch_repeat_turns", 50, 6, 1),
  b("Plugin", "recall_indicator", "recall_indicator", true),
];
export const PLUGIN_DEFAULTS: Record<string, number | boolean> = Object.fromEntries(PLUGIN_CONFIG.map((s) => [s.key, s.def]));
