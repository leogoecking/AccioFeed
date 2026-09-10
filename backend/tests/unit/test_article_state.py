import pytest
from pydantic import ValidationError

from app.schemas.article_state import ArticleStatePublic, ArticleStateUpdate, LibraryStats


def test_article_state_update_validation():
    # Valid payload
    payload = ArticleStateUpdate(is_favorite=True, is_read=False)
    assert payload.is_favorite is True
    assert payload.is_read is False
    assert payload.is_saved is None

    # Forbidden arbitrary field must raise ValidationError
    with pytest.raises(ValidationError):
        ArticleStateUpdate(title="Hacked title")


def test_article_state_public_defaults():
    state = ArticleStatePublic()
    assert state.is_read is False
    assert state.is_favorite is False
    assert state.is_saved is False
    assert state.is_hidden is False
    assert state.first_opened_at is None
    assert state.last_opened_at is None


def test_library_stats_schema():
    stats = LibraryStats(unread=42, saved=5, favorites=12, total=50)
    assert stats.unread == 42
    assert stats.saved == 5
    assert stats.favorites == 12
    assert stats.total == 50
