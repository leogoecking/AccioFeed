"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  EyeOff,
  ExternalLink,
  Languages,
  Loader2,
  Newspaper,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import {
  ArticleDetail,
  ArticlePublic,
  ArticleStatePublic,
  ArticleTranslationPublic,
} from "@/lib/types";
import {
  cn,
  estimateReadingTime,
  formatFullDate,
  formatRelativeTime,
  getCategoryBadge,
  getSourceBadge,
} from "@/lib/utils";
import {
  fetchArticleById,
  fetchArticleTranslation,
  recordArticleOpened,
  translateArticle,
  updateArticleState,
} from "@/lib/api";

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
  const [fullArticle, setFullArticle] = useState<ArticleDetail | null>(null);

  // Translation states (Milestone 4, 5 & 6)
  const [translation, setTranslation] = useState<ArticleTranslationPublic | null>(null);
  const [activeLang, setActiveLang] = useState<"original" | "pt-BR">("original");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

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

    let isCurrent = true;
    setImageError(false);
    setReadingProgress(0);
    setFullArticle(null);

    // Reset translation state for new article and look for cached translation
    const isPt = (article?.language || "").toLowerCase().startsWith("pt");
    const shouldDefaultPt = isPt || Boolean(article?.translation_available);

    setTranslation(null);
    setActiveLang(shouldDefaultPt ? "pt-BR" : "original");
    setIsTranslating(false);
    setTranslationError(null);

    // 1. Fetch full article details and record opening in background
    recordArticleOpened(articleId).then((opened) => {
      if (!isCurrent) return;
      if (opened) {
        setFullArticle(opened);
        if (opened.state) {
          setLocalState(opened.state);
          onStateChangeRef.current?.(articleId, opened.state);
        }
      } else {
        // Fallback: fetch article by ID directly
        fetchArticleById(articleId).then((detail) => {
          if (isCurrent && detail) {
            setFullArticle(detail);
            if (detail.state) {
              setLocalState(detail.state);
              onStateChangeRef.current?.(articleId, detail.state);
            }
          }
        });
      }
    });

    // 2. Fetch cached translation or start background translation if needed
    fetchArticleTranslation(articleId, "pt-BR").then(async (cached) => {
      if (!isCurrent) return;
      const rawTitle = (article?.title || "").trim();
      const isEcho =
        cached &&
        cached.translated_title.trim().toLowerCase() === rawTitle.toLowerCase() &&
        !cached.translated_content;

      if (cached && !isEcho) {
        setTranslation(cached);
        setActiveLang("pt-BR");

        // If full content is extracted but translation only has title/summary, fetch full translation on-demand
        const needsFullTranslation =
          !isPt &&
          article?.content_level === "full" &&
          !cached.translated_content;

        if (needsFullTranslation) {
          setIsTranslating(true);
          try {
            const fullRes = await translateArticle(articleId, "pt-BR", article, true);
            if (isCurrent) {
              setTranslation(fullRes);
            }
          } catch (e: unknown) {
            console.error("Full translation error:", e);
          } finally {
            if (isCurrent) setIsTranslating(false);
          }
        }
      } else if (!isPt) {
        // If not natively PT and cached is missing or bogus echo, translate automatically!
        setIsTranslating(true);
        try {
          const res = await translateArticle(
            articleId,
            "pt-BR",
            article,
            article?.content_level === "full"
          );
          if (isCurrent) {
            setTranslation(res);
            setActiveLang("pt-BR");
          }
        } catch (err: unknown) {
          console.error("Auto translation failed:", err);
        } finally {
          if (isCurrent) setIsTranslating(false);
        }
      }
    });

    // Reset scroll of the reader to the top
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    return () => {
      isCurrent = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when switching articles, not on bookmark/favorite state updates
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

  const currentArticle = fullArticle || article;
  if (!currentArticle) return null;

  const categoryMeta = getCategoryBadge(currentArticle.category);
  const sourceMeta = getSourceBadge(currentArticle.source.slug);
  const timeFormatted = formatRelativeTime(currentArticle.published_at);
  const fullDateFormatted = formatFullDate(currentArticle.published_at);

  const isNativelyPt = (currentArticle.language || "").toLowerCase().startsWith("pt");
  const rawTitle = (currentArticle.original_title || currentArticle.title || "").trim();
  const rawSummary = (currentArticle.original_summary || currentArticle.summary || "").trim();

  const isTranslated = activeLang === "pt-BR" && !isNativelyPt;

  const hasActualTranslation =
    Boolean(
      translation?.translated_title &&
        translation.translated_title.trim().toLowerCase() !== rawTitle.toLowerCase()
    ) ||
    Boolean(
      translation?.translated_content ||
        (translation?.translated_summary &&
          translation.translated_summary.trim().toLowerCase() !== rawSummary.toLowerCase())
    ) ||
    Boolean(
      currentArticle.display_title &&
        currentArticle.display_title.trim().toLowerCase() !== rawTitle.toLowerCase()
    );

  const showTranslatedBadge = isTranslated && hasActualTranslation;

  const handleTranslate = async () => {
    if (!currentArticle?.id) return;
    if (isNativelyPt) {
      setActiveLang("pt-BR");
      return;
    }

    const isEcho =
      translation &&
      translation.translated_title.trim().toLowerCase() === rawTitle.toLowerCase() &&
      !translation.translated_content;

    const needsFullContent =
      currentArticle.content_level === "full" &&
      Boolean(translation && !translation.translated_content);

    if (translation && !isEcho && !needsFullContent) {
      setActiveLang("pt-BR");
      return;
    }

    setIsTranslating(true);
    setTranslationError(null);
    try {
      const res = await translateArticle(
        currentArticle.id,
        "pt-BR",
        currentArticle,
        currentArticle.content_level === "full"
      );
      setTranslation(res);
      setActiveLang("pt-BR");
    } catch (err: unknown) {
      setTranslationError(
        err instanceof Error
          ? err.message
          : "Não foi possível traduzir esta matéria agora. O conteúdo original permanece acessível."
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const displayTitle =
    isTranslated &&
    translation?.translated_title &&
    translation.translated_title.trim().toLowerCase() !== rawTitle.toLowerCase()
      ? translation.translated_title
      : isTranslated &&
          currentArticle.display_title &&
          currentArticle.display_title.trim().toLowerCase() !== rawTitle.toLowerCase()
        ? currentArticle.display_title
        : rawTitle;

  const originalBody =
    currentArticle.extracted_content ||
    currentArticle.content ||
    currentArticle.original_summary ||
    currentArticle.summary;

  let contentBody = originalBody;
  if (isTranslated) {
    if (translation?.translated_content) {
      contentBody = translation.translated_content;
    } else if (translation?.translated_summary) {
      contentBody = translation.translated_summary;
    } else if (
      currentArticle.display_summary &&
      currentArticle.display_summary.trim().toLowerCase() !== rawSummary.toLowerCase()
    ) {
      contentBody = currentArticle.display_summary;
    }
  }

  const readingTime = estimateReadingTime(contentBody);
  const hasValidImage = Boolean(currentArticle.image_url && !imageError);

  const toggleFavorite = async () => {
    if (!currentArticle) return;
    const nextVal = !localState.is_favorite;
    setLocalState((prev) => ({ ...prev, is_favorite: nextVal }));
    onStateChange?.(currentArticle.id, { is_favorite: nextVal });
    await updateArticleState(currentArticle.id, { is_favorite: nextVal });
  };

  const toggleSaved = async () => {
    if (!currentArticle) return;
    const nextVal = !localState.is_saved;
    setLocalState((prev) => ({ ...prev, is_saved: nextVal }));
    onStateChange?.(currentArticle.id, { is_saved: nextVal });
    await updateArticleState(currentArticle.id, { is_saved: nextVal });
  };

  const toggleRead = async () => {
    if (!currentArticle) return;
    const nextVal = !localState.is_read;
    setLocalState((prev) => ({ ...prev, is_read: nextVal }));
    onStateChange?.(currentArticle.id, { is_read: nextVal });
    await updateArticleState(currentArticle.id, { is_read: nextVal });
  };

  const handleHide = async () => {
    if (!currentArticle) return;
    onHide?.(currentArticle.id);
    onClose();
    await updateArticleState(currentArticle.id, { is_hidden: true });
  };

  const renderParagraph = (para: string, idx: number) => {
    const trimmed = para.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("### ")) {
      return (
        <h3 key={idx} className="text-lg font-bold text-zinc-100 pt-3 pb-1 tracking-tight">
          {trimmed.replace(/^###\s+/, "")}
        </h3>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h2 key={idx} className="text-xl font-bold text-zinc-100 pt-4 pb-1 tracking-tight">
          {trimmed.replace(/^##\s+/, "")}
        </h2>
      );
    }
    if (trimmed.startsWith("# ")) {
      return (
        <h2 key={idx} className="text-xl font-bold text-zinc-100 pt-4 pb-1 tracking-tight">
          {trimmed.replace(/^#\s+/, "")}
        </h2>
      );
    }
    if (trimmed.startsWith("> ")) {
      return (
        <blockquote key={idx} className="border-l-2 border-rose-500/60 pl-4 py-1 italic text-zinc-400 my-2">
          {trimmed.replace(/^>\s*/, "")}
        </blockquote>
      );
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items = trimmed.split("\n").filter((l) => l.trim().startsWith("- ") || l.trim().startsWith("* "));
      if (items.length > 0) {
        return (
          <ul key={idx} className="list-disc list-inside space-y-1.5 text-zinc-300 my-2">
            {items.map((it, itemIdx) => (
              <li key={itemIdx}>{it.replace(/^[-*]\s+/, "")}</li>
            ))}
          </ul>
        );
      }
    }

    return (
      <p key={idx} className="leading-relaxed">
        {trimmed}
      </p>
    );
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
                  {currentArticle.source.name}
                </span>
                <span className={cn("rounded border px-2 py-0.5 font-medium text-xs", categoryMeta.className)}>
                  {categoryMeta.label}
                </span>
                {currentArticle.content_level === "full" ? (
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-800/40 bg-emerald-950/20 px-2 py-0.5 font-medium text-xs text-emerald-400">
                    <BookOpen className="h-3 w-3" />
                    <span>Leitura completa</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 font-mono text-xs text-zinc-400">
                    <span>Prévia</span>
                  </span>
                )}
              </div>

              {/* Language Mode Toggle & Badges */}
              <div className="flex items-center gap-2">
                {showTranslatedBadge && (
                  <span
                    className="hidden sm:inline-flex items-center gap-1 rounded-md border border-rose-900/30 bg-rose-950/20 px-2 py-0.5 text-[10px] font-mono text-rose-300"
                    title="Conteúdo traduzido automaticamente para português (Brasil) pelo AccioFeed Pipeline"
                  >
                    <Sparkles className="h-3 w-3 text-rose-400" />
                    <span>Tradução automática</span>
                  </span>
                )}

                {isNativelyPt && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-emerald-900/30 bg-emerald-950/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                    <span>Original em português</span>
                  </span>
                )}

                {!isNativelyPt && (
                  <div className="inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setActiveLang("original")}
                      className={cn(
                        "rounded px-2.5 py-1 font-medium transition-colors",
                        activeLang === "original"
                          ? "bg-zinc-800 text-zinc-100 shadow-xs"
                          : "text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      Original
                    </button>
                    <button
                      type="button"
                      onClick={handleTranslate}
                      disabled={isTranslating}
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors",
                        activeLang === "pt-BR"
                          ? "bg-rose-600 text-white shadow-xs font-semibold"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40",
                        isTranslating && "opacity-80"
                      )}
                      title="Alternar para leitura em português do Brasil"
                    >
                      {isTranslating ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-rose-300" />
                          <span>Traduzindo...</span>
                        </>
                      ) : (
                        <>
                          <Languages className="h-3 w-3" />
                          <span>Português</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Translation Error Banner (Discreet & Non-blocking) */}
            {translationError && (
              <div className="flex items-center justify-between rounded-xl border border-amber-800/40 bg-amber-950/20 p-3 text-xs text-amber-300 animate-fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>{translationError}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTranslate}
                    className="underline font-semibold hover:text-amber-200"
                  >
                    Tentar novamente
                  </button>
                  <button
                    type="button"
                    onClick={() => setTranslationError(null)}
                    className="text-amber-400 hover:text-amber-200"
                    title="Dispensar aviso"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50 leading-snug">
              {displayTitle}
            </h1>

            {/* Author, Date & Reading Time */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400">
              {currentArticle.author && (
                <>
                  <span>Por <strong className="text-zinc-200">{currentArticle.author}</strong></span>
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
                  src={currentArticle.image_url!}
                  alt={currentArticle.title}
                  onError={() => setImageError(true)}
                  className="w-full max-h-96 object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* In-Progress Full Translation Notice (Non-blocking) */}
            {isTranslating && (
              <div className="flex items-center gap-2.5 rounded-xl border border-rose-900/30 bg-rose-950/20 px-3.5 py-2.5 text-xs text-rose-300 animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin text-rose-400 shrink-0" />
                <span>Traduzindo artigo completo para português... A leitura já está acessível abaixo.</span>
              </div>
            )}

            {/* Partial / Restricted Content Notice */}
            {currentArticle.content_level !== "full" && (
              <div className="rounded-xl border border-amber-900/30 bg-amber-950/15 p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-amber-200">
                      Prévia disponível
                    </h4>
                    <p className="text-xs text-amber-300/80 leading-relaxed">
                      O conteúdo completo está disponível na publicação original. Esta fonte publica apenas resumo via feed ou requer acesso ao portal original.
                    </p>
                  </div>
                </div>
                <div className="pt-1 flex">
                  <a
                    href={currentArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-3.5 py-1.5 text-xs font-semibold text-amber-200 transition-colors"
                  >
                    <span>Abrir na fonte original</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* Main Content / Summary (65-80ch reading width) */}
            <div className="text-zinc-200 text-base sm:text-[17px] leading-relaxed space-y-4 pt-2">
              {contentBody ? (
                <div className="prose prose-invert max-w-none text-zinc-300 leading-relaxed space-y-4">
                  {contentBody.split("\n\n").map(renderParagraph)}
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
                href={currentArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between w-full rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:border-rose-500/40 p-4 transition-all group"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-zinc-100 group-hover:text-rose-400 transition-colors">
                    Ler matéria completa na fonte original
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">
                    {currentArticle.url}
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
