#!/usr/bin/env python3
"""Nastech Holographic HUD bridge.

Reads your holographic plugin's SQLite store (memory_store.db) read-only and
serves live stats to the Neural Memory HUD.

  python holo_bridge.py                      # uses $NASTECH_HOME/memory_store.db
  python holo_bridge.py --db /path/memory_store.db --port 8765

Then in the HUD: Brain Settings -> Bridge URL -> http://localhost:8765
"""
import argparse, json, os, sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ap = argparse.ArgumentParser()
ap.add_argument("--db", default=os.path.join(os.environ.get("NASTECH_HOME", os.path.expanduser("~/.nastech")), "memory_store.db"))
ap.add_argument("--port", type=int, default=8765)
args = ap.parse_args()


def q(sql, params=()):
    con = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in con.execute(sql, params)]
    finally:
        con.close()


def stats():
    f = q("SELECT COUNT(*) n, COALESCE(AVG(trust_score),0) trust, COALESCE(SUM(retrieval_count),0) recalls,"
          " COALESCE(SUM(helpful_count),0) helpful, SUM(retrieval_count>0) recalled FROM facts")[0]
    cats = q("SELECT category, COUNT(*) n FROM facts GROUP BY category ORDER BY n DESC")
    ents = q("SELECT COUNT(*) n FROM entities")[0]["n"]
    links = q("SELECT COUNT(*) n FROM fact_entities")[0]["n"]
    recent = q("SELECT fact_id id, content, category, trust_score trust, retrieval_count recalls, updated_at"
               " FROM facts ORDER BY updated_at DESC LIMIT 8")
    top = q("SELECT e.name, COUNT(*) n FROM entities e JOIN fact_entities fe USING(entity_id)"
            " GROUP BY e.entity_id ORDER BY n DESC LIMIT 12")
    return {"facts": f["n"], "avg_trust": round(f["trust"], 3), "recalls": f["recalls"], "helpful": f["helpful"],
            "recalled_facts": f["recalled"] or 0, "entities": ents, "links": links,
            "categories": cats, "recent": recent, "top_entities": top}


class H(BaseHTTPRequestHandler):
    def _send(self, code, body):
        data = json.dumps(body, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        try:
            self._send(200, stats() if self.path.startswith("/stats") else {"ok": True, "db": args.db})
        except Exception as e:  # noqa: BLE001
            self._send(500, {"error": str(e)})

    def log_message(self, *a):
        pass


print(f"Holographic HUD bridge on http://localhost:{args.port}  (db: {args.db})")
ThreadingHTTPServer(("127.0.0.1", args.port), H).serve_forever()
