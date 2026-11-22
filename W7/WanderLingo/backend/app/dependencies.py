"""Shared FastAPI dependencies for WanderLingo backend."""
from __future__ import annotations

from fastapi import HTTPException, Request, Response

from app.services.rate_limiter import SlidingWindowRateLimiter
from app.services.translator_service import TranslationEngine

_engine = TranslationEngine()
_rate_limiter = SlidingWindowRateLimiter()


def get_translation_engine() -> TranslationEngine:
    return _engine


def set_translation_engine(engine: TranslationEngine) -> None:
    global _engine
    _engine = engine


def get_rate_limiter() -> SlidingWindowRateLimiter:
    return _rate_limiter


def set_rate_limiter(limiter: SlidingWindowRateLimiter) -> None:
    global _rate_limiter
    _rate_limiter = limiter


async def enforce_rate_limit(request: Request, response: Response) -> None:
    client_host = request.client.host if request.client else "127.0.0.1"
    decision = _rate_limiter.check(client_host)
    response.headers["X-RateLimit-Remaining"] = str(decision.remaining)
    if not decision.allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMIT_EXCEEDED",
                "message": (
                    f"Rate limit exceeded. Please wait {decision.retry_after_seconds}s before retrying."
                ),
                "retry_after_seconds": decision.retry_after_seconds,
            },
            headers={"Retry-After": str(decision.retry_after_seconds)},
        )
