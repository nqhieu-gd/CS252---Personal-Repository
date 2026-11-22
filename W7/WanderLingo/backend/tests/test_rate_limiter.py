"""Unit tests for SlidingWindowRateLimiter."""
from __future__ import annotations

from app.services.rate_limiter import SlidingWindowRateLimiter


def test_rate_limiter_allows_within_quota_and_blocks_excess() -> None:
    limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=30)

    d1 = limiter.check("127.0.0.1")
    d2 = limiter.check("127.0.0.1")
    d3 = limiter.check("127.0.0.1")
    assert d1.allowed is True and d1.remaining == 2
    assert d2.allowed is True and d2.remaining == 1
    assert d3.allowed is True and d3.remaining == 0

    # 4th request within window must be blocked with Retry-After > 0
    d4 = limiter.check("127.0.0.1")
    assert d4.allowed is False
    assert d4.remaining == 0
    assert d4.retry_after_seconds >= 1

    # Different client IP is unaffected
    other = limiter.check("192.168.1.50")
    assert other.allowed is True
