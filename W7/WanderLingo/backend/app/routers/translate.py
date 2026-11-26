"""Core translation, language detection, and bulk translation routes (Tutorial Sections 3-5)."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import enforce_rate_limit, get_translation_engine
from app.schemas import (
    BulkTranslateRequest,
    BulkTranslateResponse,
    DetectRequest,
    DetectResponse,
    TranslateRequest,
    TranslateResponse,
)
from app.services.translator_service import TranslationEngine

router = APIRouter(
    prefix="/api",
    tags=["Core Translation & Detection"],
    dependencies=[Depends(enforce_rate_limit)],
)


@router.post("/detect", response_model=DetectResponse)
async def detect_language(
    payload: DetectRequest,
    engine: TranslationEngine = Depends(get_translation_engine),
) -> DetectResponse:
    return await engine.detect(
        text=payload.text,
        service_preset=payload.service_preset,
    )


@router.post("/translate", response_model=TranslateResponse)
async def translate_text(
    payload: TranslateRequest,
    engine: TranslationEngine = Depends(get_translation_engine),
) -> TranslateResponse:
    return await engine.translate(
        text=payload.text,
        src=payload.src,
        dest=payload.dest,
        service_preset=payload.service_preset,
    )


@router.post("/translate/bulk", response_model=BulkTranslateResponse)
async def translate_bulk(
    payload: BulkTranslateRequest,
    engine: TranslationEngine = Depends(get_translation_engine),
) -> BulkTranslateResponse:
    return await engine.translate_bulk(
        texts=payload.texts,
        src=payload.src,
        dest=payload.dest,
        skip_same_language=payload.skip_same_language,
        service_preset=payload.service_preset,
    )
