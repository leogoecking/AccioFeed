import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.article_state import ArticleState
from app.models.base import utc_now


class ArticleStateRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_article_id(self, article_id: uuid.UUID) -> ArticleState | None:
        stmt = select(ArticleState).where(ArticleState.article_id == article_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_or_create(self, article_id: uuid.UUID) -> ArticleState:
        state = await self.get_by_article_id(article_id)
        if not state:
            state = ArticleState(article_id=article_id)
            self.db.add(state)
            await self.db.commit()
            await self.db.refresh(state)
        return state

    async def update_state(
        self,
        article_id: uuid.UUID,
        is_read: bool | None = None,
        is_favorite: bool | None = None,
        is_saved: bool | None = None,
        is_hidden: bool | None = None,
    ) -> ArticleState:
        state = await self.get_or_create(article_id)
        now = utc_now()

        if is_read is not None:
            state.is_read = is_read
        if is_favorite is not None:
            state.is_favorite = is_favorite
        if is_saved is not None:
            state.is_saved = is_saved
            state.saved_at = now if is_saved else None
        if is_hidden is not None:
            state.is_hidden = is_hidden

        state.updated_at = now
        await self.db.commit()
        await self.db.refresh(state)
        return state

    async def record_opened(self, article_id: uuid.UUID) -> ArticleState:
        state = await self.get_or_create(article_id)
        now = utc_now()

        state.is_read = True
        if state.first_opened_at is None:
            state.first_opened_at = now
        state.last_opened_at = now
        state.updated_at = now

        await self.db.commit()
        await self.db.refresh(state)
        return state

    async def get_library_stats(self) -> dict[str, int]:
        """
        Calculates personal library counters in a single aggregate query.
        """
        stmt = select(
            func.count(Article.id)
            .filter(
                or_(ArticleState.is_read.is_(False), ArticleState.id.is_(None)),
                or_(ArticleState.is_hidden.is_(False), ArticleState.id.is_(None)),
            )
            .label("unread"),
            func.count(Article.id)
            .filter(
                ArticleState.is_saved.is_(True),
            )
            .label("saved"),
            func.count(Article.id)
            .filter(
                ArticleState.is_favorite.is_(True),
            )
            .label("favorites"),
            func.count(Article.id)
            .filter(
                or_(ArticleState.is_hidden.is_(False), ArticleState.id.is_(None)),
            )
            .label("total"),
        ).outerjoin(ArticleState, Article.id == ArticleState.article_id)
        result = await self.db.execute(stmt)
        row = result.first()
        if row:
            return {
                "unread": int(row.unread or 0),
                "saved": int(row.saved or 0),
                "favorites": int(row.favorites or 0),
                "total": int(row.total or 0),
            }
        return {"unread": 0, "saved": 0, "favorites": 0, "total": 0}
