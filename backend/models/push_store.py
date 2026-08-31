"""Web Push subscription persistence (SQLite).

Stores the browser PushSubscription objects so the backend can deliver native
push notifications when a fresh BUY/SELL signal fires. Uses the stdlib sqlite3
module, mirrors the SignalHistory pattern. Best-effort: a DB failure never
breaks an analysis.
"""

import json
import sqlite3
import threading

SCHEMA = """
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
);
"""


class PushStore:
    def __init__(self, path):
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(SCHEMA)
        self._conn.commit()

    def add(self, endpoint, p256dh, auth, user_agent=None):
        now = _now()
        try:
            with self._lock:
                self._conn.execute(
                    "INSERT INTO push_subscriptions"
                    " (endpoint, p256dh, auth, user_agent, created_at, last_seen_at)"
                    " VALUES (?, ?, ?, ?, ?, ?)"
                    " ON CONFLICT(endpoint) DO UPDATE SET"
                    " p256dh=excluded.p256dh, auth=excluded.auth,"
                    " user_agent=excluded.user_agent, last_seen_at=excluded.last_seen_at",
                    (endpoint, p256dh, auth, user_agent, now, now),
                )
                self._conn.commit()
        except sqlite3.Error:
            pass

    def remove(self, endpoint):
        try:
            with self._lock:
                self._conn.execute(
                    "DELETE FROM push_subscriptions WHERE endpoint = ?", (endpoint,)
                )
                self._conn.commit()
        except sqlite3.Error:
            pass

    def remove_many(self, endpoints):
        try:
            with self._lock:
                for ep in endpoints:
                    self._conn.execute(
                        "DELETE FROM push_subscriptions WHERE endpoint = ?", (ep,)
                    )
                self._conn.commit()
        except sqlite3.Error:
            pass

    def all(self):
        rows = []
        try:
            with self._lock:
                self._conn.row_factory = sqlite3.Row
                rows = self._conn.execute(
                    "SELECT endpoint, p256dh, auth FROM push_subscriptions"
                ).fetchall()
        except sqlite3.Error:
            return []
        return [dict(r) for r in rows]

    def count(self):
        try:
            with self._lock:
                row = self._conn.execute(
                    "SELECT COUNT(*) FROM push_subscriptions"
                ).fetchone()
                return row[0] if row else 0
        except sqlite3.Error:
            return 0

    def close(self):
        try:
            with self._lock:
                self._conn.close()
        except sqlite3.Error:
            pass


def _now():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
