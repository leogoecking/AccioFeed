"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  AlignJustify,
  ArrowUp,
  ArrowUpDown,
  CheckCheck,
  LayoutGrid,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { fetchArticles, syncAllSources } from "@/lib/api";
import { ArticleFilters, ArticlePublic, ArticleStatePublic } from "@/lib/types";
import { ArticleCard } from "./article-card";
import { ArticleModal } from "./article-modal";
import { ApiConfigBanner } from "@/components/common/api-config-banner";
import { cn } from "@/lib/utils";

export type ViewDensity = "comfortable" | "compact";

interface TimelineProps {
  activeCategory: string;
  onCategoryChange?: (cat: string) => void;
  activeCollection: string;
  activeSource: string | null;
  onSourceChange?: (source: string | null) => void;
  searchQuery: string;
  onSearchChange?: (query: string) => void;
  sort: "recent" | "popular" | "history" | "last_opened";
  onSortChange: (sort: "recent" | "popular" | "history" | "last_opened") => void;
  onResetFilters?: () => void;
  onStatsRefresh?: () => void;
}

export function Timeline({
  activeCategory,
  onCategoryChange,
  activeCollection,
  activeSource,
  onSourceChange,
  searchQuery,
  onSearchChange,
  sort,
  onSortChange,
  onResetFilters,
  onStatsRefresh,
}: TimelineProps) {
  const [articles, setArticles] = useState<ArticlePublic[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedArticle, setSelectedArticle] = useState<ArticlePublic | null>(null);
  const [, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Density preference
  const [density, setDensity] = useState<ViewDensity>("comfortable");

  // "Novas desde a última visita" state
  const [lastVisitAt, setLastVisitAt] = useState<string | null>(null);

  // Background incoming articles detection (prevention of timeline jumping)
  const [pendingIncomingCount, setPendingIncomingCount] = useState(0);
  const latestArticleIdRef = useRef<string | null>(null);

  // Initialize preferences from localStorage
  useEffect(() => {
    try {
      // Density
      const savedDensity = localStorage.getItem("acciofeed_density") as ViewDensity | null;
      if (savedDensity === "comfortable" || savedDensity === "compact") {
        setDensity(savedDensity);
      }

      // Last visit timestamp
      const savedVisit = localStorage.getItem("acciofeed_last_visit_at");
      if (savedVisit) {
        setLastVisitAt(savedVisit);
      } else {
        // Default to 8 hours ago on very first visit so user can see the "Novas" feature
        const defaultVisit = new Date(Date.now() - 8 * 3600 * 1000).toISOString();
        setLastVisitAt(defaultVisit);
        localStorage.setItem("acciofeed_last_visit_at", defaultVisit);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleDensityChange = (newDensity: ViewDensity) => {
    setDensity(newDensity);
    try {
      localStorage.setItem("acciofeed_density", newDensity);
    } catch {
      // Ignore
    }
  };

  const handleMarkPreviousAsSeen = () => {
    const now = new Date().toISOString();
    setLastVisitAt(now);
    try {
      localStorage.setItem("acciofeed_last_visit_at", now);
    } catch {
      // Ignore
    }
  };

  // Build filter query object
  const buildFilters = useCallback(
    (pageNumber: number): ArticleFilters => {
      const filters: ArticleFilters = {
        category: activeCategory === "all" ? undefined : activeCategory,
        source: activeSource || undefined,
        search: searchQuery || undefined,
        sort: activeCollection === "history" ? "history" : sort,
        page: pageNumber,
        pageSize: 20,
      };

      if (activeCollection !== "all") {
        filters.state = activeCollection as ArticleFilters["state"];
      }

      return filters;
    },
    [activeCategory, activeCollection, activeSource, searchQuery, sort]
  );

  // Initial load or filter change
  const loadInitialData = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setCurrentPage(1);
    setPendingIncomingCount(0);

    startTransition(async () => {
      try {
        const filters = buildFilters(1);
        const res = await fetchArticles(filters);
        setArticles(res.items);
        setTotalCount(res.total);
        setTotalPages(res.pages);
        if (res.items.length > 0) {
          latestArticleIdRef.current = res.items[0].id;
        }
      } catch (err) {
        console.error("Failed to load articles:", err);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    });
  }, [buildFilters]);

  // Load more pagination (appends items, preserving scroll)
  const handleLoadMore = async () => {
    if (isLoadingMore || currentPage >= totalPages) return;
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const filters = buildFilters(nextPage);
      const res = await fetchArticles(filters);

      // Append items filtering out any potential duplicates
      setArticles((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newUnique = res.items.filter((a) => !existingIds.has(a.id));
        return [...prev, ...newUnique];
      });

      setCurrentPage(nextPage);
      setTotalPages(res.pages);
      setTotalCount(res.total);
    } catch (err) {
      console.error("Failed to load more articles:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Background polling for new articles (Zero Timeline Jumping)
  useEffect(() => {
    const interval = setInterval(async () => {
      // Only check if user is on "all" collection and not searching
      if (activeCollection !== "all" || searchQuery) return;

      try {
        const checkRes = await fetchArticles({
          category: activeCategory === "all" ? undefined : activeCategory,
          source: activeSource || undefined,
          sort: "recent",
          page: 1,
          pageSize: 5,
        });

        if (checkRes.items.length > 0 && latestArticleIdRef.current) {
          const currentTopId = latestArticleIdRef.current;
          const newItems = [];
          for (const item of checkRes.items) {
            if (item.id === currentTopId) break;
            newItems.push(item);
          }
          if (newItems.length > 0) {
            setPendingIncomingCount(newItems.length);
          }
        }
      } catch {
        // Ignore background polling errors silently
      }
    }, 120_000); // Poll every 2 minutes

    return () => clearInterval(interval);
  }, [activeCategory, activeCollection, activeSource, searchQuery]);

  // Clicking the incoming banner loads the new articles and scrolls to top
  const handleLoadIncomingArticles = () => {
    setPendingIncomingCount(0);
    loadInitialData();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await syncAllSources(true);
      loadInitialData();
      onStatsRefresh?.();
    } catch (err) {
      console.error("Failed to sync sources:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleArticleStateChange = useCallback(
    (articleId: string, newState: Partial<ArticleStatePublic>) => {
      setArticles((prev) =>
        prev.map((art) => {
          if (art.id === articleId) {
            const updatedState = { ...art.state, ...newState };
            return { ...art, state: updatedState };
          }
          return art;
        })
      );

      setSelectedArticle((prev) => {
        if (prev && prev.id === articleId) {
          return { ...prev, state: { ...prev.state, ...newState } };
        }
        return prev;
      });

      onStatsRefresh?.();
    },
    [onStatsRefresh]
  );

  const handleArticleHide = useCallback(
    (articleId: string) => {
      setArticles((prev) => prev.filter((art) => art.id !== articleId));
      if (selectedArticle?.id === articleId) {
        setSelectedArticle(null);
      }
      onStatsRefresh?.();
    },
    [selectedArticle, onStatsRefresh]
  );

  const handleCloseModal = useCallback(() => {
    setSelectedArticle(null);
  }, []);

  const getHeading = () => {
    if (activeCollection === "unread") return "Não Lidos";
    if (activeCollection === "saved") return "Salvos para Ler Depois";
    if (activeCollection === "favorite") return "Favoritos";
    if (activeCollection === "history") return "Histórico de Leitura";
    if (activeSource) return `Fonte: ${activeSource}`;
    if (activeCategory !== "all") return `Categoria: ${activeCategory}`;
    if (searchQuery) return `Resultados para "${searchQuery}"`;
    return "Todas as Notícias";
  };

  // Find index of first seen article for visual separator
  const isArticleNew = (publishedAt: string) => {
    if (!lastVisitAt) return false;
    return new Date(publishedAt) > new Date(lastVisitAt);
  };

  const newArticlesTotal = articles.filter((a) => isArticleNew(a.published_at)).length;
  const firstSeenIndex = articles.findIndex((a) => !isArticleNew(a.published_at));

  // Determine if active filters are applied
  const hasActiveFilters =
    activeCategory !== "all" ||
    Boolean(activeSource) ||
    Boolean(searchQuery) ||
    activeCollection !== "all";

  return (
    <section className="flex-1 space-y-5 min-w-0">
      {/* Floating incoming articles banner (Zero Timeline Jumping) */}
      {pendingIncomingCount > 0 && (
        <div className="sticky top-16 z-30 flex justify-center animate-fade-in my-2">
          <button
            type="button"
            onClick={handleLoadIncomingArticles}
            className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-950/80 hover:bg-rose-500 transition-all transform hover:-translate-y-0.5 border border-rose-400/30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            <span>
              {pendingIncomingCount} {pendingIncomingCount === 1 ? "nova notícia disponível" : "novas notícias disponíveis"} · Clique para carregar
            </span>
          </button>
        </div>
      )}

      {/* Controls / Toolbar */}
      <div className="flex flex-col gap-3 border-b border-zinc-800/80 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-lg font-bold tracking-tight text-zinc-100">{getHeading()}</h2>
            <span className="rounded-full bg-zinc-800/80 border border-zinc-700/60 px-2 py-0.5 text-[11px] font-mono text-zinc-400">
              {totalCount} {totalCount === 1 ? "artigo" : "artigos"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Density Selector */}
            <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleDensityChange("comfortable")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors",
                  density === "comfortable"
                    ? "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
                title="Visualização Confortável (cards com imagem e resumo)"
                aria-label="Visualização Confortável"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Confortável</span>
              </button>
              <button
                type="button"
                onClick={() => handleDensityChange("compact")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors",
                  density === "compact"
                    ? "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
                title="Visualização Compacta (linhas para leitura ultra rápida)"
                aria-label="Visualização Compacta"
              >
                <AlignJustify className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Compacta</span>
              </button>
            </div>

            {/* Sort Selector */}
            {activeCollection !== "history" && (
              <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => onSortChange("recent")}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-colors",
                    sort === "recent"
                      ? "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  Recentes
                </button>
                <button
                  type="button"
                  onClick={() => onSortChange("popular")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors",
                    sort === "popular"
                      ? "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  <ArrowUpDown className="h-3 w-3" />
                  <span>Populares</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active Filters Bar (Section 59 & 60) */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-zinc-400">
            <span className="text-[11px] font-mono text-zinc-500">Filtros:</span>
            {activeCategory !== "all" && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-200">
                Categoria: <strong className="font-semibold text-rose-400">{activeCategory}</strong>
                {onCategoryChange && (
                  <button
                    type="button"
                    onClick={() => onCategoryChange("all")}
                    className="text-zinc-400 hover:text-zinc-100"
                    title="Remover filtro de categoria"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            )}
            {activeSource && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-200">
                Fonte: <strong className="font-semibold text-rose-400">{activeSource}</strong>
                {onSourceChange && (
                  <button
                    type="button"
                    onClick={() => onSourceChange(null)}
                    className="text-zinc-400 hover:text-zinc-100"
                    title="Remover filtro de fonte"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-200">
                Busca: <strong className="font-semibold text-rose-400">&ldquo;{searchQuery}&rdquo;</strong>
                {onSearchChange && (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="text-zinc-400 hover:text-zinc-100"
                    title="Limpar busca"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            )}
            {onResetFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="text-[11px] text-rose-400 hover:text-rose-300 underline font-medium transition-colors ml-1"
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* "Novas desde a sua última visita" Top Indicator Bar */}
      {newArticlesTotal > 0 && !hasError && !isLoading && (
        <div className="flex items-center justify-between rounded-lg border border-rose-900/40 bg-rose-950/20 px-3.5 py-2 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500"></span>
            </span>
            <span>
              <strong>{newArticlesTotal}</strong> {newArticlesTotal === 1 ? "nova notícia" : "novas notícias"} desde sua última visita
            </span>
          </div>
          <button
            type="button"
            onClick={handleMarkPreviousAsSeen}
            className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Atualiza o ponto temporal para considerar as notícias atuais como vistas"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span>Marcar anteriores como vistos</span>
          </button>
        </div>
      )}

      {/* Error state */}
      {hasError ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-900/50 bg-rose-950/20 p-6 text-center space-y-3">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-400" />
            <p className="text-zinc-200 font-medium">Não foi possível carregar as notícias.</p>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Verifique se a API do backend está em execução ou ajuste a URL de conexão.
            </p>
            <button
              onClick={loadInitialData}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>

          <ApiConfigBanner onConnected={loadInitialData} />
        </div>
      ) : isLoading ? (
        /* Skeletons matching chosen density */
        <div
          className={cn(
            density === "compact"
              ? "space-y-2"
              : "grid grid-cols-1 md:grid-cols-2 gap-4"
          )}
        >
          {Array.from({ length: density === "compact" ? 8 : 6 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 animate-pulse space-y-2.5",
                density === "compact" ? "h-16 flex items-center justify-between" : "h-56"
              )}
            >
              <div className="space-y-2 w-full">
                <div className="h-3 w-32 bg-zinc-800 rounded"></div>
                <div className="h-4 w-3/4 bg-zinc-800 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center space-y-3">
          <p className="text-zinc-300 font-medium">
            {activeCollection === "unread"
              ? "Tudo em dia! Você leu todas as notícias disponíveis."
              : activeCollection === "saved"
              ? "Nenhum artigo salvo para ler depois."
              : activeCollection === "favorite"
              ? "Nenhum artigo marcado como favorito ainda."
              : activeCollection === "history"
              ? "Nenhum histórico de leitura registrado."
              : searchQuery
              ? `Nenhum resultado para "${searchQuery}". Tente outros termos.`
              : "Nenhuma notícia encontrada para os filtros selecionados."}
          </p>
          {activeCollection === "all" && !searchQuery && (
            <div className="pt-2">
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50 transition-colors shadow-lg shadow-rose-950/40"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                <span>{isSyncing ? "Buscando notícias..." : "Sincronizar notícias agora"}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Articles Grid / List */
        <div className="space-y-4">
          <div
            className={cn(
              density === "compact"
                ? "space-y-2"
                : "grid grid-cols-1 md:grid-cols-2 gap-4"
            )}
          >
            {articles.map((article, index) => {
              const isNew = isArticleNew(article.published_at);
              // Insert separator right between the last new article and first seen article
              const shouldRenderSeparator =
                newArticlesTotal > 0 &&
                firstSeenIndex > 0 &&
                index === firstSeenIndex;

              return (
                <div key={article.id} className="contents">
                  {shouldRenderSeparator && (
                    <div
                      className={cn(
                        "my-3 flex items-center justify-between border-y border-zinc-800 bg-zinc-900/60 px-4 py-2 rounded-lg",
                        density === "comfortable" ? "col-span-full" : ""
                      )}
                    >
                      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                        <span className="font-semibold text-zinc-300">VOCÊ JÁ VIU ATÉ AQUI</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleMarkPreviousAsSeen}
                        className="text-[11px] text-zinc-400 hover:text-zinc-200 underline transition-colors"
                      >
                        Marcar anteriores como vistos
                      </button>
                    </div>
                  )}

                  <ArticleCard
                    article={article}
                    density={density}
                    isNewSinceLastVisit={isNew}
                    onSelect={(art) => setSelectedArticle(art)}
                    onStateChange={handleArticleStateChange}
                    onHide={handleArticleHide}
                  />
                </div>
              );
            })}
          </div>

          {/* Load More Pagination Bar (Section 45 & 46) */}
          {currentPage < totalPages && (
            <div className="flex flex-col items-center justify-center pt-6 pb-2 space-y-2">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 hover:border-zinc-700 px-6 py-2.5 text-xs sm:text-sm font-medium text-zinc-200 hover:text-white transition-all shadow-sm disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                    <span>Carregando mais notícias...</span>
                  </>
                ) : (
                  <span>Carregar mais notícias</span>
                )}
              </button>
              <p className="text-[11px] font-mono text-zinc-500">
                Exibindo {articles.length} de {totalCount} notícias
              </p>
            </div>
          )}

          {currentPage >= totalPages && articles.length > 0 && (
            <div className="text-center pt-8 pb-4 text-xs font-mono text-zinc-600">
              Fim da timeline · Todas as {totalCount} notícias carregadas
            </div>
          )}
        </div>
      )}

      {/* Article Reader Modal */}
      {selectedArticle && (() => {
        const selectedIndex = articles.findIndex((a) => a.id === selectedArticle.id);
        const hasPrev = selectedIndex > 0;
        const hasNxt = selectedIndex !== -1 && selectedIndex < articles.length - 1;
        return (
          <ArticleModal
            article={selectedArticle}
            onClose={handleCloseModal}
            onNavigatePrevious={() => {
              if (hasPrev) setSelectedArticle(articles[selectedIndex - 1]);
            }}
            onNavigateNext={() => {
              if (hasNxt) setSelectedArticle(articles[selectedIndex + 1]);
            }}
            hasPrevious={hasPrev}
            hasNext={hasNxt}
            onStateChange={handleArticleStateChange}
            onHide={handleArticleHide}
          />
        );
      })()}
    </section>
  );
}
