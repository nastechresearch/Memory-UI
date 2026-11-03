# Nastech Memory UI

An animated holographic HUD maintained by Nastech Research. Production and demo are separate static GitHub Pages builds; the production page can optionally connect to the user's local, read-only Nastech memory bridge.

## GitHub Pages

- **Production:** <https://nastechresearch.github.io/Memory-UI/>
- **Demo:** <https://nastechresearch.github.io/Memory-UI/demo/>

The production build starts disconnected. A user must explicitly connect once in the HUD settings; that choice is saved in the browser and is reused on later visits while the local bridge is running. The visual CPU/GPU/activity indicators are animated/synthetic; only plugin memory data is live when the status reads **LIVE MEMORY**. The demo is sample-only and never requests a local connection.

Pages is a static host. It does not run Python or access the visitor's machine by itself. Live memory remains local: the browser talks to a bridge bound to loopback (`127.0.0.1`), and the bridge is read-only. The connection returns fact text and entity names to the page, so connect only from a Nastech Research origin you trust.

## Holographic plugin connection

The companion [Nastech holographic plugin](https://github.com/nastechtest/nastech-plugin-holographic) currently stores memory in local SQLite and does not provide an HTTP API or auto-start this bridge. Installing the plugin alone therefore does not start the HUD connection. To connect:

1. Install/configure the plugin using its repository instructions.
2. Download `holo_bridge.py` from the production HUD settings or this repository's `public/` folder.
3. Run it beside the active profile's database, for example:

   ```sh
   python3 holo_bridge.py --db /path/to/nastech/profile/memory_store.db
   ```

4. In production HUD settings, choose **Connect** once. The browser remembers the URL; future visits reconnect automatically while the bridge is running. Choose **Disconnect** to revoke that saved browser choice.

The bridge binds only to loopback, checks the browser origin and Host header, returns no database path, and uses read-only SQLite connections. By default it accepts `https://nastechresearch.github.io` and local development origins. For a trusted custom domain, set `NASTECH_HUD_ALLOWED_ORIGINS` to a comma-separated list of exact origins before starting the bridge. Browser support for HTTPS-to-loopback/private-network access varies; the UI can be used in sample mode if the browser blocks it.

## Development and builds

Requires [Bun](https://bun.sh/).

```sh
git clone https://github.com/nastechresearch/Memory-UI.git
cd Memory-UI
bun install --frozen-lockfile
bun run dev
```

```sh
bun run test
bun run build          # Cloudflare Worker output in .output/
bun run build:pages    # Static client-only Pages output in dist/
```

The Pages workflow builds production at the repository root and the isolated demo under `/demo/`, with each build's base path set explicitly. The public page does not contain plugin database contents or credentials.

## Repository safeguards

GitHub Actions runs unit tests, a Cloudflare build, and Pages production/demo builds on pushes and pull requests. A separate cross-repository compatibility workflow checks the bridge's SQLite queries against the public plugin's current schema on pushes and weekly. Dependabot opens weekly pull requests for Bun packages and GitHub Actions; upgrades are reviewed through CI rather than auto-merged.

## Built with

- TanStack Start for the server-capable worker build
- React and TypeScript
- Tailwind CSS
- Vite for the static Pages build
