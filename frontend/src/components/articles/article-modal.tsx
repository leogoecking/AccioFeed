"use client";

import { useEffect } from "react";
import { ExternalLink, MessageSquare, ThumbsUp, X, User, Calendar, Tag } from "lucide-react";
import { ArticlePublic } from "@/lib/types";
import { getCategoryBadge } from "@/lib/utils";

interface ArticleModalProps {
  article: ArticlePublic | null;
  onClose: () => void;
}

export function ArticleModal({ article, onClose }: ArticleModalProps) {
  useEffect(() => {
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
  }, [article, onClose]);

  if (!article) return null;

  const categoryMeta = getCategoryBadge(article.category);
  const formattedDate = new Date(article.published_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Badges Header */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300">
            {article.source.name}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium ${categoryMeta.className}`}>
            <Tag className="h-3 w-3" />
            {categoryMeta.label}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-bold text-slate-100 leading-snug">
          {article.title}
        </h2>

        {/* Metadata bar */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 border-y border-slate-800/80 py-3">
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
        <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed">
          {article.summary ? (
            <p className="whitespace-pre-line">{article.summary}</p>
          ) : (
            <p className="italic text-slate-500">
              Esta fonte disponibiliza a íntegra da discussão e do artigo no link original externo.
            </p>
          )}
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
            <span>Ver artigo original</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
