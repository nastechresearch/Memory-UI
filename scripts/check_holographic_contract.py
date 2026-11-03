#!/usr/bin/env python3
"""Verify the Memory UI bridge against the upstream holographic plugin schema."""
from __future__ import annotations

import argparse
import ast
import importlib.util
import sqlite3
import tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def assignment(tree: ast.Module, name: str) -> ast.expr:
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == name for target in node.targets):
            return node.value
    raise ValueError(f"Could not find {name} in upstream store.py")


def evaluate_string(node: ast.expr, names: dict[str, str]) -> str:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.Name) and node.id in names:
        return names[node.id]
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        return evaluate_string(node.left, names) + evaluate_string(node.right, names)
    raise ValueError(f"Unsupported expression in plugin schema: {ast.dump(node)}")


def plugin_schema(store_path: Path) -> str:
    tree = ast.parse(store_path.read_text(encoding="utf-8"), filename=str(store_path))
    names = {"_FACTS_AU": evaluate_string(assignment(tree, "_FACTS_AU"), {})}
    return evaluate_string(assignment(tree, "_SCHEMA"), names)


def load_bridge(bridge_path: Path):
    spec = importlib.util.spec_from_file_location("nastech_holo_bridge", bridge_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load local bridge module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def verify_http_policy(bridge, database: Path) -> None:
    origin = "https://nastechresearch.github.io"
    server = ThreadingHTTPServer(("127.0.0.1", 0), bridge.make_handler(database, {origin}))
    worker = Thread(target=server.serve_forever, daemon=True)
    worker.start()
    url = f"http://127.0.0.1:{server.server_port}"
    try:
        with urlopen(Request(f"{url}/stats", headers={"Origin": origin}), timeout=3) as response:
            assert response.status == 200
            assert response.headers.get("Access-Control-Allow-Origin") == origin
            assert response.headers.get("Access-Control-Allow-Origin") != "*"

        preflight = Request(
            f"{url}/stats",
            headers={"Origin": origin, "Access-Control-Request-Private-Network": "true"},
            method="OPTIONS",
        )
        with urlopen(preflight, timeout=3) as response:
            assert response.status == 204
            assert response.headers.get("Access-Control-Allow-Private-Network") == "true"

        for headers in (
            {"Origin": "https://untrusted.example"},
            {"Origin": origin, "Host": "untrusted.example"},
        ):
            try:
                urlopen(Request(f"{url}/stats", headers=headers), timeout=3)
            except HTTPError as error:
                assert error.code == 403
            else:
                raise AssertionError(f"Bridge accepted an unauthorized request: {headers}")
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=3)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plugin-store", type=Path, required=True)
    parser.add_argument("--bridge", type=Path, default=Path(__file__).resolve().parents[1] / "public" / "holo_bridge.py")
    args = parser.parse_args()

    schema = plugin_schema(args.plugin_store)
    bridge = load_bridge(args.bridge)
    with tempfile.TemporaryDirectory() as tmp:
        database = Path(tmp) / "memory_store.db"
        connection = sqlite3.connect(database)
        connection.executescript(schema)
        fact = connection.execute(
            "INSERT INTO facts (content, category, tags, trust_score, retrieval_count, helpful_count) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("Contract test memory", "preferences", "contract", 0.8, 2, 1),
        ).lastrowid
        entity = connection.execute(
            "INSERT INTO entities (name, entity_type) VALUES (?, ?)", ("Nastech", "declared")
        ).lastrowid
        connection.execute("INSERT INTO fact_entities (fact_id, entity_id) VALUES (?, ?)", (fact, entity))
        connection.commit()
        connection.close()

        result = bridge.get_stats(database)
        assert result["facts"] == 1, result
        assert result["avg_trust"] == 0.8, result
        assert result["entities"] == 1 and result["links"] == 1, result
        assert result["categories"] == [{"category": "preferences", "n": 1}], result
        assert result["recent"][0]["content"] == "Contract test memory", result
        assert result["top_entities"] == [{"name": "Nastech", "n": 1}], result
        verify_http_policy(bridge, database)

    print("Plugin schema, bridge stats, and HTTP origin policy: OK")


if __name__ == "__main__":
    main()
