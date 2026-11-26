"""FastAPI HTTP contract tests across all system, translation, and travel endpoints."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.dependencies import set_rate_limiter
from app.services.rate_limiter import SlidingWindowRateLimiter


def test_health_and_languages_endpoints(client: TestClient) -> None:
    h = client.get("/api/health")
    assert h.status_code == 200
    body = h.json()
    assert body["status"] == "ok"
    assert len(body["active_presets"]) == 3

    langs = client.get("/api/languages")
    assert langs.status_code == 200
    lbody = langs.json()
    assert lbody["total_count"] >= 100
    travel_codes = {item["code"] for item in lbody["travel_languages"]}
    assert {"en", "vi", "fr", "es", "zh-cn", "ja", "ko", "th"}.issubset(travel_codes)


def test_detect_and_translate_endpoints(client: TestClient) -> None:
    det = client.post("/api/detect", json={"text": "¿Dónde está el hotel?"})
    assert det.status_code == 200
    assert det.json()["lang"] == "es"

    tr = client.post(
        "/api/translate",
        json={"text": "Hpw do I reverve a room?", "src": "auto", "dest": "vi"},
    )
    assert tr.status_code == 200
    assert tr.json()["did_you_mean"] == "How do I reserve a room?"

    bulk = client.post(
        "/api/translate/bulk",
        json={
            "texts": ["Hello, how are you?", "Khách sạn này rất tuyệt vời! Nhân viên thân thiện."],
            "src": "auto",
            "dest": "en",
            "skip_same_language": True,
        },
    )
    assert bulk.status_code == 200
    assert bulk.json()["summary"]["total"] == 2
    assert bulk.json()["summary"]["skipped_count"] == 1


def test_invalid_language_returns_422(client: TestClient) -> None:
    res = client.post(
        "/api/translate",
        json={"text": "Hello", "src": "auto", "dest": "invalid_lang_xyz"},
    )
    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "INVALID_LANGUAGE_CODE"


def test_bulk_and_travel_endpoints(client: TestClient) -> None:
    samples = client.get("/api/travel/samples")
    assert samples.status_code == 200
    sdata = samples.json()
    assert len(sdata["destinations"]) >= 8
    assert len(sdata["reviews"]) >= 3
    assert len(sdata["inquiries"]) >= 4
    phrasebook_by_cat = {c["category"]: c["phrases"] for c in sdata["phrasebook"]}
    assert len(phrasebook_by_cat["hotel"]) >= 6
    assert len(phrasebook_by_cat["transport"]) >= 6
    assert len(phrasebook_by_cat["dining"]) >= 6
    assert len(phrasebook_by_cat["emergency"]) >= 8
    all_phrases = [p for c in sdata["phrasebook"] for p in c["phrases"]]
    assert "¿Dónde está el hotel?" not in all_phrases
    assert "Welcome to our hotel" not in all_phrases
    assert "Thank you for staying with us" not in all_phrases

    rev_res = client.post(
        "/api/travel/reviews",
        json={
            "reviews": [
                {"id": "1", "author": "A", "text": "Khách sạn này rất tuyệt vời! Nhân viên thân thiện."},
                {"id": "2", "author": "B", "text": "I want to book a hotel in Hanoi"},
            ],
            "target_language": "en",
        },
    )
    assert rev_res.status_code == 200
    assert rev_res.json()["summary"]["translated_count"] == 1
    assert rev_res.json()["summary"]["skipped_count"] == 1

    inq_res = client.post(
        "/api/travel/inquiry",
        json={
            "inquiry_text": "空港からホテルまでの交通手段は？",
            "target_language": "en",
        },
    )
    assert inq_res.status_code == 200
    assert inq_res.json()["needs_translation"] is True
    assert inq_res.json()["detected_lang"] == "ja"

    rep_res = client.post(
        "/api/travel/inquiry/reply",
        json={
            "reply_text": "Hello, how are you?",
            "staff_language": "en",
            "guest_language": "ja",
        },
    )
    assert rep_res.status_code == 200
    assert rep_res.json()["dest"] == "ja"
    assert rep_res.json()["pronunciation"] is not None

    dest_res = client.post(
        "/api/travel/destination",
        json={
            "destination_data": {"name": "Hanoi", "rating": 4.8},
            "target_language": "vi",
        },
    )
    assert dest_res.status_code == 200
    assert dest_res.json()["translated_data"]["rating"] == 4.8


def test_rate_limit_returns_429_with_retry_after_header(client: TestClient) -> None:
    set_rate_limiter(SlidingWindowRateLimiter(max_requests=1, window_seconds=60))
    ok_res = client.post("/api/detect", json={"text": "Hello, how are you?"})
    assert ok_res.status_code == 200

    blocked_res = client.post("/api/detect", json={"text": "Hello, how are you?"})
    assert blocked_res.status_code == 429
    assert "Retry-After" in blocked_res.headers
    assert blocked_res.json()["detail"]["code"] == "RATE_LIMIT_EXCEEDED"
