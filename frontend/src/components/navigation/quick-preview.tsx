"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Circle,
  ExternalLink,
  Languages,
  Loader2,
  Newspaper,
  PanelRightClose,
  Star,
  X,
} from "lucide-react";
import {
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
  fetchArticleTranslation,
  translateArticle,
  updateArticleState,
} from "@/lib/api";

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

  // Translation states
  const [translation, setTranslation] = useState<ArticleTranslationPublic | null>(null);
  const [activeLang, setActiveLang] = useState<"original" | "pt-BR">("original");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  useEffect(() => {
    setImageError(false);
    const isPt = (article?.language || "").toLowerCase().startsWith("pt");
    const shouldDefaultPt = isPt || Boolean(article?.translation_available);

    setTranslation(null);
    setActiveLang(shouldDefaultPt ? "pt-BR" : "original");
    setIsTranslating(false);
    setTranslationError(null);

    if (article?.id) {
      fetchArticleTranslation(article.id, "pt-BR").then((cached) => {
        if (cached) {
          setTranslation(cached);
          setActiveLang("pt-BR");
        }
      });
    }
  }, [article?.id, article?.language, article?.translation_available]);

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

  const isNativelyPt = (article.language || "").toLowerCase().startsWith("pt");
  const isTranslated = activeLang === "pt-BR" && !isNativelyPt;

  const handleTranslate = async () => {
    if (!article?.id) return;
    if (isNativelyPt) {
      setActiveLang("pt-BR");
      return;
    }

    if (translation) {
      setActiveLang("pt-BR");
      return;
    }

    setIsTranslating(true);
    setTranslationError(null);
    try {
      const res = await translateArticle(article.id, "pt-BR", article);
      setTranslation(res);
      setActiveLang("pt-BR");
    } catch (err: unknown) {
      setTranslationError(
        err instanceof Error
          ? err.message
          : "Não foi possível traduzir agora. O conteúdo original permanece acessível."
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const displayTitle =
    isTranslated && translation?.translated_title
      ? translation.translated_title
      : isTranslated && article.display_title
        ? article.display_title
        : article.original_title || article.title;

  const originalBody =
    article.extracted_content || article.content || article.original_summary || article.summary;

  let contentBody = originalBody;
  if (isTranslated) {
    if (translation?.translated_content) {
      contentBody = translation.translated_content;
    } else if (translation?.translated_summary) {
      contentBody = translation.translated_summary;
    } else if (article.display_summary) {
      contentBody = article.display_summary;
    }
  }

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
          {/* Metadata Badges & Language Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className={cn("rounded border px-2 py-0.5 font-medium text-xs", sourceMeta.badgeClass)}>
                {article.source.name}
              </span>
              <span className={cn("rounded border px-2 py-0.5 font-medium text-xs", categoryMeta.className)}>
                {categoryMeta.label}
              </span>
              {article.content_level === "full" ? (
                <span className="inline-flex items-center gap-1 rounded border border-emerald-800/40 bg-emerald-950/20 px-1.5 py-0.5 font-medium text-[11px] text-emerald-400">
                  <BookOpen className="h-3 w-3" />
                  <span>Leitura completa</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
                  <span>Prévia</span>
                </span>
              )}
              {readingTime && (
                <span className="font-mono text-[11px] text-zinc-500 hidden sm:inline">
                  {readingTime}
                </span>
              )}
            </div>

            {/* Language Toggle */}
            <div className="inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setActiveLang("original")}
                className={cn(
                  "rounded px-2 py-0.5 font-medium transition-colors",
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
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors",
                  activeLang === "pt-BR"
                    ? "bg-rose-600 text-white shadow-xs font-semibold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40",
                  isTranslating && "opacity-80"
                )}
                title="Traduzir notícia para português (Brasil)"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-rose-300" />
                    <span>Traduzindo...</span>
                  </>
                ) : (
                  <>
                    <Languages className="h-3 w-3" />
                    <span>PT-BR</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Provider Badge if translated */}
          {isTranslated && translation && (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-rose-900/30 bg-rose-950/20 px-2 py-0.5 text-[10px] font-mono text-rose-300">
              <Languages className="h-3 w-3 text-rose-400" />
              <span>
                {translation.provider === "original_pt"
                  ? "Original em português"
                  : `Traduzido (${translation.provider.toUpperCase()})`}
              </span>
            </div>
          )}

          {/* Translation Error Banner */}
          {translationError && (
            <div className="flex items-center justify-between rounded-lg border border-amber-800/40 bg-amber-950/20 p-2.5 text-xs text-amber-300">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span className="text-[11px]">{translationError}</span>
              </div>
              <button
                type="button"
                onClick={() => setTranslationError(null)}
                className="text-amber-400 hover:text-amber-200"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Title */}
          <h2 className="text-lg font-bold leading-snug text-zinc-100">
            {displayTitle}
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

          {/* Partial Content Notice */}
          {article.content_level !== "full" && (
            <div className="rounded-lg border border-amber-900/30 bg-amber-950/20 p-2.5 text-xs text-amber-300">
              <span className="font-semibold text-amber-200">Prévia da publicação:</span> O conteúdo completo está disponível na fonte original.
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
