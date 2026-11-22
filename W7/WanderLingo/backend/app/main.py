"""FastAPI application entrypoint for WanderLingo."""
from __future__ import annotations

from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import ALLOWED_ORIGINS, APP_NAME, APP_VERSION
from app.routers import system, translate, travel
from app.services.translator_service import (
    InvalidLanguageCodeError,
    UpstreamTranslationError,
)


def create_app() -> FastAPI:
    app = FastAPI(
        title=APP_NAME,
        version=APP_VERSION,
        description=(
            "Multilingual Travel Companion API powered by py-googletrans (googletrans==4.0.2). "
            "Implements language detection, single & bulk translation, custom service_urls presets, "
            "Hotel Review Translation, Travel Inquiry Processor, and Destination Guide Translator."
        ),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Retry-After", "X-RateLimit-Remaining"],
    )

    @app.exception_handler(InvalidLanguageCodeError)
    async def handle_invalid_language(
        _request: Request, exc: InvalidLanguageCodeError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "detail": {
                    "code": "INVALID_LANGUAGE_CODE",
                    "message": str(exc),
                }
            },
        )

    @app.exception_handler(UpstreamTranslationError)
    async def handle_upstream_error(
        _request: Request, exc: UpstreamTranslationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=502,
            content={
                "detail": {
                    "code": "UPSTREAM_TRANSLATION_ERROR",
                    "message": str(exc),
                }
            },
        )

    app.include_router(system.router)
    app.include_router(translate.router)
    app.include_router(travel.router)

    # Mount compiled frontend SPA if frontend/dist exists (Single-Command Production Mode)
    frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    assets_dir = frontend_dist / "assets"
    if frontend_dist.is_dir() and (frontend_dist / "index.html").is_file():
        if assets_dir.is_dir():
            app.mount(
                "/assets",
                StaticFiles(directory=str(assets_dir)),
                name="frontend-assets",
            )

        @app.get("/", include_in_schema=False)
        async def serve_spa_index() -> FileResponse:
            return FileResponse(str(frontend_dist / "index.html"))

    return app


app = create_app()
