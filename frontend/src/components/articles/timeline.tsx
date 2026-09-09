"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { ArticlePublic, PaginatedResponse } from "@/lib/types";
import { fetchArticles } from "@/lib/api";
import { ArticleCard } from "./article-card";
import { ArticleModal } from "./article-modal";

interface TimelineProps {
  activeCategory: string;
  activeSource: string | null;
  searchQuery: string;
}

export function Timeline({
  activeCategory,
  activeSource,
  searchQuery,
}: TimelineProps) {
  const [data, setData] = useState<PaginatedResponse<ArticlePublic>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    pages: 1,
  });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [selectedArticle, setSelectedArticle] = useState<ArticlePublic | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  const loadData = () => {
    setIsLoading(true);
    startTransition(async () => {
      const res = await fetchArticles({
        category: activeCategory === "all" ? undefined : activeCategory,
        source: activeSource || undefined,
        search: searchQuery || undefined,
        sort: sort,
        page: page,
        pageSize: 20,
      });
      setData(res);
      setIsLoading(false);
    });
  };

  // Reset page when category, source, or search changes
  useEffect(() => {
    setPage(1);
  }, [activeCategory, activeSource, searchQuery, sort]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, activeSource, searchQuery, sort, page]);

  return (
    <section className="flex-1 space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-100">
            {activeCategory === "all" ? "Todas as Notícias" : `Categoria: ${activeCategory}`}
          </h2>
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-mono text-slate-400">
            {data.total} {data.total === 1 ? "artigo" : "artigos"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Sort Selector */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-1 text-xs">
            <button
              onClick={() => setSort("recent")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                sort === "recent"
                  ? "bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Mais Recentes
            </button>
            <button
              onClick={() => setSort("popular")}
              className={`flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors ${
                sort === "popular"
                  ? "bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ArrowUpDown className="h-3 w-3" />
              Populares
            </button>
          </div>

          {/* Refresh button */}
          <button
            onClick={loadData}
            title="Atualizar timeline"
            disabled={isLoading || isPending}
            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-slate-100 hover:border-slate-700 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading || isPending ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Article Grid / List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-xl border border-slate-800 bg-slate-900/40 p-5 animate-pulse space-y-3"
            >
              <div className="h-4 w-24 bg-slate-800 rounded"></div>
              <div className="h-6 w-3/4 bg-slate-800 rounded"></div>
              <div className="h-4 w-1/2 bg-slate-800 rounded"></div>
              <div className="h-4 w-full bg-slate-800 rounded mt-4"></div>
            </div>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
          <p className="text-slate-400 font-medium">Nenhum artigo encontrado com os filtros selecionados.</p>
          <p className="text-slate-600 text-sm mt-1">
            Aguarde o próximo ciclo do coletor ou tente redefinir a busca.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.items.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onSelect={(art) => setSelectedArticle(art)}
            />
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {data.pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
          <div>
            Página <span className="font-semibold text-slate-200">{data.page}</span> de{" "}
            <span className="font-semibold text-slate-200">{data.pages}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1 || isLoading}
              className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={data.page >= data.pages || isLoading}
              className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Article Detail Modal */}
      <ArticleModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </section>
  );
}
