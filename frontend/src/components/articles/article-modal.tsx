"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  EyeOff,
  ExternalLink,
  Newspaper,
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
import { recordArticleOpened, updateArticleState } from "@/lib/api";

interface ArticleModalProps {
  article: ArticlePublic | null;
  onClose: () => void;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onStateChange?: (articleId: string, newState: Partial<ArticleStatePublic>) => void;
  onHide?: (articleId: string) => void;
}

export function ArticleModal({
  article,
  onClose,
  onNavigatePrevious,
  onNavigateNext,
  hasPrevious = false,
  hasNext = false,
  onStateChange,
  onHide,
}: ArticleModalProps) {
  const [imageError, setImageError] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [localState, setLocalState] = useState<ArticleStatePublic>({
    is_read: false,
    is_favorite: false,
    is_saved: false,
    is_hidden: false,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const originalScrollY = useRef(0);

  // Keep stable refs to callbacks
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  });

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const onNavigatePreviousRef = useRef(onNavigatePrevious);
  useEffect(() => {
    onNavigatePreviousRef.current = onNavigatePrevious;
  });

  const onNavigateNextRef = useRef(onNavigateNext);
  useEffect(() => {
    onNavigateNextRef.current = onNavigateNext;
  });

  const articleId = article?.id;

  // Track article opening & reading progress reset
  useEffect(() => {
    if (!articleId) return;

    let isMounted = true;
    setImageError(false);
    setReadingProgress(0);

    // Automatically record opening in background (marks read, records timestamps)
    recordArticleOpened(articleId).then((updated) => {
      if (isMounted && updated?.state) {
        setLocalState(updated.state);
        onStateChangeRef.current?.(articleId, updated.state);
      }
    });

    // Reset scroll of the reader to the top
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    return () => {
      isMounted = false;
    };
  }, [articleId]);

  // Sync state changes from parent
  useEffect(() => {
    if (article?.state) {
      setLocalState(article.state);
    }
  }, [article?.state]);

  // Scroll preservation and keyboard navigation
  useEffect(() => {
    if (!article) return;

    // Save exact timeline scroll position
    originalScrollY.current = window.scrollY;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === "Escape") {
        onCloseRef.current?.();
      } else if (e.key === "ArrowLeft" && hasPrevious) {
        onNavigatePreviousRef.current?.();
      } else if (e.key === "ArrowRight" && hasNext) {
        onNavigateNextRef.current?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow || "";
      window.removeEventListener("keydown", handleKeyDown);
      // Guarantee scroll position preservation
      window.scrollTo(0, originalScrollY.current);
    };
  }, [article, hasPrevious, hasNext]);

  // Scroll listener for reading progress bar
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const totalScrollable = scrollHeight - clientHeight;
    if (totalScrollable <= 0) {
      setReadingProgress(100);
    } else {
      const progress = Math.min(100, Math.max(0, (scrollTop / totalScrollable) * 100));
      setReadingProgress(progress);
    }
  };

  if (!article) return null;

  const categoryMeta = getCategoryBadge(article.category);
  const sourceMeta = getSourceBadge(article.source.slug);
  const timeFormatted = formatRelativeTime(article.published_at);
  const fullDateFormatted = formatFullDate(article.published_at);
  const contentBody = article.content || article.summary;
  const readingTime = estimateReadingTime(contentBody);
  const hasValidImage = Boolean(article.image_url && !imageError);

  const toggleFavorite = async () => {
    const nextVal = !localState.is_favorite;
    setLocalState((prev) => ({ ...prev, is_favorite: nextVal }));
    onStateChange?.(article.id, { is_favorite: nextVal });
    await updateArticleState(article.id, { is_favorite: nextVal });
  };

  const toggleSaved = async () => {
    const nextVal = !localState.is_saved;
    setLocalState((prev) => ({ ...prev, is_saved: nextVal }));
    onStateChange?.(article.id, { is_saved: nextVal });
    await updateArticleState(article.id, { is_saved: nextVal });
  };

  const toggleRead = async () => {
    const nextVal = !localState.is_read;
    setLocalState((prev) => ({ ...prev, is_read: nextVal }));
    onStateChange?.(article.id, { is_read: nextVal });
    await updateArticleState(article.id, { is_read: nextVal });
  };

  const handleHide = async () => {
    onHide?.(article.id);
    onClose();
    await updateArticleState(article.id, { is_hidden: true });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-hidden animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Leitor de Notícia"
    >
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[92vh] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Discreet Reading Progress Bar (Section 24) */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-zinc-900 z-30">
          <div
            className="h-full bg-rose-500 transition-all duration-150 ease-out"
            style={{ width: `${readingProgress}%` }}
          />
        </div>

        {/* Reader Top Navigation Bar */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 sm:px-6 py-3 bg-zinc-950/90 shrink-0 z-20">
          {/* Back button */}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
            title="Voltar à Timeline (Esc)"
          >
            <ArrowLeft className="h-4 w-4 text-rose-500" />
            <span className="hidden sm:inline">Voltar</span>
          </button>

          {/* Previous / Next Navigation (Section 22) */}
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={onNavigatePrevious}
              disabled={!hasPrevious}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-zinc-300 hover:bg-zinc-900 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Notícia anterior (←)"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden md:inline">Anterior</span>
            </button>
            <span className="text-zinc-600 font-mono text-xs">|</span>
            <button
              type="button"
              onClick={onNavigateNext}
              disabled={!hasNext}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-zinc-300 hover:bg-zinc-900 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Próxima notícia (→)"
            >
              <span className="hidden md:inline">Próxima</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors"
            title="Fechar leitor (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Reader Content Container */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-12 py-6 space-y-6"
        >
          {/* Article Measure Wrapper (65-80ch optimal line length) */}
          <div className="mx-auto max-w-[72ch] space-y-6">
            {/* Metadata Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400 border-b border-zinc-900 pb-4">
              <div className="flex items-center gap-2">
                <span className={cn("rounded border px-2 py-0.5 font-medium text-xs", sourceMeta.badgeClass)}>
                  {article.source.name}
                </span>
                <span className={cn("rounded border px-2 py-0.5 font-medium text-xs", categoryMeta.className)}>
                  {categoryMeta.label}
                </span>
              </div>

              {/* Language Mode Placeholder (Section 82: Prepared without external call) */}
              <div className="inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5 text-[11px] text-zinc-400">
                <span className="rounded px-2 py-0.5 font-medium bg-zinc-800 text-zinc-200">
                  Original
                </span>
                <span
                  className="rounded px-2 py-0.5 font-medium text-zinc-500 cursor-not-allowed opacity-60"
                  title="Tradução PT-BR estará disponível na próxima etapa"
                >
                  PT-BR (em breve)
                </span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50 leading-snug">
              {article.title}
            </h1>

            {/* Author, Date & Reading Time */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400">
              {article.author && (
                <>
                  <span>Por <strong className="text-zinc-200">{article.author}</strong></span>
                  <span>•</span>
                </>
              )}
              <span title={fullDateFormatted}>{timeFormatted}</span>
              {readingTime && (
                <>
                  <span>•</span>
                  <span className="text-rose-400 font-semibold">{readingTime}</span>
                </>
              )}
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-2 text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleFavorite}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors border",
                    localState.is_favorite
                      ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  <Star className={cn("h-3.5 w-3.5", localState.is_favorite && "fill-yellow-400 text-yellow-400")} />
                  <span>{localState.is_favorite ? "Favoritado" : "Favoritar"}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleSaved}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors border",
                    localState.is_saved
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  <Bookmark className={cn("h-3.5 w-3.5", localState.is_saved && "fill-amber-400 text-amber-400")} />
                  <span>{localState.is_saved ? "Salvo" : "Ler depois"}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleRead}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {localState.is_read ? (
                    <>
                      <Circle className="h-3.5 w-3.5 text-rose-400" />
                      <span>Marcar não lido</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Marcar lido</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleHide}
                className="inline-flex items-center gap-1 text-zinc-500 hover:text-rose-400 transition-colors text-[11px] px-2 py-1"
                title="Ocultar esta matéria da timeline"
              >
                <EyeOff className="h-3.5 w-3.5" />
                <span>Ocultar</span>
              </button>
            </div>

            {/* Optional Lead Image */}
            {hasValidImage && (
              <div className="overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.image_url!}
                  alt={article.title}
                  onError={() => setImageError(true)}
                  className="w-full max-h-96 object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Main Content / Summary (65-80ch reading width) */}
            <div className="text-zinc-200 text-base sm:text-[17px] leading-relaxed space-y-4 pt-2">
              {contentBody ? (
                <div className="prose prose-invert max-w-none text-zinc-300 leading-relaxed space-y-4">
                  {contentBody.split("\n\n").map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center space-y-2 text-zinc-400">
                  <Newspaper className="mx-auto h-8 w-8 text-zinc-600" />
                  <p>O feed desta publicação disponibilizou apenas o título e link externo.</p>
                </div>
              )}
            </div>

            {/* External Source Action Box */}
            <div className="pt-8 border-t border-zinc-800/80">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between w-full rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:border-rose-500/40 p-4 transition-all group"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-zinc-100 group-hover:text-rose-400 transition-colors">
                    Ler matéria completa na fonte original
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">
                    {article.url}
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-800 p-2 text-zinc-400 group-hover:bg-rose-500/10 group-hover:text-rose-400 transition-colors">
                  <ExternalLink className="h-4 w-4" />
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
