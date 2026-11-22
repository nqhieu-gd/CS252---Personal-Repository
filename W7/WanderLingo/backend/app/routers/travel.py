"""Travel application routes implementing Tutorial Section 6 (Examples 1, 2, and 3)."""
from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter, Depends

from app.data.travel_samples import (
    SAMPLE_DESTINATIONS,
    SAMPLE_HOTEL_REVIEWS,
    SAMPLE_PHRASEBOOK,
    SAMPLE_TRAVEL_INQUIRIES,
)
from app.dependencies import enforce_rate_limit, get_translation_engine
from app.schemas import (
    DestinationTranslateRequest,
    DestinationTranslateResponse,
    HotelReviewTranslateRequest,
    HotelReviewTranslateResponse,
    TravelInquiryReplyRequest,
    TravelInquiryReplyResponse,
    TravelInquiryRequest,
    TravelInquiryResponse,
)
from app.services.translator_service import TranslationEngine

router = APIRouter(prefix="/api/travel", tags=["Travel Applications (Section 6)"])


@router.get("/samples")
async def get_travel_samples() -> Dict[str, Any]:
    return {
        "destinations": SAMPLE_DESTINATIONS,
        "reviews": SAMPLE_HOTEL_REVIEWS,
        "inquiries": SAMPLE_TRAVEL_INQUIRIES,
        "phrasebook": SAMPLE_PHRASEBOOK,
    }


@router.post(
    "/reviews",
    response_model=HotelReviewTranslateResponse,
    dependencies=[Depends(enforce_rate_limit)],
)
async def translate_hotel_reviews(
    payload: HotelReviewTranslateRequest,
    engine: TranslationEngine = Depends(get_translation_engine),
) -> HotelReviewTranslateResponse:
    return await engine.translate_hotel_reviews(
        reviews=payload.reviews,
        target_language=payload.target_language,
        service_preset=payload.service_preset,
    )


@router.post(
    "/inquiry",
    response_model=TravelInquiryResponse,
    dependencies=[Depends(enforce_rate_limit)],
)
async def process_travel_inquiry(
    payload: TravelInquiryRequest,
    engine: TranslationEngine = Depends(get_translation_engine),
) -> TravelInquiryResponse:
    return await engine.process_travel_inquiry(
        inquiry_text=payload.inquiry_text,
        target_language=payload.target_language,
        service_preset=payload.service_preset,
    )


@router.post(
    "/inquiry/reply",
    response_model=TravelInquiryReplyResponse,
    dependencies=[Depends(enforce_rate_limit)],
)
async def translate_inquiry_reply(
    payload: TravelInquiryReplyRequest,
    engine: TranslationEngine = Depends(get_translation_engine),
) -> TravelInquiryReplyResponse:
    return await engine.translate_inquiry_reply(
        reply_text=payload.reply_text,
        staff_language=payload.staff_language,
        guest_language=payload.guest_language,
        service_preset=payload.service_preset,
    )


@router.post(
    "/destination",
    response_model=DestinationTranslateResponse,
    dependencies=[Depends(enforce_rate_limit)],
)
async def translate_destination_info(
    payload: DestinationTranslateRequest,
    engine: TranslationEngine = Depends(get_translation_engine),
) -> DestinationTranslateResponse:
    return await engine.translate_destination_info(
        destination_data=payload.destination_data,
        target_language=payload.target_language,
        service_preset=payload.service_preset,
    )
