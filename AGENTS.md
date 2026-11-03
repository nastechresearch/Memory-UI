<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- HUD canvases read the mutable `hudSettings` object every frame so settings apply live without re-mounting.
- Real memory data comes from `public/holo_bridge.py` (read-only local HTTP bridge over the plugin SQLite db), because the holographic plugin is local-only with no network API.
- `noPropertyAccessFromIndexSignature` is off in tsconfig: the HUD's settings objects are dynamically keyed (dot access everywhere); keep it off so TS4111 errors don't reappear.
- Color themes (`src/components/hud/themes.ts`) work by setting/clearing inline CSS variables on `document.documentElement`; the "Cyan Ops" default must stay an empty vars map so the stylesheet values win. Never hardcode colors in HUD components — add tokens to `styles.css` and override them per theme.
