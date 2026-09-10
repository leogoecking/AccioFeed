from app.translation.base import (
    ArticleTranslationResult,
    BaseTranslationProvider,
    TranslationResult,
)


class MockTranslationProvider(BaseTranslationProvider):
    """Mock translation provider for testing and offline development."""

    @property
    def provider_name(self) -> str:
        return "mock"

    async def translate(
        self,
        text: str,
        target_language: str,
        source_language: str | None = None,
    ) -> TranslationResult:
        if not text:
            return TranslationResult(
                text="",
                detected_source_language=source_language,
                target_language=target_language,
                provider=self.provider_name,
            )

        if target_language.upper() in ("PT-BR", "PT") and self.is_text_already_portuguese(text):
            return TranslationResult(
                text=text,
                detected_source_language="PT",
                target_language=target_language,
                provider=self.provider_name,
            )

        return TranslationResult(
            text=f"[PT] {text}",
            detected_source_language=(source_language or "en").upper(),
            target_language=target_language,
            provider=self.provider_name,
        )

    async def translate_article(
        self,
        title: str,
        summary: str | None,
        content: str | None,
        target_language: str,
        source_language: str | None = None,
    ) -> ArticleTranslationResult:
        if target_language.upper() in ("PT-BR", "PT") and self.is_text_already_portuguese(title):
            return ArticleTranslationResult(
                translated_title=title,
                translated_summary=summary,
                translated_content=content,
                detected_source_language="PT",
                target_language=target_language,
                provider=self.provider_name,
            )

        return ArticleTranslationResult(
            translated_title=f"[PT] {title}",
            translated_summary=f"[PT] {summary}" if summary else None,
            translated_content=f"[PT] {content}" if content else None,
            detected_source_language=(source_language or "en").upper(),
            target_language=target_language,
            provider=self.provider_name,
        )
