"""Small helper shared by the Python API functions to talk to Vercel KV
(Upstash Redis) over its REST API, and to hash visitor IPs consistently.

Vercel KV automatically sets KV_REST_API_URL and KV_REST_API_TOKEN as
environment variables once a KV database is connected to the project
(Storage -> Create Database -> KV in the Vercel dashboard).
"""

import hashlib
import os

import requests

KV_URL = os.environ.get("KV_REST_API_URL")
KV_TOKEN = os.environ.get("KV_REST_API_TOKEN")


def kv_command(*args):
    """Run a single Redis command against the Upstash REST API.

    Example: kv_command("HINCRBY", "some:key", "field", 1)
    """
    if not KV_URL or not KV_TOKEN:
        raise RuntimeError("KV_REST_API_URL / KV_REST_API_TOKEN are not set")

    response = requests.post(
        KV_URL,
        headers={"Authorization": f"Bearer {KV_TOKEN}"},
        json=list(args),
        timeout=5,
    )
    response.raise_for_status()
    return response.json().get("result")


def hash_ip(ip: str) -> str:
    """Salted hash of an IP address so the raw IP is never stored."""
    salt = os.environ.get("VIEWS_SALT", "default-salt-change-me")
    return hashlib.sha256((ip + salt).encode("utf-8")).hexdigest()


def get_client_ip(headers) -> str:
    forwarded = headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return "unknown"
