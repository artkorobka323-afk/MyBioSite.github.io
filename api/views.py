"""GET /api/views

Counts profile views by IP address: each unique visitor IP is counted
once, no matter how many times they reload the page. The raw IP is
never stored -- only a salted SHA-256 hash of it.

Requires a Vercel KV database connected to this project (see _kv.py).
"""

import json
from http.server import BaseHTTPRequestHandler

from _kv import get_client_ip, hash_ip, kv_command

UNIQUE_IPS_SET = "profile:unique_view_ips"


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        try:
            ip = get_client_ip(self.headers)
            hashed = hash_ip(ip)

            is_new = kv_command("SADD", UNIQUE_IPS_SET, hashed)
            total = kv_command("SCARD", UNIQUE_IPS_SET)

            self._send_json(200, {
                "views": total,
                "countedThisRequest": is_new == 1
            })
        except Exception as exc:  # noqa: BLE001
            print("views api error:", exc)
            self._send_json(500, {"error": "views_unavailable"})
