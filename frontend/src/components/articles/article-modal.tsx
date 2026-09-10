"use client";

import { useEffect, useState } from "react";
import {
  Bookmark,
  Calendar,
  CheckCircle2,
  Circle,
  EyeOff,
  ExternalLink,
  Languages,
  Loader2,
  MessageSquare,
  Star,
  Tag,
  ThumbsUp,
  User,
  X,
} from "lucide-react";
import { ArticlePublic, ArticleStatePublic, ArticleTranslationPublic } from "@/lib/types";
import { getCategoryBadge, getSourceBadge } from "@/lib/utils";
import {
  fetchArticleTranslation,
  recordArticleOpened,
  translateArticle,
  updateArticleState,
} from "@/lib/api";

interface ArticleModalProps {
  article: ArticlePublic | null;
  onClose: () => void;
  onStateChange?: (articleId: string, newState: Partial<ArticleStatePublic>) => void;
  onHide?: (articleId: string) => void;
}

export function ArticleModal({ article, onClose, onStateChange, onHide }: ArticleModalProps) {
  const [imageError, setImageError] = useState(false);
  const [localState, setLocalState] = useState<ArticleStatePublic>({
    is_read: false,
    is_favorite: false,
    is_saved: false,
    is_hidden: false,
  });

  // Translation states
  const [languageMode, setLanguageMode] = useState<"original" | "pt-br">("original");
  const [translation, setTranslation] = useState<ArticleTranslationPublic | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  useEffect(() => {
    setImageError(false);
    setLanguageMode("original");
    setTranslation(null);
    setTranslationError(null);

    if (article) {
      setLocalState(article.state || {
        is_read: false,
        is_favorite: false,
        is_saved: false,
        is_hidden: false,
      });

      // Automatically record opening in background (marks read, records timestamps)
      recordArticleOpened(article.id).then((updated) => {
        if (updated?.state) {
          setLocalState(updated.state);
          onStateChange?.(article.id, updated.state);
        }
      });

      // Check if translation already exists in cache
      fetchArticleTranslation(article.id, "pt-BR").then((cached) => {
        if (cached) {
          setTranslation(cached);
        }
      });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (article) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [article, onClose, onStateChange]);

  if (!article) return null;

  const categoryMeta = getCategoryBadge(article.category);
  const sourceMeta = getSourceBadge(article.source.slug);
  const formattedDate = new Date(article.published_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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

  const handleTranslate = async () => {
    if (translation) {
      setLanguageMode("pt-br");
      return;
    }
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const res = await translateArticle(article.id, "pt-BR");
      setTranslation(res);
      setLanguageMode("pt-br");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível traduzir esta notícia agora. Você ainda pode visualizar o conteúdo original.";
      setTranslationError(msg);
    } finally {
      setIsTranslating(false);
    }
  };

  const isPtActive = languageMode === "pt-br" && Boolean(translation);
  const displayTitle = isPtActive ? translation!.translated_title : article.title;
  const displaySummary = isPtActive && translation?.translated_summary ? translation.translated_summary : article.summary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          title="Fechar (Esc)"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Badges Header */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${sourceMeta.badgeClass}`}
          >
            {article.source.name}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium ${categoryMeta.className}`}
          >
            <Tag className="h-3 w-3" />
            {categoryMeta.label}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-bold text-slate-100 leading-snug">
          {displayTitle}
        </h2>

        {/* Translation Banner (if active) */}
        {isPtActive && (
          <div className="flex items-center justify-between rounded-lg bg-cyan-950/30 border border-cyan-900/40 px-3 py-2 text-xs text-cyan-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              Traduzido automaticamente • Português (Brasil)
            </span>
            <button
              onClick={() => setLanguageMode("original")}
              className="text-cyan-400 hover:text-cyan-200 hover:underline font-medium"
            >
              Ver original
            </button>
          </div>
        )}

        {/* Translation Error Alert (if any) */}
        {translationError && (
          <div className="rounded-lg bg-rose-950/20 border border-rose-900/30 p-3 text-xs text-rose-300 flex items-center justify-between">
            <span>{translationError}</span>
            <button
              onClick={handleTranslate}
              className="text-rose-400 hover:text-rose-200 font-medium underline ml-3 shrink-0"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-y border-slate-800/80 py-3">
          <button
            onClick={toggleFavorite}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              localState.is_favorite
                ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${localState.is_favorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
            <span>{localState.is_favorite ? "Favoritado" : "Favoritar"}</span>
          </button>

          <button
            onClick={toggleSaved}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              localState.is_saved
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${localState.is_saved ? "fill-amber-400 text-amber-400" : ""}`} />
            <span>{localState.is_saved ? "Salvo para depois" : "Ler depois"}</span>
          </button>

          <button
            onClick={toggleRead}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              localState.is_read
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            {localState.is_read ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Lido</span>
              </>
            ) : (
              <>
                <Circle className="h-3.5 w-3.5 text-slate-400" />
                <span>Marcar como lido</span>
              </>
            )}
          </button>

          {/* Language Switcher */}
          <div className="inline-flex items-center rounded-lg border border-slate-800 bg-slate-950/80 p-0.5 text-xs">
            <Languages className="h-3.5 w-3.5 text-slate-400 ml-2 mr-1" />
            {translation ? (
              <div className="flex items-center">
                <button
                  onClick={() => setLanguageMode("original")}
                  className={`px-2 py-1 rounded transition-colors ${
                    languageMode === "original"
                      ? "bg-slate-800 text-slate-100 font-semibold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Original
                </button>
                <button
                  onClick={() => setLanguageMode("pt-br")}
                  className={`px-2 py-1 rounded transition-colors ${
                    languageMode === "pt-br"
                      ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  PT-BR
                </button>
              </div>
            ) : (
              <button
                onClick={handleTranslate}
                disabled={isTranslating}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 transition-colors disabled:opacity-50"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
                    <span>Traduzindo...</span>
                  </>
                ) : (
                  <span>Traduzir para Português</span>
                )}
              </button>
            )}
          </div>

          <button
            onClick={handleHide}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-slate-800 bg-slate-900 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors ml-auto"
            title="Ocultar da timeline"
          >
            <EyeOff className="h-3.5 w-3.5" />
            <span>Ocultar</span>
          </button>
        </div>

        {/* Cover Image */}
        {hasValidImage && (
          <div className="overflow-hidden rounded-xl bg-slate-950 max-h-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.image_url!}
              alt={article.title}
              onError={() => setImageError(true)}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Metadata bar */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
          {article.author && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span>Por {article.author}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span>{formattedDate}</span>
          </div>

          {article.metrics?.score !== null && article.metrics?.score !== undefined && (
            <div className="flex items-center gap-1 text-amber-400 font-medium">
              <ThumbsUp className="h-3.5 w-3.5" />
              <span>{article.metrics.score} pontos</span>
            </div>
          )}
          {article.metrics?.comments !== null && article.metrics?.comments !== undefined && (
            <div className="flex items-center gap-1 text-cyan-400 font-medium">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{article.metrics.comments} comentários</span>
            </div>
          )}
        </div>

        {/* Summary or Content */}
        <div className="space-y-4">
          <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed">
            {displaySummary ? (
              <p className="whitespace-pre-line leading-relaxed">{displaySummary}</p>
            ) : (
              <p className="italic text-slate-500">
                Esta fonte disponibiliza a matéria e discussão diretamente no link original externo.
              </p>
            )}
          </div>

          {/* Legal / Source notice */}
          <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3 text-xs text-slate-500 flex items-center justify-between">
            <span>Conteúdo disponibilizado pelo feed da publicação.</span>
            <span className="font-mono text-[10px] text-slate-600">Direitos reservados ao autor</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800/80 flex justify-between items-center">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 transition-colors"
          >
            Fechar
          </button>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-900 font-semibold px-4 py-2 text-sm transition-all shadow-lg shadow-cyan-950"
          >
            <span>Abrir artigo original</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
