# Memory UI

An animated holographic memory HUD built with TanStack Start, React, and TypeScript. The UI can run in demo mode; live data is provided by the local, read-only bridge in `public/holo_bridge.py` when the companion plugin is available.

## About

The bridge reads the plugin's SQLite database locally and is not a remote database API. Keep the bridge and plugin on the trusted local machine; do not expose the bridge publicly without authentication and network protections.

Production builds target Cloudflare Workers and write deployable output to `.output/`.

## Development

Requires [Bun](https://bun.sh/).

```sh
git clone https://github.com/nastechresearch/Memory-UI.git
cd Memory-UI
bun install --frozen-lockfile
bun run dev
```

Useful checks:

```sh
bun run test
bun run build
```

## Repository safeguards

GitHub Actions runs tests and the production build on pushes and pull requests targeting `main`. Successful `main` builds are retained as downloadable artifacts for 30 days. Dependabot opens weekly pull requests for Bun dependencies and GitHub Actions; upgrades are not auto-merged, so CI results can be reviewed before merging.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
