"""GET/POST /api/comments

GET  -> returns the shared list of comments (visible to every visitor)
POST -> adds a comment, but only if this visitor's IP hasn't already
        posted MAX_COMMENTS_PER_IP comments. The limit is enforced
        server-side using a salted hash of the IP, so it can't be
        bypassed by clearing localStorage or switching browsers on the
        same connection.

Requires a Vercel KV database connected to this project (see _kv.py).
"""

import json
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

from _kv import get_client_ip, hash_ip, kv_command

COMMENTS_LIST_KEY = "profile:comments_list"
COMMENT_COUNTS_KEY = "profile:comment_counts_by_ip"
MAX_COMMENTS_PER_IP = 3
MAX_STORED_COMMENTS = 500
MAX_NAME_LENGTH = 30
MAX_TEXT_LENGTH = 300
ALLOWED_AVATARS = ("a1", "a2", "a3")


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
            raw = kv_command("LRANGE", COMMENTS_LIST_KEY, 0, -1) or []
            comments = []
            for entry in raw:
                try:
                    comments.append(json.loads(entry) if isinstance(entry, str) else entry)
                except Exception:  # noqa: BLE001
                    continue
            self._send_json(200, {"comments": comments})
        except Exception as exc:  # noqa: BLE001
            print("comments api error (GET):", exc)
            self._send_json(500, {"error": "comments_unavailable"})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            raw_body = self.rfile.read(length) if length else b"{}"
            try:
                data = json.loads(raw_body.decode("utf-8"))
            except Exception:  # noqa: BLE001
                data = {}

            name = str(data.get("name", "")).strip()[:MAX_NAME_LENGTH]
            text = str(data.get("text", "")).strip()[:MAX_TEXT_LENGTH]
            avatar = data.get("avatar")
            avatar = avatar if avatar in ALLOWED_AVATARS else ALLOWED_AVATARS[0]

            if not name or not text:
                self._send_json(400, {
                    "error": "invalid_input",
                    "message": "Name and comment text are required."
                })
                return

            ip = get_client_ip(self.headers)
            hashed_ip = hash_ip(ip)

            new_count = kv_command("HINCRBY", COMMENT_COUNTS_KEY, hashed_ip, 1)
            if new_count > MAX_COMMENTS_PER_IP:
                kv_command("HINCRBY", COMMENT_COUNTS_KEY, hashed_ip, -1)
                self._send_json(429, {
                    "error": "limit_reached",
                    "message": f"Comment limit reached ({MAX_COMMENTS_PER_IP} per IP)."
                })
                return

            comment = {
                "id": str(uuid.uuid4()),
                "name": name,
                "text": text,
                "avatar": avatar,
                "date": datetime.now(timezone.utc).isoformat()
            }

            kv_command("RPUSH", COMMENTS_LIST_KEY, json.dumps(comment))
            kv_command("LTRIM", COMMENTS_LIST_KEY, -MAX_STORED_COMMENTS, -1)

            self._send_json(201, {
                "comment": comment,
                "remaining": MAX_COMMENTS_PER_IP - new_count
            })
        except Exception as exc:  # noqa: BLE001
            print("comments api error (POST):", exc)
            self._send_json(500, {"error": "comments_unavailable"})
