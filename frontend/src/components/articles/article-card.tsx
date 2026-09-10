"use client";

import { useState } from "react";
import { ExternalLink, MessageSquare, Newspaper, ThumbsUp } from "lucide-react";
import { ArticlePublic } from "@/lib/types";
import { formatRelativeTime, getCategoryBadge, getSourceBadge } from "@/lib/utils";

interface ArticleCardProps {
  article: ArticlePublic;
  onSelect: (article: ArticlePublic) => void;
}

export function ArticleCard({ article, onSelect }: ArticleCardProps) {
  const [imageError, setImageError] = useState(false);
  const categoryMeta = getCategoryBadge(article.category);
  const sourceMeta = getSourceBadge(article.source.slug);
  const timeFormatted = formatRelativeTime(article.published_at);

  const hasValidImage = Boolean(article.image_url && !imageError);

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/50 transition-all duration-200 hover:border-slate-700 hover:bg-slate-900/90 hover:shadow-lg hover:shadow-cyan-950/20">
      {/* Optional Card Image Banner or Elegant Fallback */}
      {hasValidImage ? (
        <div className="relative h-40 w-full overflow-hidden bg-slate-950">
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
          {/* Top Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`rounded border px-2 py-0.5 font-medium ${sourceMeta.badgeClass}`}
              >
                {article.source.name}
              </span>
              <span
                className={`rounded border px-2 py-0.5 font-medium ${categoryMeta.className}`}
              >
                {categoryMeta.label}
              </span>
            </div>
            <span className="text-slate-500 font-mono text-[11px]">{timeFormatted}</span>
          </div>

          {/* Title */}
          <h3
            onClick={() => onSelect(article)}
            className="text-base sm:text-lg font-semibold text-slate-100 group-hover:text-cyan-400 transition-colors cursor-pointer leading-snug line-clamp-2"
          >
            {article.title}
          </h3>

          {/* Summary Snippet if available */}
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

          {/* External Link */}
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
