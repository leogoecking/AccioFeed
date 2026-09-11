"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  AlignJustify,
  ArrowLeft,
  Clock,
  History,
  LayoutGrid,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { ArticleCard } from "@/components/articles/article-card";
import { ArticleModal } from "@/components/articles/article-modal";
import { QuickPreview } from "@/components/navigation/quick-preview";
import { CommandPalette } from "@/components/navigation/command-palette";
import { ShortcutsHelpModal } from "@/components/navigation/shortcuts-help-modal";
import { ViewDensity } from "@/components/articles/timeline";
import { fetchArticles, fetchSources, updateArticleState } from "@/lib/api";
import { ArticleFilters, ArticlePublic, ArticleStatePublic, SourcePublic } from "@/lib/types";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS = [
  { value: "all", label: "Todo período" },
  { value: "today", label: "Hoje" },
  { value: "24h", label: "24 horas" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
] as const;

const SORT_OPTIONS = [
  { value: "relevance", label: "Mais relevantes" },
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "all", label: "Todas as categorias" },
  { value: "ai", label: "IA & Machine Learning" },
  { value: "hardware", label: "Hardware & Chips" },
  { value: "dev", label: "Desenvolvimento" },
  { value: "linux", label: "Linux & SO" },
  { value: "opensource", label: "Open Source" },
  { value: "security", label: "Segurança" },
  { value: "science", label: "Ciência" },
  { value: "general", label: "Geral" },
] as const;

const QUICK_SUGGESTIONS = [
  "NVIDIA",
  "DeepSeek",
  "Linux 6.14",
  "Rust",
  "Apple Silicon",
  "Quantum",
  "PostgreSQL",
  "RISC-V",
];

