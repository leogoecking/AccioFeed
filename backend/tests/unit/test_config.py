import os
from unittest import mock

from app.core.config import Settings


def test_cors_origins_wildcard_string():
    with mock.patch.dict(os.environ, {"CORS_ORIGINS": "*"}):
        settings = Settings()
        assert settings.CORS_ORIGINS == ["*"]


def test_cors_origins_comma_separated_string():
    with mock.patch.dict(os.environ, {"CORS_ORIGINS": "http://localhost:3000, https://myapp.com"}):
        settings = Settings()
        assert settings.CORS_ORIGINS == ["http://localhost:3000", "https://myapp.com"]


def test_cors_origins_json_array_string():
    with mock.patch.dict(os.environ, {"CORS_ORIGINS": '["http://example.com"]'}):
        settings = Settings()
        assert settings.CORS_ORIGINS == ["http://example.com"]


def test_cors_origins_default():
    with mock.patch.dict(os.environ, {}, clear=False):
        os.environ.pop("CORS_ORIGINS", None)
        settings = Settings()
        assert "http://localhost:3000" in settings.CORS_ORIGINS
