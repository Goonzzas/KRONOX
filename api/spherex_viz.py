"""Vercel Serverless Function (Python runtime) for SPHEREx-Visualizations in KRONOX.

Exposes `handler(BaseHTTPRequestHandler)` for Vercel's `@vercel/python` runtime and
also supports a zero-port `--stdio-worker` / `--invoke` bridge for Vite's local dev
middleware so no standalone persistent HTTP server is required.
"""

from __future__ import annotations

import base64
import io
import json
import os
import sys
from email.message import Message
from typing import Any, Dict

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(THIS_DIR)
VIZ_DIR = os.path.join(PROJECT_ROOT, "SphereX-Visualizations-main")

if VIZ_DIR not in sys.path:
    sys.path.insert(0, VIZ_DIR)

import server as spherex_server  # noqa: E402
from server import STORE, VisualizerRequestHandler  # noqa: E402


class handler(VisualizerRequestHandler):
    """Vercel Python Serverless entrypoint (`BaseHTTPRequestHandler` subclass)."""

    pass


class _InMemorySocket:
    def __init__(self, raw_request: bytes) -> None:
        self._rfile = io.BytesIO(raw_request)
        self._wfile = io.BytesIO()

    def makefile(self, mode: str, *args: Any, **kwargs: Any) -> io.BytesIO:
        if "r" in mode:
            return self._rfile
        return self._wfile

    def sendall(self, data: bytes) -> None:
        self._wfile.write(data)

    def close(self) -> None:
        pass


def invoke_in_memory(
    method: str,
    url_path: str,
    headers: Dict[str, str] | None = None,
    body_bytes: bytes = b"",
) -> Dict[str, Any]:
    """Execute a request against `handler` in memory without opening any network port."""
    STORE.ensure_initialized()
    hdrs = headers or {}
    lines = [f"{method.upper()} {url_path} HTTP/1.1", "Host: localhost"]
    has_cl = False
    for k, v in hdrs.items():
        if k.lower() == "host":
            continue
        if k.lower() == "content-length":
            has_cl = True
        lines.append(f"{k}: {v}")
    if body_bytes and not has_cl:
        lines.append(f"Content-Length: {len(body_bytes)}")
    raw_head = ("\r\n".join(lines) + "\r\n\r\n").encode("iso-8859-1", errors="replace")
    sock = _InMemorySocket(raw_head + body_bytes)
    handler(sock, ("127.0.0.1", 0), None)
    raw_resp = sock._wfile.getvalue()

    sep = b"\r\n\r\n"
    idx = raw_resp.find(sep)
    if idx == -1:
        sep = b"\n\n"
        idx = raw_resp.find(sep)
    if idx == -1:
        return {"status": 500, "headers": {"Content-Type": "application/json"}, "body": b'{"ok":false,"error":"Empty response"}'}

    head_block = raw_resp[:idx].decode("iso-8859-1", errors="replace")
    payload = raw_resp[idx + len(sep) :]
    head_lines = head_block.splitlines()
    status_code = 200
    if head_lines:
        parts = head_lines[0].split()
        if len(parts) >= 2 and parts[1].isdigit():
            status_code = int(parts[1])

    out_headers: Dict[str, str] = {}
    for line in head_lines[1:]:
        if ":" in line:
            hk, hv = line.split(":", 1)
            k_trim = hk.strip()
            if k_trim.lower() in ("server", "date"):
                continue
            out_headers[k_trim] = hv.strip()

    return {
        "status": status_code,
        "headers": out_headers,
        "body": payload,
    }


def _run_stdio_worker() -> None:
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    STORE.ensure_initialized()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            method = str(req.get("method", "GET"))
            url = str(req.get("url", "/api/health"))
            headers = req.get("headers") or {}
            body_b64 = req.get("body_b64") or ""
            body_bytes = base64.b64decode(body_b64) if body_b64 else b""
            res = invoke_in_memory(method, url, headers, body_bytes)
            out = {
                "id": req_id,
                "status": res["status"],
                "headers": res["headers"],
                "body_b64": base64.b64encode(res["body"]).decode("ascii"),
            }
        except Exception as exc:
            err_bytes = json.dumps({"ok": False, "error": str(exc)}).encode("utf-8")
            out = {
                "id": req_id,
                "status": 500,
                "headers": {"Content-Type": "application/json; charset=utf-8"},
                "body_b64": base64.b64encode(err_bytes).decode("ascii"),
            }
        real_stdout.write(json.dumps(out) + "\n")
        real_stdout.flush()


if __name__ == "__main__":
    if "--stdio-worker" in sys.argv:
        _run_stdio_worker()
    elif "--invoke" in sys.argv:
        idx = sys.argv.index("--invoke")
        method = sys.argv[idx + 1] if len(sys.argv) > idx + 1 else "GET"
        url = sys.argv[idx + 2] if len(sys.argv) > idx + 2 else "/api/health"
        res = invoke_in_memory(method, url)
        sys.stdout.buffer.write(res["body"])
