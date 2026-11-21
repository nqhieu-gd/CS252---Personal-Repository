"""Phase 0 live verification script for googletrans==4.0.2."""
import asyncio
import sys
import googletrans
from googletrans import LANGUAGES, Translator


def configure_translator(translator: Translator, service_urls: list[str]) -> Translator:
    """Configure googletrans Translator to avoid dead 'webapp' tkk 403 and silent DUMMY_DATA."""
    translator.raise_exception = True
    translator.client_type = "dict-chrome-ex"
    translator.service_urls = list(service_urls)
    return translator


async def run_smoke_tests() -> None:
    print(f"Python version: {sys.version}")
    print(f"googletrans version: {googletrans.__version__}")
    print(f"Total supported LANGUAGES: {len(LANGUAGES)}")

    # 1. Check travel language codes from tutorial
    tutorial_codes = ["en", "vi", "fr", "es", "zh", "zh-cn", "zh-tw", "ja", "ko", "th"]
    for code in tutorial_codes:
        print(f"  code={code!r} -> in LANGUAGES? {code in LANGUAGES} ({LANGUAGES.get(code)})")

    # 2. Test single translate + Chinese variants + detect + pronunciation + bulk
    default_urls = ["translate.google.com"]
    async with Translator(service_urls=default_urls, raise_exception=True) as translator:
        configure_translator(translator, default_urls)

        res_vi = await translator.translate("Hello, how are you?", dest="vi")
        print(
            f"[Single EN->VI] origin={res_vi.origin!r} text={res_vi.text!r} "
            f"src={res_vi.src!r} dest={res_vi.dest!r} pron={res_vi.pronunciation!r}"
        )

        res_ja = await translator.translate("Thank you very much", dest="ja")
        print(
            f"[Single EN->JA] text={res_ja.text!r} pron={res_ja.pronunciation!r}"
        )

        for zh_code in ("zh", "zh-cn", "zh-tw"):
            res_zh = await translator.translate("Welcome to our hotel", dest=zh_code)
            print(f"[Chinese dest={zh_code!r}] text={res_zh.text!r} pron={res_zh.pronunciation!r}")

        det = await translator.detect("¿Dónde está el hotel?")
        print(
            f"[Detect ES] lang={det.lang!r} confidence={det.confidence!r} "
            f"(type={type(det.confidence).__name__})"
        )

        bulk_inputs = [
            "Welcome to our hotel",
            "Thank you for staying with us",
            "Have a safe trip",
        ]
        bulk_res = await translator.translate(bulk_inputs, dest="vi")
        print(f"[Bulk EN->VI] count={len(bulk_res)}")
        for item in bulk_res:
            print(f"  {item.origin!r} -> {item.text!r}")

    # 3. Test all 3 service_urls presets from Tutorial Section 5
    presets = {
        "default": ["translate.google.com"],
        "direct": ["translate.googleapis.com"],
        "redundant": [
            "translate.google.com",
            "translate.google.co.kr",
            "translate.google.co.jp",
        ],
    }
    for name, urls in presets.items():
        async with Translator(service_urls=urls, raise_exception=True) as t:
            configure_translator(t, urls)
            r = await t.translate("Travel safely", dest="vi")
            print(f"[Preset {name}] OK -> {r.text!r} (urls={t.service_urls})")


if __name__ == "__main__":
    asyncio.run(run_smoke_tests())
