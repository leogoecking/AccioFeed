"use client";

import { useState } from "react";
import {
  Bookmark,
  CheckCircle2,
  Circle,
  EyeOff,
  ExternalLink,
  MessageSquare,
  MoreVertical,
  Newspaper,
  Star,
  ThumbsUp,
} from "lucide-react";
import { ArticlePublic, ArticleStatePublic } from "@/lib/types";
import { formatRelativeTime, getCategoryBadge, getSourceBadge } from "@/lib/utils";
import { updateArticleState } from "@/lib/api";

interface ArticleCardProps {
  article: ArticlePublic;
  onSelect: (article: ArticlePublic) => void;
  onStateChange?: (articleId: string, newState: Partial<ArticleStatePublic>) => void;
  onHide?: (articleId: string) => void;
}

export function ArticleCard({ article, onSelect, onStateChange, onHide }: ArticleCardProps) {
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

  return (
    <article
      className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border transition-all duration-200 ${
        state.is_read
          ? "border-slate-800/60 bg-slate-950/40 opacity-85 hover:opacity-100 hover:border-slate-700"
          : "border-slate-800/90 bg-slate-900/60 hover:border-cyan-500/40 hover:bg-slate-900/90 shadow-sm"
      }`}
    >
      {/* Optional Card Image */}
      {hasValidImage ? (
        <div className="relative h-40 w-full overflow-hidden bg-slate-950 cursor-pointer" onClick={() => onSelect(article)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.image_url!}
            alt={article.title}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col justify-between p-5 space-y-3">
        <div className="space-y-3">
          {/* Top Badges & State indicators */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              {!state.is_read && (
                <span
                  className="h-2 w-2 rounded-full bg-cyan-400 shrink-0 animate-pulse"
                  title="Notícia não lida"
                />
              )}
              <span className={`rounded border px-2 py-0.5 font-medium ${sourceMeta.badgeClass}`}>
                {article.source.name}
              </span>
              <span className={`rounded border px-2 py-0.5 font-medium ${categoryMeta.className}`}>
                {categoryMeta.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-mono text-[11px]">{timeFormatted}</span>
              {/* Quick Actions Header */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className={`rounded p-1 transition-colors ${
                    state.is_favorite
                      ? "text-yellow-400 hover:text-yellow-300"
                      : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                  }`}
                  title={state.is_favorite ? "Remover dos favoritos" : "Favoritar notícia"}
                >
                  <Star className={`h-4 w-4 ${state.is_favorite ? "fill-yellow-400" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={handleToggleSaved}
                  className={`rounded p-1 transition-colors ${
                    state.is_saved
                      ? "text-amber-400 hover:text-amber-300"
                      : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                  }`}
                  title={state.is_saved ? "Salvo para ler depois" : "Salvar para ler depois"}
                >
                  <Bookmark className={`h-4 w-4 ${state.is_saved ? "fill-amber-400" : ""}`} />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(!showMenu);
                    }}
                    className="rounded p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                    title="Mais opções"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {showMenu && (
                    <div
                      className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-slate-800 bg-slate-900 p-1 shadow-xl z-20 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={handleToggleRead}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100 text-left"
                      >
                        {state.is_read ? (
                          <>
                            <Circle className="h-3.5 w-3.5 text-cyan-400" />
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
            onClick={() => onSelect(article)}
            className={`text-base sm:text-lg transition-colors cursor-pointer leading-snug line-clamp-2 ${
              state.is_read
                ? "font-medium text-slate-300 group-hover:text-cyan-300"
                : "font-semibold text-slate-100 group-hover:text-cyan-400"
            }`}
          >
            {article.title}
          </h3>

          {/* Summary */}
          {article.summary ? (
            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {article.summary}
            </p>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 italic">
              <Newspaper className="h-3.5 w-3.5" />
              <span>Notícia completa disponível na fonte original</span>
            </div>
          )}
        </div>

        {/* Footer Metrics & Actions */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-3 text-xs">
          <div className="flex items-center gap-3">
            {article.metrics?.score !== null && article.metrics?.score !== undefined && (
              <div className="flex items-center gap-1 text-amber-400/90 font-medium">
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>{article.metrics.score}</span>
              </div>
            )}
            {article.metrics?.comments !== null && article.metrics?.comments !== undefined && (
              <div className="flex items-center gap-1 text-cyan-400/90 font-medium">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{article.metrics.comments}</span>
              </div>
            )}
            {article.author && (
              <span className="hidden sm:inline text-slate-500 truncate max-w-[130px]">
                por {article.author}
              </span>
            )}
          </div>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir matéria original"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-cyan-400 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[11px] hidden sm:inline">Abrir notícia</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}
