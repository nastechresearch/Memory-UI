#!/usr/bin/env python3
"""Read-only loopback bridge between the local Nastech memory store and Memory UI.

Run beside your Nastech profile database:
  python3 holo_bridge.py --db /path/to/memory_store.db

The service binds only to loopback. Browser access is limited to the NastechResearch
GitHub Pages origin and local development URLs; customize with the comma-separated
NASTECH_HUD_ALLOWED_ORIGINS environment variable when using a trusted custom domain.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

LOG = logging.getLogger("nastech-hud-bridge")
DEFAULT_ALLOWED_ORIGINS = {
    "https://nastechresearch.github.io",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
}


def allowed_origins() -> set[str]:
    configured = os.environ.get("NASTECH_HUD_ALLOWED_ORIGINS", "").strip()
    if not configured:
        return DEFAULT_ALLOWED_ORIGINS.copy()
    return {origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()}


def _query(db_path: str | os.PathLike[str], sql: str, params: tuple = ()) -> list[dict]:
    path = Path(db_path).expanduser().resolve()
    con = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True, timeout=2)
    con.row_factory = sqlite3.Row
    try:
        return [dict(row) for row in con.execute(sql, params)]
    finally:
        con.close()


def get_stats(db_path: str | os.PathLike[str]) -> dict:
    """Return read-only plugin facts for the browser HUD; never return DB paths."""
    facts = _query(
        db_path,
        "SELECT COUNT(*) n, COALESCE(AVG(trust_score),0) trust, "
        "COALESCE(SUM(retrieval_count),0) recalls, COALESCE(SUM(helpful_count),0) helpful, "
        "SUM(retrieval_count>0) recalled FROM facts",
    )[0]
    categories = _query(db_path, "SELECT category, COUNT(*) n FROM facts GROUP BY category ORDER BY n DESC")
    entities = _query(db_path, "SELECT COUNT(*) n FROM entities")[0]["n"]
    links = _query(db_path, "SELECT COUNT(*) n FROM fact_entities")[0]["n"]
    recent = _query(
        db_path,
        "SELECT fact_id id, content, category, trust_score trust, retrieval_count recalls, updated_at "
        "FROM facts ORDER BY updated_at DESC LIMIT 8",
    )
    top_entities = _query(
        db_path,
        "SELECT e.name, COUNT(*) n FROM entities e JOIN fact_entities fe USING(entity_id) "
        "GROUP BY e.entity_id ORDER BY n DESC LIMIT 12",
    )
    return {
        "facts": facts["n"],
        "avg_trust": round(facts["trust"], 3),
        "recalls": facts["recalls"],
        "helpful": facts["helpful"],
        "recalled_facts": facts["recalled"] or 0,
        "entities": entities,
        "links": links,
        "categories": categories,
        "recent": recent,
        "top_entities": top_entities,
    }


def make_handler(db_path: str | os.PathLike[str], origins: set[str] | None = None):
    allowed = origins if origins is not None else allowed_origins()

    class BridgeHandler(BaseHTTPRequestHandler):
        server_version = "NastechHudBridge/1.0"

        def _is_local_host(self) -> bool:
            host = self.headers.get("Host", "").split(":", 1)[0].strip("[]").lower()
            return host in {"localhost", "127.0.0.1", "::1"}

        def _origin(self) -> str | None:
            origin = self.headers.get("Origin")
            return origin if origin in allowed else None

        def _send(self, code: int, body: dict) -> None:
            data = json.dumps(body, default=str).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            origin = self._origin()
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.end_headers()
            self.wfile.write(data)

        def do_OPTIONS(self) -> None:
            origin = self._origin()
            if not self._is_local_host() or not origin:
                self.send_response(403)
                self.end_headers()
                return
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Vary", "Origin")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()

        def do_GET(self) -> None:
            if not self._is_local_host():
                self._send(403, {"error": "Local bridge requests must use localhost or 127.0.0.1."})
                return
            origin = self.headers.get("Origin")
            if origin and not self._origin():
                self._send(403, {"error": "This browser origin is not authorized."})
                return
            path = urlsplit(self.path).path
            if path == "/health":
                self._send(200, {"ok": True, "service": "nastech-holographic-bridge"})
                return
            if path != "/stats":
                self._send(404, {"error": "Not found."})
                return
            try:
                self._send(200, get_stats(db_path))
            except Exception as exc:  # Keep filesystem/schema details out of browser responses.
                LOG.warning("Bridge request failed (%s)", type(exc).__name__)
                self._send(503, {"error": "Memory database unavailable. Check the bridge database path and permissions."})

        def log_message(self, _format: str, *_args: object) -> None:
            return

    return BridgeHandler


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve read-only local Nastech memory data to the HUD")
    default_db = Path(os.environ.get("NASTECH_HOME", Path.home() / ".nastech")) / "memory_store.db"
    parser.add_argument("--db", default=str(default_db), help="path to the plugin SQLite database")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(args.db))
    server.daemon_threads = True
    print(f"Nastech Memory UI bridge listening on http://127.0.0.1:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Nastech Memory UI bridge.")
    finally:
        server.server_close()


if __name__ == "__main__":
    logging.basicConfig(stream=sys.stderr, level=logging.WARNING)
    main()
