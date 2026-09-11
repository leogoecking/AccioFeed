"use client";

import { useState } from "react";
import {
  Bookmark,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  ExternalLink,
  MessageSquare,
  MoreVertical,
  Newspaper,
  Star,
  ThumbsUp,
} from "lucide-react";
import { ArticlePublic, ArticleStatePublic } from "@/lib/types";
import {
  cn,
  estimateReadingTime,
  formatFullDate,
  formatRelativeTime,
  getCategoryBadge,
  getSourceBadge,
} from "@/lib/utils";
import { updateArticleState } from "@/lib/api";
import { HighlightText } from "@/components/common/highlight-text";

interface ArticleCardProps {
  article: ArticlePublic;
  density?: "comfortable" | "compact";
  isNewSinceLastVisit?: boolean;
  onSelect: (article: ArticlePublic) => void;
  onQuickPreview?: (article: ArticlePublic) => void;
  onStateChange?: (articleId: string, newState: Partial<ArticleStatePublic>) => void;
  onHide?: (articleId: string) => void;
  isSelected?: boolean;
  searchQuery?: string;
}

export function ArticleCard({
  article,
  density = "comfortable",
  isNewSinceLastVisit = false,
  onSelect,
  onQuickPreview,
  onStateChange,
  onHide,
  isSelected = false,
  searchQuery,
}: ArticleCardProps) {
  const [imageError, setImageError] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const state = article.state || {
    is_read: false,
    is_favorite: false,
    is_saved: false,
    is_hidden: false,
  };

  const categoryMeta = getCategoryBadge(article.category);
  const sourceMeta = getSourceBadge(article.source.slug);
  const timeFormatted = formatRelativeTime(article.published_at);
  const fullDateFormatted = formatFullDate(article.published_at);
  const readingTime = estimateReadingTime(article.summary || article.content);
  const hasValidImage = Boolean(article.image_url && !imageError);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpdating) return;
    setIsUpdating(true);
    const nextVal = !state.is_favorite;
    onStateChange?.(article.id, { is_favorite: nextVal });
    await updateArticleState(article.id, { is_favorite: nextVal });
    setIsUpdating(false);
  };

  const handleToggleSaved = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpdating) return;
    setIsUpdating(true);
    const nextVal = !state.is_saved;
    onStateChange?.(article.id, { is_saved: nextVal });
    await updateArticleState(article.id, { is_saved: nextVal });
    setIsUpdating(false);
  };

  const handleToggleRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (isUpdating) return;
    setIsUpdating(true);
    const nextVal = !state.is_read;
    onStateChange?.(article.id, { is_read: nextVal });
    await updateArticleState(article.id, { is_read: nextVal });
    setIsUpdating(false);
  };

  const handleHide = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onHide?.(article.id);
    await updateArticleState(article.id, { is_hidden: true });
  };

  const handleCardClick = () => {
    onSelect(article);
  };

  /* ========================================================================= */
  /* COMPACT DENSITY                                                           */
  /* ========================================================================= */
  if (density === "compact") {
    return (
      <article
        data-article-id={article.id}
        onClick={handleCardClick}
        className={cn(
          "group relative flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer",
          isSelected && "ring-2 ring-rose-500 bg-rose-500/10",
          state.is_read
            ? "border-zinc-800/50 bg-zinc-950/40 opacity-75 hover:opacity-100 hover:border-zinc-700"
            : "border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-900/90 hover:border-zinc-700",
          isNewSinceLastVisit && "border-l-2 border-l-rose-500"
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Unread / New Indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isNewSinceLastVisit && (
              <span className="rounded bg-rose-950/60 border border-rose-800/50 px-1.5 py-0.2 text-[10px] font-mono text-rose-300 font-bold">
                NOVA
              </span>
            )}
            {!state.is_read && !isNewSinceLastVisit && (
              <span
                className="h-2 w-2 rounded-full bg-rose-500 shrink-0"
                title="Não lida"
              />
            )}
          </div>

          {/* Meta & Title in compact lines */}
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="font-mono" title={fullDateFormatted}>
                {timeFormatted}
              </span>
              <span>•</span>
              <span className={cn("font-medium", sourceMeta.badgeClass, "px-1.5 py-0.2 rounded border")}>
                {article.source.name}
              </span>
              <span>•</span>
              <span className="text-zinc-400">{categoryMeta.label}</span>
              {readingTime && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline text-zinc-500 font-mono text-[10px]">
                    {readingTime}
                  </span>
                </>
              )}
            </div>

            <h3
              className={cn(
                "text-sm font-medium leading-snug truncate group-hover:text-rose-400 transition-colors",
                state.is_read ? "text-zinc-300 font-normal" : "text-zinc-100 font-semibold"
              )}
            >
              <HighlightText text={article.title} query={searchQuery} />
            </h3>
          </div>
        </div>

        {/* Compact Right Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleToggleFavorite}
            className={cn(
              "rounded p-1 transition-colors",
              state.is_favorite
                ? "text-yellow-400"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80"
            )}
            title={state.is_favorite ? "Remover dos favoritos" : "Favoritar (f)"}
          >
            <Star className={cn("h-3.5 w-3.5", state.is_favorite && "fill-yellow-400")} />
          </button>

          <button
            type="button"
            onClick={handleToggleSaved}
            className={cn(
              "rounded p-1 transition-colors",
              state.is_saved
                ? "text-amber-400"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80"
            )}
            title={state.is_saved ? "Remover de Ler depois" : "Salvar para depois (s)"}
          >
            <Bookmark className={cn("h-3.5 w-3.5", state.is_saved && "fill-amber-400")} />
          </button>

          {onQuickPreview && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickPreview(article);
              }}
              className="rounded p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 transition-colors"
              title="Visualização rápida (Espaço / p)"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir matéria original ↗"
            className="rounded p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </article>
    );
  }

  /* ========================================================================= */
  /* COMFORTABLE DENSITY                                                       */
  /* ========================================================================= */
  return (
    <article
      data-article-id={article.id}
      onClick={handleCardClick}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border transition-all duration-200 cursor-pointer",
        isSelected && "ring-2 ring-rose-500 shadow-lg shadow-rose-950/40 bg-zinc-900/90",
        state.is_read
          ? "border-zinc-800/60 bg-zinc-950/40 opacity-85 hover:opacity-100 hover:border-zinc-700"
          : "border-zinc-800/80 bg-zinc-900/50 hover:border-rose-500/40 hover:bg-zinc-900/80 shadow-xs",
        isNewSinceLastVisit && "ring-1 ring-rose-500/40"
      )}
    >
      {/* Optional Card Image with Lazy Loading & Elegant Fallback */}
      {hasValidImage ? (
        <div className="relative h-40 sm:h-44 w-full overflow-hidden bg-zinc-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.image_url!}
            alt={article.title}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-103"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
          {isNewSinceLastVisit && (
            <div className="absolute top-2.5 left-2.5">
              <span className="rounded bg-rose-950/90 border border-rose-700/60 px-2 py-0.5 text-[10px] font-mono font-bold text-rose-300 backdrop-blur-md shadow-md">
                NOVA
              </span>
            </div>
          )}
        </div>
      ) : isNewSinceLastVisit ? (
        <div className="px-4 pt-3 pb-0 flex items-center gap-1.5">
          <span className="rounded bg-rose-950/80 border border-rose-800/60 px-2 py-0.5 text-[10px] font-mono font-bold text-rose-300">
            NOVA
          </span>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5 space-y-3">
        <div className="space-y-2.5">
          {/* Top Badges & State indicators */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              {!state.is_read && (
                <span
                  className="h-2 w-2 rounded-full bg-rose-500 shrink-0"
                  title="Notícia não lida"
                />
              )}
              <span className={cn("rounded border px-2 py-0.5 font-medium text-[11px]", sourceMeta.badgeClass)}>
                {article.source.name}
              </span>
              <span className={cn("rounded border px-2 py-0.5 font-medium text-[11px]", categoryMeta.className)}>
                {categoryMeta.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-mono text-[11px]" title={fullDateFormatted}>
                {timeFormatted}
              </span>
              {/* Quick Actions Header */}
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className={cn(
                    "rounded p-1 transition-colors",
                    state.is_favorite
                      ? "text-yellow-400 hover:text-yellow-300"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                  )}
                  title={state.is_favorite ? "Remover dos favoritos" : "Favoritar notícia"}
                >
                  <Star className={cn("h-4 w-4", state.is_favorite && "fill-yellow-400")} />
                </button>
                <button
                  type="button"
                  onClick={handleToggleSaved}
                  className={cn(
                    "rounded p-1 transition-colors",
                    state.is_saved
                      ? "text-amber-400 hover:text-amber-300"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                  )}
                  title={state.is_saved ? "Salvo para ler depois" : "Salvar para ler depois"}
                >
                  <Bookmark className={cn("h-4 w-4", state.is_saved && "fill-amber-400")} />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(!showMenu);
                    }}
                    className="rounded p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                    title="Mais opções"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {showMenu && (
                    <div
                      className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-xl z-20 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={handleToggleRead}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 text-left"
                      >
                        {state.is_read ? (
                          <>
                            <Circle className="h-3.5 w-3.5 text-rose-400" />
                            <span>Marcar como não lido</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Marcar como lido</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleHide}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-rose-400 hover:bg-rose-500/10 text-left"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        <span>Ocultar notícia</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Title */}
          <h3
            className={cn(
              "text-base sm:text-lg transition-colors leading-snug line-clamp-2",
              state.is_read
                ? "font-medium text-zinc-300 group-hover:text-rose-400"
                : "font-semibold text-zinc-100 group-hover:text-rose-400"
            )}
          >
            <HighlightText text={article.title} query={searchQuery} />
          </h3>

          {/* Summary */}
          {article.summary ? (
            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
              <HighlightText text={article.summary} query={searchQuery} />
            </p>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-zinc-600 italic">
              <Newspaper className="h-3.5 w-3.5" />
              <span>Conteúdo completo disponível na fonte original</span>
            </div>
          )}
        </div>

        {/* Footer Metrics & Actions */}
        <div className="mt-3 flex items-center justify-between border-t border-zinc-800/60 pt-3 text-xs">
          <div className="flex items-center gap-3">
            {article.metrics?.score !== null && article.metrics?.score !== undefined && (
              <div className="flex items-center gap-1 text-amber-400/90 font-medium">
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>{article.metrics.score}</span>
              </div>
            )}
            {article.metrics?.comments !== null && article.metrics?.comments !== undefined && (
              <div className="flex items-center gap-1 text-rose-400/90 font-medium">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{article.metrics.comments}</span>
              </div>
            )}
            {readingTime && (
              <span className="text-zinc-500 font-mono text-[11px] hidden sm:inline">
                {readingTime}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {onQuickPreview && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickPreview(article);
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                title="Visualização rápida (Espaço / p)"
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="text-[11px] hidden sm:inline">Prévia</span>
              </button>
            )}

            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir matéria original ↗"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              <span className="text-[11px] hidden sm:inline">Fonte original</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
