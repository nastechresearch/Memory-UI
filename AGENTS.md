> [!IMPORTANT]
> This project is maintained by Nastech Research. Never rewrite published
> history on `main`; use normal commits so deployments and collaborators keep
> a consistent record.
>
> Changes pushed to `main` publish to the production GitHub Pages site. Keep
> both the production and demo builds green.

- HUD canvases read the mutable `hudSettings` object every frame so settings apply live without re-mounting.
- Real memory data comes from `public/holo_bridge.py` (read-only local HTTP bridge over the plugin SQLite db), because the holographic plugin is local-only with no network API.
- `noPropertyAccessFromIndexSignature` is off in tsconfig: the HUD's settings objects are dynamically keyed (dot access everywhere); keep it off so TS4111 errors don't reappear.
- Color themes (`src/components/hud/themes.ts`) work by setting/clearing inline CSS variables on `document.documentElement`; the "Cyan Ops" default must stay an empty vars map so the stylesheet values win. Never hardcode colors in HUD components — add tokens to `styles.css` and override them per theme.