const RECENT_SEARCHES_KEY = "acciofeed_recent_searches";
const MAX_RECENT_SEARCHES = 8;

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial values from URL params
  const initialQuery = searchParams.get("q") || searchParams.get("search") || "";
  const initialCategory = searchParams.get("category") || "all";
  const initialPeriod = (searchParams.get("period") as ArticleFilters["period"]) || "all";
  const initialSort =
    (searchParams.get("sort") as "relevance" | "recent" | "oldest") ||
    (initialQuery ? "relevance" : "recent");
  const initialSource = searchParams.get("source") || "all";

  // State
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [period, setPeriod] = useState<ArticleFilters["period"]>(initialPeriod);
  const [sort, setSort] = useState<"relevance" | "recent" | "oldest">(initialSort);
  const [source, setSource] = useState(initialSource);

  // Data
  const [articles, setArticles] = useState<ArticlePublic[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sources, setSources] = useState<SourcePublic[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [density, setDensity] = useState<ViewDensity>("comfortable");

  // Loading & Selection
  const [, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [selectedNavIndex, setSelectedNavIndex] = useState(0);
  const [selectedArticle, setSelectedArticle] = useState<ArticlePublic | null>(null);
  const [quickPreviewArticle, setQuickPreviewArticle] = useState<ArticlePublic | null>(null);
  const [showRecentDropdown, setShowRecentDropdown] = useState(false);

  // Power Navigation Modals
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);

  // Input ref
  const searchInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load sources and recent searches on mount
  useEffect(() => {
    fetchSources(true).then(setSources).catch(console.error);

    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
      const savedDensity = localStorage.getItem("acciofeed_density") as ViewDensity | null;
      if (savedDensity === "comfortable" || savedDensity === "compact") {
        setDensity(savedDensity);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save recent search
  const saveRecentSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;

    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== clean.toLowerCase());
      const next = [clean, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Sync URL parameters
  const updateUrl = useCallback(
    (
      newQ: string,
      newCat: string,
      newPeriod: ArticleFilters["period"],
      newSort: string,
      newSrc: string
    ) => {
      const params = new URLSearchParams();
      if (newQ.trim()) params.set("q", newQ.trim());
      if (newCat && newCat !== "all") params.set("category", newCat);
      if (newPeriod && newPeriod !== "all") params.set("period", newPeriod);
      if (newSort && newSort !== "recent") params.set("sort", newSort);
      if (newSrc && newSrc !== "all") params.set("source", newSrc);

      const qs = params.toString();
      const target = qs ? `/search?${qs}` : "/search";
      router.replace(target, { scroll: false });
    },
    [router]
  );

  // Debounce search query input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = queryInput.trim();
      setDebouncedQuery(trimmed);
      if (trimmed) {
        saveRecentSearch(trimmed);
      }
      updateUrl(trimmed, category, period, sort, source);
    }, 300);

    return () => clearTimeout(timer);
  }, [queryInput, category, period, sort, source, saveRecentSearch, updateUrl]);

  // Dynamic Document Title
  useEffect(() => {
    if (debouncedQuery) {
      document.title = `${debouncedQuery} — Busca — AccioFeed`;
    } else {
      document.title = "Busca de Notícias — AccioFeed";
    }
  }, [debouncedQuery]);

  // Execute Search with AbortController cancellation
  const performSearch = useCallback(
    async (pageNumber = 1, append = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (!append) {
        setIsLoading(true);
        setHasError(false);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const filters: ArticleFilters = {
          search: debouncedQuery.trim() || undefined,
          category: category !== "all" ? category : undefined,
          period: period !== "all" ? period : undefined,
          source: source !== "all" ? source : undefined,
          sort,
          page: pageNumber,
          pageSize: 20,
        };

        const res = await fetchArticles(filters, { signal: controller.signal });

        startTransition(() => {
          if (append) {
            setArticles((prev) => {
              const ids = new Set(prev.map((a) => a.id));
              const fresh = res.items.filter((a) => !ids.has(a.id));
              return [...prev, ...fresh];
            });
          } else {
            setArticles(res.items);
            setSelectedNavIndex(0);
          }
          setTotalCount(res.total);
          setCurrentPage(res.page);
          setTotalPages(res.pages);
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return; // Request was cancelled by user typing, ignore
        }
        console.error("Search fetch error:", err);
        setHasError(true);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [debouncedQuery, category, period, sort, source]
  );

  // Trigger search when query or filters change
  useEffect(() => {
    performSearch(1, false);
  }, [performSearch]);

  // Load more pagination
  const handleLoadMore = () => {
    if (isLoadingMore || currentPage >= totalPages) return;
    performSearch(currentPage + 1, true);
  };

  // Immediate selection of suggestion / recent search
  const handleSelectQuery = (selectedTerm: string) => {
    setQueryInput(selectedTerm);
    setDebouncedQuery(selectedTerm);
    saveRecentSearch(selectedTerm);
    setShowRecentDropdown(false);
    updateUrl(selectedTerm, category, period, sort, source);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setQueryInput("");
    setDebouncedQuery("");
    setCategory("all");
    setPeriod("all");
    setSort("recent");
    setSource("all");
    updateUrl("", "all", "all", "recent", "all");
    searchInputRef.current?.focus();
  };

  // Article state update handler
  const handleArticleStateChange = (
    articleId: string,
    newState: Partial<ArticleStatePublic>
  ) => {
    setArticles((prev) =>
      prev.map((item) =>
        item.id === articleId
          ? { ...item, state: { ...item.state, ...newState } }
          : item
      )
    );
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === "Escape") {
        if (showRecentDropdown) {
          setShowRecentDropdown(false);
        } else if (queryInput) {
          setQueryInput("");
          setDebouncedQuery("");
          updateUrl("", category, period, sort, source);
        }
        return;
      }

      if (isInput) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedNavIndex((prev) => Math.min(prev + 1, Math.max(0, articles.length - 1)));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedNavIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && articles[selectedNavIndex]) {
        e.preventDefault();
        setSelectedArticle(articles[selectedNavIndex]);
      } else if (e.key === "z" && articles[selectedNavIndex]) {
        e.preventDefault();
        setQuickPreviewArticle(articles[selectedNavIndex]);
      } else if (e.key === "f" && articles[selectedNavIndex]) {
        e.preventDefault();
        const art = articles[selectedNavIndex];
        const nextVal = !art.state?.is_favorite;
        handleArticleStateChange(art.id, { is_favorite: nextVal });
        updateArticleState(art.id, { is_favorite: nextVal });
      } else if (e.key === "s" && articles[selectedNavIndex]) {
        e.preventDefault();
        const art = articles[selectedNavIndex];
        const nextVal = !art.state?.is_saved;
        handleArticleStateChange(art.id, { is_saved: nextVal });
        updateArticleState(art.id, { is_saved: nextVal });
      } else if (e.key === "o" && articles[selectedNavIndex]) {
        e.preventDefault();
        window.open(articles[selectedNavIndex].url, "_blank", "noopener,noreferrer");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    articles,
    selectedNavIndex,
    queryInput,
    category,
    period,
    sort,
    source,
    showRecentDropdown,
    updateUrl,
  ]);

  const hasActiveFilters =
    Boolean(debouncedQuery.trim()) ||
    category !== "all" ||
    period !== "all" ||
    source !== "all" ||
    sort !== "recent";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Header
        searchQuery={queryInput}
        onSearchChange={(q) => setQueryInput(q)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-3 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb & Navigation Bar */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
              title="Voltar ao feed principal"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-rose-500" />
              <span>Voltar ao Feed</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-zinc-600">/</span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-100">
                <Search className="h-3.5 w-3.5 text-rose-500" />
                <span>Busca de Alta Precisão</span>
              </div>
            </div>
          </div>

          {/* Density Toggle */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setDensity("comfortable");
                localStorage.setItem("acciofeed_density", "comfortable");
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors",
                density === "comfortable"
                  ? "bg-rose-500/15 text-rose-400 font-semibold ring-1 ring-rose-500/30"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
              title="Visualização confortável"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Confortável</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDensity("compact");
                localStorage.setItem("acciofeed_density", "compact");
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors",
                density === "compact"
                  ? "bg-rose-500/15 text-rose-400 font-semibold ring-1 ring-rose-500/30"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
              title="Visualização compacta"
            >
              <AlignJustify className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Compacta</span>
            </button>
          </div>
        </div>

        {/* Hero Search Box */}
        <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6 shadow-xl backdrop-blur-xs space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <input
              ref={searchInputRef}
              type="text"
              autoFocus
              placeholder="Pesquise por termos, tecnologias, modelos, hardware... (ex: NVIDIA Blackwell, Linux 6.14)"
              value={queryInput}
              onChange={(e) => {
                setQueryInput(e.target.value);
                setShowRecentDropdown(true);
              }}
              onFocus={() => setShowRecentDropdown(true)}
              className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 pl-12 pr-20 py-3.5 text-sm sm:text-base text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
            />
            {queryInput && (
              <button
                type="button"
                onClick={() => {
                  setQueryInput("");
                  setDebouncedQuery("");
                  updateUrl("", category, period, sort, source);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                title="Limpar busca (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Recent Searches Dropdown / Bar */}
          {recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <div className="flex items-center gap-1 text-zinc-500">
                <History className="h-3.5 w-3.5" />
                <span>Buscas recentes:</span>
              </div>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleSelectQuery(term)}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-zinc-300 hover:border-rose-500/40 hover:text-rose-300 transition-colors"
                >
                  <span>{term}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={clearRecentSearches}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-zinc-500 hover:text-rose-400 transition-colors ml-auto"
                title="Limpar histórico de buscas recentes"
              >
                <Trash2 className="h-3 w-3" />
                <span>Limpar</span>
              </button>
            </div>
          )}

          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 pt-4">
            {/* Period Filters */}
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="text-zinc-500 font-medium mr-1 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Período:
              </span>
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPeriod(opt.value)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 transition-colors font-medium",
                    period === opt.value
                      ? "bg-rose-600 text-white font-semibold shadow-xs"
                      : "border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Sort & Category Selectors */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Category Select */}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-zinc-200 outline-none hover:border-zinc-700 focus:border-rose-500 transition-colors"
                aria-label="Filtrar por categoria"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value} className="bg-zinc-900 text-zinc-200">
                    {c.label}
                  </option>
                ))}
              </select>

              {/* Source Select */}
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-zinc-200 outline-none hover:border-zinc-700 focus:border-rose-500 transition-colors max-w-[160px] truncate"
                aria-label="Filtrar por fonte"
              >
                <option value="all" className="bg-zinc-900 text-zinc-200">
                  Todas as fontes
                </option>
                {sources.map((s) => (
                  <option key={s.slug} value={s.slug} className="bg-zinc-900 text-zinc-200">
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Sort Select */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "relevance" | "recent" | "oldest")}
                className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-zinc-200 outline-none hover:border-zinc-700 focus:border-rose-500 transition-colors"
                aria-label="Ordenar resultados"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-zinc-900 text-zinc-200">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Metadata Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="flex items-center gap-2 text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" />
                <span>Buscando no acervo indexado...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-200">
                  {totalCount} {totalCount === 1 ? "notícia encontrada" : "notícias encontradas"}
                </span>
                {debouncedQuery && (
                  <span className="text-zinc-500">
                    para <span className="text-rose-400 font-mono">&quot;{debouncedQuery}&quot;</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-400 hover:border-rose-900/40 hover:text-rose-400 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpar filtros</span>
            </button>
          )}
        </div>

        {/* Error State Banner */}
        {hasError && (
          <div className="flex items-center justify-between rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 text-xs text-rose-300 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>Ocorreu um erro ao comunicar com a API de busca. Verifique sua conexão.</span>
            </div>
            <button
              type="button"
              onClick={() => performSearch(1, false)}
              className="underline font-semibold hover:text-rose-200"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Results List / Grid or States */}
        {isLoading ? (
          /* Skeleton Loader (Discreet & Non-Intrusive) */
          <div
            className={cn(
              density === "compact"
                ? "space-y-2"
                : "grid grid-cols-1 md:grid-cols-2 gap-4"
            )}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <div className="h-4 w-20 rounded bg-zinc-800" />
                  <div className="h-4 w-16 rounded bg-zinc-800" />
                </div>
                <div className="h-5 w-3/4 rounded bg-zinc-800" />
                <div className="h-4 w-full rounded bg-zinc-800/60" />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          /* Empty Search State */
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 py-16 px-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">
              <Search className="h-6 w-6" />
            </div>

            {debouncedQuery ? (
              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-base font-semibold text-zinc-200">
                  Nenhum resultado encontrado para &quot;{debouncedQuery}&quot;
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Tente verificar a grafia dos termos, ampliar o período para &quot;Todo período&quot; ou limpar os filtros de categoria e fonte.
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-colors shadow-lg shadow-rose-950/40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Limpar todos os filtros</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-lg mx-auto">
                <h3 className="text-base font-semibold text-zinc-200">
                  Digite para buscar em todo o feed
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  O motor de busca em PostgreSQL com unaccent e ranking por relevância encontra notícias em milissegundos.
                </p>

                {/* Quick Topics */}
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                    Sugestões rápidas
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {QUICK_SUGGESTIONS.map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => handleSelectQuery(topic)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300 hover:border-rose-500/50 hover:text-rose-400 transition-colors"
                      >
                        <Sparkles className="h-3 w-3 text-rose-500" />
                        <span>{topic}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Articles List */
          <div className="space-y-4">
            <div
              className={cn(
                density === "compact"
                  ? "space-y-2"
                  : "grid grid-cols-1 md:grid-cols-2 gap-4"
              )}
            >
              {articles.map((article, index) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  density={density}
                  searchQuery={debouncedQuery}
                  isSelected={selectedNavIndex === index}
                  onSelect={(art) => {
                    setSelectedNavIndex(index);
                    setSelectedArticle(art);
                  }}
                  onQuickPreview={(art) => {
                    setSelectedNavIndex(index);
                    setQuickPreviewArticle(art);
                  }}
                  onStateChange={handleArticleStateChange}
                  onHide={(id) => {
                    setArticles((prev) => prev.filter((a) => a.id !== id));
                  }}
                />
              ))}
            </div>

            {/* Pagination Load More */}
            {currentPage < totalPages && (
              <div className="flex justify-center pt-6">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-6 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-50 transition-colors shadow-lg"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" />
                      <span>Carregando mais notícias...</span>
                    </>
                  ) : (
                    <span>Carregar mais resultados ({totalCount - articles.length} restantes)</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Reader Modal */}
      <ArticleModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
        hasPrevious={selectedNavIndex > 0}
        hasNext={selectedNavIndex < articles.length - 1}
        onNavigatePrevious={() => {
          if (selectedNavIndex > 0) {
            const nextIdx = selectedNavIndex - 1;
            setSelectedNavIndex(nextIdx);
            setSelectedArticle(articles[nextIdx]);
          }
        }}
        onNavigateNext={() => {
          if (selectedNavIndex < articles.length - 1) {
            const nextIdx = selectedNavIndex + 1;
            setSelectedNavIndex(nextIdx);
            setSelectedArticle(articles[nextIdx]);
          }
        }}
        onStateChange={handleArticleStateChange}
        onHide={(id) => {
          setArticles((prev) => prev.filter((a) => a.id !== id));
          setSelectedArticle(null);
        }}
      />

      {/* Quick Preview Slide-over */}
      <QuickPreview
        article={quickPreviewArticle}
        onClose={() => setQuickPreviewArticle(null)}
        onOpenReader={(art) => {
          setQuickPreviewArticle(null);
          setSelectedArticle(art);
        }}
        onStateChange={handleArticleStateChange}
        onHide={(id) => {
          setArticles((prev) => prev.filter((a) => a.id !== id));
          setQuickPreviewArticle(null);
        }}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectCollection={() => {}}
        onSelectCategory={(cat) => setCategory(cat)}
        onSearch={(term) => handleSelectQuery(term)}
        currentDensity={density}
        onToggleDensity={() => {
          const next = density === "compact" ? "comfortable" : "compact";
          setDensity(next);
          localStorage.setItem("acciofeed_density", next);
        }}
        onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
      />

      {/* Shortcuts Help Modal */}
      <ShortcutsHelpModal
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <SearchPageContent />
    </Suspense>
  );
}
