"use client";

import { useEffect, useState } from "react";
import {
  Bookmark,
  CheckCircle2,
  Circle,
  ExternalLink,
  Newspaper,
  PanelRightClose,
  Star,
  X,
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

interface QuickPreviewProps {
  article: ArticlePublic | null;
  onClose: () => void;
  onOpenReader: (article: ArticlePublic) => void;
  onStateChange?: (articleId: string, newState: Partial<ArticleStatePublic>) => void;
  onHide?: (articleId: string) => void;
}

export function QuickPreview({
  article,
  onClose,
  onOpenReader,
  onStateChange,
}: QuickPreviewProps) {
  const [imageError, setImageError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [article?.id]);

  if (!article) return null;

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
  const contentBody = article.summary || article.content;
  const readingTime = estimateReadingTime(contentBody);
  const hasValidImage = Boolean(article.image_url && !imageError);

  const handleToggleFavorite = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    const nextVal = !state.is_favorite;
    onStateChange?.(article.id, { is_favorite: nextVal });
    await updateArticleState(article.id, { is_favorite: nextVal });
    setIsUpdating(false);
  };

  const handleToggleSaved = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    const nextVal = !state.is_saved;
    onStateChange?.(article.id, { is_saved: nextVal });
    await updateArticleState(article.id, { is_saved: nextVal });
    setIsUpdating(false);
  };

  const handleToggleRead = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    const nextVal = !state.is_read;
    onStateChange?.(article.id, { is_read: nextVal });
    await updateArticleState(article.id, { is_read: nextVal });
    setIsUpdating(false);
  };

  return (
    <>
      {/* Backdrop for mobile bottom sheet */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel container: slide-over on desktop, bottom sheet on mobile */}
      <aside
        className={cn(
          "fixed z-40 flex flex-col bg-zinc-950 shadow-2xl border-zinc-800 transition-all duration-200 animate-slide-up lg:animate-slide-left",
          // Mobile: Bottom sheet
          "bottom-0 inset-x-0 max-h-[85vh] rounded-t-2xl border-t lg:border-t-0",
          // Desktop: Docked right drawer
          "lg:bottom-0 lg:top-14 lg:right-0 lg:left-auto lg:w-[420px] lg:max-h-none lg:rounded-none lg:border-l"
        )}
        role="dialog"
        aria-label="Visualização Rápida de Notícia"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3 bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-semibold">
              Quick Preview
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-zinc-400 font-mono" title={fullDateFormatted}>
              {timeFormatted}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            title="Fechar preview (Esc)"
          >
            <PanelRightClose className="hidden lg:block h-4 w-4" />
            <X className="lg:hidden h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Metadata Badges */}
          <div className="flex items-center gap-2 text-xs">
            <span className={cn("rounded border px-2 py-0.5 font-medium text-xs", sourceMeta.badgeClass)}>
              {article.source.name}
            </span>
            <span className={cn("rounded border px-2 py-0.5 font-medium text-xs", categoryMeta.className)}>
              {categoryMeta.label}
            </span>
            {readingTime && (
              <span className="ml-auto font-mono text-[11px] text-zinc-400">
                {readingTime}
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold leading-snug text-zinc-100">
            {article.title}
          </h2>

          {/* Author */}
          {article.author && (
            <p className="text-xs text-zinc-400 font-mono">
              Por <span className="text-zinc-200">{article.author}</span>
            </p>
          )}

          {/* Image */}
          {hasValidImage && (
            <div className="overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800/80 max-h-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.image_url!}
                alt={article.title}
                onError={() => setImageError(true)}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Summary / Body */}
          <div className="text-sm leading-relaxed text-zinc-300 space-y-3">
            {contentBody ? (
              contentBody.split("\n\n").slice(0, 3).map((para, i) => (
                <p key={i}>{para}</p>
              ))
            ) : (
              <div className="p-4 rounded-lg border border-dashed border-zinc-800 text-center text-xs text-zinc-500 space-y-1">
                <Newspaper className="mx-auto h-6 w-6 text-zinc-600" />
                <p>Esta notícia possui apenas título e link para leitura externa.</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Toolbar & Footer */}
        <div className="border-t border-zinc-800/80 p-3 bg-zinc-900/60 space-y-2.5 shrink-0">
          {/* Quick status buttons */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleToggleFavorite}
                disabled={isUpdating}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-colors",
                  state.is_favorite
                    ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                )}
                title="Favoritar (f)"
              >
                <Star className={cn("h-3.5 w-3.5", state.is_favorite && "fill-yellow-400")} />
                <span>{state.is_favorite ? "Favorito" : "Favoritar"}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleSaved}
                disabled={isUpdating}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-colors",
                  state.is_saved
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                )}
                title="Salvar para ler depois (s)"
              >
                <Bookmark className={cn("h-3.5 w-3.5", state.is_saved && "fill-amber-400")} />
                <span>{state.is_saved ? "Salvo" : "Ler depois"}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleToggleRead}
              disabled={isUpdating}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2 py-1 text-zinc-400 hover:text-zinc-200 bg-zinc-900 transition-colors"
              )}
              title="Marcar como lido / não lido (m)"
            >
              {state.is_read ? (
                <>
                  <Circle className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Não lido</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Lido</span>
                </>
              )}
            </button>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenReader(article)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition-colors shadow-sm"
            >
              <span>Abrir no Reader</span>
              <kbd className="hidden sm:inline text-[10px] font-mono bg-rose-700/60 px-1 py-0.2 rounded">
                ↵
              </kbd>
            </button>

            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100 transition-colors"
              title="Abrir no site oficial da publicação ↗"
            >
              <span>Fonte Original</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Key hints */}
          <div className="hidden lg:flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-0.5">
            <span>[j/k] Selecionar</span>
            <span>[o] Leitor</span>
            <span>[s] Salvar</span>
            <span>[f] Favoritar</span>
            <span>[Esc] Fechar</span>
          </div>
        </div>
      </aside>
    </>
  );
}
