"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { fetchArticles } from "@/lib/api";
import { ArticleFilters, ArticlePublic, ArticleStatePublic, PaginatedResponse } from "@/lib/types";
import { ArticleCard } from "./article-card";
import { ArticleModal } from "./article-modal";

interface TimelineProps {
  activeCategory: string;
  activeCollection: string;
  activeSource: string | null;
  searchQuery: string;
  sort: "recent" | "popular" | "history" | "last_opened";
  onSortChange: (sort: "recent" | "popular" | "history" | "last_opened") => void;
  page: number;
  onPageChange: (page: number) => void;
  onStatsRefresh?: () => void;
}

export function Timeline({
  activeCategory,
  activeCollection,
  activeSource,
  searchQuery,
  sort,
  onSortChange,
  page,
  onPageChange,
  onStatsRefresh,
}: TimelineProps) {
  const [data, setData] = useState<PaginatedResponse<ArticlePublic>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    pages: 1,
  });
  const [selectedArticle, setSelectedArticle] = useState<ArticlePublic | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadData = () => {
    setIsLoading(true);
    setHasError(false);
    startTransition(async () => {
      try {
        const filters: ArticleFilters = {
          category: activeCategory === "all" ? undefined : activeCategory,
          source: activeSource || undefined,
          search: searchQuery || undefined,
          sort: activeCollection === "history" ? "history" : sort,
          page: page,
          pageSize: 20,
        };

        if (activeCollection !== "all") {
          filters.state = activeCollection as ArticleFilters["state"];
        }

        const res = await fetchArticles(filters);
        setData(res);
      } catch (err) {
        console.error("Failed to load articles:", err);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, activeCollection, activeSource, searchQuery, sort, page]);

  const handleArticleStateChange = (articleId: string, newState: Partial<ArticleStatePublic>) => {
    // Optimistically update article in state
    setData((prev) => ({
      ...prev,
      items: prev.items.map((art) => {
        if (art.id === articleId) {
          const updatedState = { ...art.state, ...newState };
          return { ...art, state: updatedState };
        }
        return art;
      }),
    }));

    if (selectedArticle && selectedArticle.id === articleId) {
      setSelectedArticle((prev) => (prev ? { ...prev, state: { ...prev.state, ...newState } } : null));
    }

    onStatsRefresh?.();
  };

  const handleArticleHide = (articleId: string) => {
    // Remove article immediately from timeline
    setData((prev) => ({
      ...prev,
      total: Math.max(0, prev.total - 1),
      items: prev.items.filter((art) => art.id !== articleId),
    }));
    onStatsRefresh?.();
  };

  const getHeading = () => {
    if (activeCollection === "unread") return "Não Lidos";
    if (activeCollection === "saved") return "Salvos para Ler Depois";
    if (activeCollection === "favorite") return "Favoritos";
    if (activeCollection === "history") return "Histórico de Leitura";
    if (activeSource) return `Fonte: ${activeSource}`;
    if (activeCategory !== "all") return `Categoria: ${activeCategory}`;
    return "Todas as Notícias";
  };

  return (
    <section className="flex-1 space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-100">{getHeading()}</h2>
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-mono text-slate-400">
            {data.total} {data.total === 1 ? "artigo" : "artigos"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Sort Selector */}
          {activeCollection !== "history" && (
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-1 text-xs">
              <button
                onClick={() => onSortChange("recent")}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  sort === "recent"
                    ? "bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Recentes
              </button>
              <button
                onClick={() => onSortChange("popular")}
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
          )}

          {/* Refresh button */}
          <button
            onClick={() => {
              loadData();
              onStatsRefresh?.();
            }}
            title="Atualizar timeline"
            disabled={isLoading || isPending}
            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-slate-100 hover:border-slate-700 transition-colors"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading || isPending ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Error state */}
      {hasError ? (
        <div className="rounded-2xl border border-rose-900/50 bg-rose-950/20 p-8 text-center space-y-3">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-400" />
          <p className="text-slate-200 font-medium">Não foi possível carregar as notícias.</p>
          <p className="text-xs text-slate-400">
            Verifique se a API backend está em execução ou tente recarregar.
          </p>
          <button
            onClick={loadData}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            Tentar novamente
          </button>
        </div>
      ) : isLoading ? (
        /* Skeletons */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 rounded-xl border border-slate-800 bg-slate-900/40 p-5 animate-pulse space-y-3"
            >
              <div className="h-4 w-28 bg-slate-800 rounded"></div>
              <div className="h-6 w-3/4 bg-slate-800 rounded"></div>
              <div className="h-4 w-1/2 bg-slate-800 rounded"></div>
              <div className="h-4 w-full bg-slate-800 rounded mt-6"></div>
            </div>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
          <p className="text-slate-300 font-medium">
            {activeCollection === "unread"
              ? "Tudo em dia! Você leu todas as notícias disponíveis."
              : activeCollection === "saved"
              ? "Nenhum artigo salvo para ler depois."
              : activeCollection === "favorite"
              ? "Nenhum artigo favoritado ainda."
              : activeCollection === "history"
              ? "Histórico vazio. Abra qualquer artigo para vê-lo aqui."
              : "Nenhuma notícia encontrada com os filtros selecionados."}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            {searchQuery
              ? `Nenhum resultado para "${searchQuery}". Tente outros termos.`
              : "Explore outras categorias, fontes ou coleções na barra lateral."}
          </p>
        </div>
      ) : (
        /* Articles Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.items.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onSelect={(art) => setSelectedArticle(art)}
              onStateChange={handleArticleStateChange}
              onHide={handleArticleHide}
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
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={data.page <= 1 || isLoading}
              className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <button
              onClick={() => onPageChange(Math.min(data.pages, page + 1))}
              disabled={data.page >= data.pages || isLoading}
              className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Article Reader Modal */}
      <ArticleModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
        onStateChange={handleArticleStateChange}
        onHide={handleArticleHide}
      />
    </section>
  );
}
