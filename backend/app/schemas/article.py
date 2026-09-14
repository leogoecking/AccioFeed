import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.article_state import ArticleStatePublic
from app.schemas.metric import MetricSummary
from app.schemas.source import SourcePublic, SourceSimple
from app.schemas.translation import ArticleTranslationPublic
from app.translation.base import BaseTranslationProvider


class ArticleBase(BaseModel):
    title: str = Field(..., max_length=500)
    url: str = Field(..., max_length=2000)
    canonical_url: str | None = Field(default=None, max_length=2000)
    author: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    content: str | None = None
    image_url: str | None = Field(default=None, max_length=2000)
    published_at: datetime
    language: str = Field(default="en", max_length=10)
    category: str = Field(default="general", max_length=50)


class ArticleCreate(ArticleBase):
    source_id: int
    external_id: str = Field(..., max_length=255)
    collected_at: datetime | None = None


class ArticlePublic(BaseModel):
    id: uuid.UUID
    title: str
    url: str
    canonical_url: str | None = None
    source: SourceSimple
    author: str | None = None
    summary: str | None = None
    content: str | None = None
    image_url: str | None = None
    published_at: datetime
    category: str
    language: str = "en"
    content_level: str = "partial"
    display_title: str
    display_summary: str | None = None
    original_title: str
    original_summary: str | None = None
    translation_available: bool = False
    extracted_content: str | None = None
    metrics: MetricSummary = Field(default_factory=MetricSummary)
    state: ArticleStatePublic = Field(default_factory=ArticleStatePublic)

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def extract_latest_metric(cls, data: Any) -> Any:
        if hasattr(data, "metrics"):
            metrics_list = getattr(data, "metrics", [])
            metric_data = {"score": None, "comments": None}
            if metrics_list and len(metrics_list) > 0:
                latest = metrics_list[0]
                metric_data["score"] = getattr(latest, "score", None)
                metric_data["comments"] = getattr(latest, "comments_count", None)

            state_obj = (
                getattr(data, "state", None) if not isinstance(data, dict) else data.get("state")
            )
            state_data = {
                "is_read": getattr(state_obj, "is_read", False) if state_obj else False,
                "is_favorite": getattr(state_obj, "is_favorite", False) if state_obj else False,
                "is_saved": getattr(state_obj, "is_saved", False) if state_obj else False,
                "is_hidden": getattr(state_obj, "is_hidden", False) if state_obj else False,
                "saved_at": getattr(state_obj, "saved_at", None) if state_obj else None,
                "first_opened_at": getattr(state_obj, "first_opened_at", None)
                if state_obj
                else None,
                "last_opened_at": getattr(state_obj, "last_opened_at", None) if state_obj else None,
            }

            raw_title = getattr(data, "title", "")
            raw_summary = getattr(data, "summary", None)

            # Check translation to PT-BR
            translations_list = getattr(data, "translations", []) or []
            pt_translation = next(
                (
                    t
                    for t in translations_list
                    if getattr(t, "language", "").lower() in ("pt", "pt-br", "pt_br")
                ),
                None,
            )

            # Safely check translated_content from instance dict without triggering deferred lazy load
            trans_content = None
            if pt_translation:
                if isinstance(pt_translation, dict):
                    trans_content = pt_translation.get("translated_content")
                elif hasattr(pt_translation, "__dict__"):
                    trans_content = pt_translation.__dict__.get("translated_content")
                else:
                    trans_content = getattr(pt_translation, "translated_content", None)

            # Detect and ignore bogus untranslated echo records
            if pt_translation and getattr(pt_translation, "provider", None) != "original_pt":
                is_pt_source = bool(
                    getattr(data, "language", "en") in ("pt", "pt-br", "pt_br", "por")
                    or BaseTranslationProvider.is_text_already_portuguese(raw_title)
                )
                trans_title = getattr(pt_translation, "translated_title", "") or ""
                if (
                    not is_pt_source
                    and trans_title.strip().lower() == raw_title.strip().lower()
                    and not trans_content
                    and len(raw_title.split()) >= 3
                ):
                    pt_translation = None

            disp_title = (
                getattr(pt_translation, "translated_title", None)
                if pt_translation and getattr(pt_translation, "translated_title", None)
                else raw_title
            )
            disp_summary = (
                getattr(pt_translation, "translated_summary", None)
                if pt_translation and getattr(pt_translation, "translated_summary", None)
                else raw_summary
            )
            trans_avail = bool(
                pt_translation
                and (getattr(pt_translation, "translated_title", None) or trans_content)
            )

            # Check extracted content
            content_detail_obj = getattr(data, "content_detail", None)
            extracted_cnt = (
                getattr(content_detail_obj, "extracted_content", None)
                if content_detail_obj
                else None
            )
            cnt_level = getattr(data, "content_level", "partial")

            if isinstance(data, dict):
                data["metrics"] = metric_data
                data["state"] = state_data
                data.setdefault("display_title", data.get("title", ""))
                data.setdefault("display_summary", data.get("summary"))
                data.setdefault("original_title", data.get("title", ""))
                data.setdefault("original_summary", data.get("summary"))
                data.setdefault("translation_available", False)
                data.setdefault("content_level", "partial")
                data.setdefault("extracted_content", None)
                return data

            return {
                "id": data.id,
                "title": disp_title,
                "display_title": disp_title,
                "display_summary": disp_summary,
                "original_title": raw_title,
                "original_summary": raw_summary,
                "translation_available": trans_avail,
                "content_level": cnt_level,
                "extracted_content": extracted_cnt,
                "url": data.url,
                "canonical_url": getattr(data, "canonical_url", data.url),
                "source": data.source,
                "author": getattr(data, "author", None),
                "summary": disp_summary,
                "content": data.__dict__.get("content")
                if hasattr(data, "__dict__")
                else getattr(data, "content", None),
                "image_url": getattr(data, "image_url", None),
                "published_at": data.published_at,
                "collected_at": getattr(data, "collected_at", None),
                "category": getattr(data, "category", "general"),
                "language": getattr(data, "language", "en"),
                "created_at": getattr(data, "created_at", None),
                "updated_at": getattr(data, "updated_at", None),
                "metrics": metric_data,
                "state": state_data,
                "translations": [
                    {
                        "id": t.id,
                        "article_id": t.article_id,
                        "language": t.language,
                        "translated_title": t.translated_title,
                        "translated_summary": getattr(t, "__dict__", {}).get("translated_summary")
                        if hasattr(t, "__dict__")
                        else getattr(t, "translated_summary", None),
                        "translated_content": getattr(t, "__dict__", {}).get("translated_content")
                        if hasattr(t, "__dict__")
                        else getattr(t, "translated_content", None),
                        "provider": t.provider,
                        "detected_source_language": getattr(t, "__dict__", {}).get(
                            "detected_source_language"
                        )
                        if hasattr(t, "__dict__")
                        else getattr(t, "detected_source_language", None),
                        "created_at": t.created_at,
                        "updated_at": t.updated_at,
                    }
                    if not isinstance(t, dict)
                    else t
                    for t in (getattr(data, "translations", []) or [])
                ],
            }
        return data


class ArticleDetail(ArticlePublic):
    source: SourcePublic
    collected_at: datetime
    created_at: datetime
    updated_at: datetime
    translations: list[ArticleTranslationPublic] = Field(default_factory=list)
