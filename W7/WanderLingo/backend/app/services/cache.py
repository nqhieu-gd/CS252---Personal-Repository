"""Bounded LRU + TTL in-memory cache for WanderLingo translation & detection results."""
from __future__ import annotations

import time
from collections import OrderedDict
from dataclasses import dataclass
from threading import Lock
from typing import Any, Generic, Optional, Tuple, TypeVar

from app.config import CACHE_MAX_ENTRIES, CACHE_TTL_SECONDS

T = TypeVar("T")


@dataclass
class _CacheEntry(Generic[T]):
    value: T
    expires_at: float


class TTLLRUCache(Generic[T]):
    """Thread-safe bounded LRU cache with time-to-live expiration."""

    def __init__(
        self,
        max_entries: int = CACHE_MAX_ENTRIES,
        ttl_seconds: int = CACHE_TTL_SECONDS,
    ) -> None:
        self.max_entries = max(1, max_entries)
        self.ttl_seconds = max(1, ttl_seconds)
        self._store: "OrderedDict[Tuple[Any, ...], _CacheEntry[T]]" = OrderedDict()
        self._lock = Lock()
        self._hits = 0
        self._misses = 0

    def get(self, key: Tuple[Any, ...]) -> Optional[T]:
        now = time.monotonic()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None
            if now >= entry.expires_at:
                self._store.pop(key, None)
                self._misses += 1
                return None
            self._store.move_to_end(key)
            self._hits += 1
            return entry.value

    def set(self, key: Tuple[Any, ...], value: T) -> None:
        now = time.monotonic()
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
            self._store[key] = _CacheEntry(
                value=value,
                expires_at=now + self.ttl_seconds,
            )
            while len(self._store) > self.max_entries:
                self._store.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
            self._hits = 0
            self._misses = 0

    def stats(self) -> dict[str, int]:
        now = time.monotonic()
        with self._lock:
            expired_keys = [k for k, v in self._store.items() if now >= v.expires_at]
            for k in expired_keys:
                self._store.pop(k, None)
            return {
                "size": len(self._store),
                "max_entries": self.max_entries,
                "ttl_seconds": self.ttl_seconds,
                "hits": self._hits,
                "misses": self._misses,
            }
