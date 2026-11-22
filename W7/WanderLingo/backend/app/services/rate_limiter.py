"""Sliding-window rate limiter protecting the backend and Google Translate endpoint."""
from __future__ import annotations

import math
import time
from collections import deque
from dataclasses import dataclass
from threading import Lock
from typing import Deque, Dict

from app.config import RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_SECONDS


@dataclass
class RateLimitDecision:
    allowed: bool
    remaining: int
    retry_after_seconds: int


class SlidingWindowRateLimiter:
    """Per-client sliding-window rate limiter returning Retry-After when exceeded."""

    def __init__(
        self,
        max_requests: int = RATE_LIMIT_REQUESTS,
        window_seconds: int = RATE_LIMIT_WINDOW_SECONDS,
    ) -> None:
        self.max_requests = max(1, max_requests)
        self.window_seconds = max(1, window_seconds)
        self._buckets: Dict[str, Deque[float]] = {}
        self._lock = Lock()

    def check(self, client_key: str) -> RateLimitDecision:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            bucket = self._buckets.setdefault(client_key, deque())
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= self.max_requests:
                oldest = bucket[0]
                wait_sec = max(1, math.ceil((oldest + self.window_seconds) - now))
                return RateLimitDecision(
                    allowed=False,
                    remaining=0,
                    retry_after_seconds=wait_sec,
                )

            bucket.append(now)
            remaining = max(0, self.max_requests - len(bucket))
            return RateLimitDecision(
                allowed=True,
                remaining=remaining,
                retry_after_seconds=0,
            )

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()
