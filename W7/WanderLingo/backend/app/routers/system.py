"""System health, supported languages catalog, and cache inspection routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.config import APP_NAME, APP_VERSION, DEFAULT_SERVICE_PRESET
from app.dependencies import get_translation_engine
from app.schemas import HealthResponse, LanguagesResponse
from app.services.adapter import get_googletrans_version
from app.services.translator_service import TranslationEngine

router = APIRouter(prefix="/api", tags=["System & Languages"])


@router.get("/health", response_model=HealthResponse)
async def get_health(
    engine: TranslationEngine = Depends(get_translation_engine),
) -> HealthResponse:
    cache_stats = engine.cache.stats()
    return HealthResponse(
        status="ok",
        app_name=APP_NAME,
        app_version=APP_VERSION,
        googletrans_version=get_googletrans_version(),
        default_preset=DEFAULT_SERVICE_PRESET,
        active_presets=engine.get_service_presets_info(),
        cache_size=cache_stats["size"],
        cache_max_entries=cache_stats["max_entries"],
        cache_ttl_seconds=cache_stats["ttl_seconds"],
        cache_hits=cache_stats["hits"],
        cache_misses=cache_stats["misses"],
    )


@router.get("/languages", response_model=LanguagesResponse)
async def get_languages(
    engine: TranslationEngine = Depends(get_translation_engine),
) -> LanguagesResponse:
    return engine.get_languages_catalog()


@router.post("/cache/clear")
async def clear_cache(
    engine: TranslationEngine = Depends(get_translation_engine),
) -> dict[str, str]:
    engine.cache.clear()
    return {"status": "cleared"}
