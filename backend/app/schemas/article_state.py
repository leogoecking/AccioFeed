from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ArticleStatePublic(BaseModel):
    is_read: bool = False
    is_favorite: bool = False
    is_saved: bool = False
    is_hidden: bool = False
    saved_at: datetime | None = None
    first_opened_at: datetime | None = None
    last_opened_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ArticleStateUpdate(BaseModel):
    """
    Strict payload for modifying user personal state.
    extra='forbid' ensures arbitrary fields (e.g. title, url) are strictly rejected with 422.
    """

    is_read: bool | None = Field(default=None, description="Mark article as read/unread")
    is_favorite: bool | None = Field(default=None, description="Add/remove from favorites")
    is_saved: bool | None = Field(default=None, description="Save/unsave for reading later")
    is_hidden: bool | None = Field(default=None, description="Hide/unhide from timeline")

    model_config = ConfigDict(extra="forbid")


class LibraryStats(BaseModel):
    unread: int
    saved: int
    favorites: int
    total: int
