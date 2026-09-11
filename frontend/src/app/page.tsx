"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Timeline, ViewDensity } from "@/components/articles/timeline";
import { CommandPalette } from "@/components/navigation/command-palette";
import { ShortcutsHelpModal } from "@/components/navigation/shortcuts-help-modal";
import { fetchLibraryStats, fetchSources } from "@/lib/api";
import { LibraryStats, SourcePublic } from "@/lib/types";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial values from URL
  const initialCategory = searchParams.get("category") || "all";
  const initialSource = searchParams.get("source") || null;
  const initialState = searchParams.get("state") || "all";
  const initialSearch = searchParams.get("search") || "";
  const initialSort = (searchParams.get("sort") as "recent" | "popular" | "history" | "last_opened") || "recent";

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(initialSearch);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [activeSource, setActiveSource] = useState<string | null>(initialSource);
  const [activeCollection, setActiveCollection] = useState<string>(initialState);
  const [sort, setSort] = useState<"recent" | "popular" | "history" | "last_opened">(initialSort);
  const [sources, setSources] = useState<SourcePublic[]>([]);
  const [stats, setStats] = useState<LibraryStats>({ unread: 0, saved: 0, favorites: 0, total: 0 });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatusText, setRefreshStatusText] = useState<string | null>(null);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  // Power Navigation Modals & Density
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [density, setDensity] = useState<ViewDensity>("comfortable");

  // Read sidebar preference & density from localStorage
  useEffect(() => {
    try {
      const savedSidebar = localStorage.getItem("acciofeed_sidebar_collapsed");
      if (savedSidebar !== null) {
        setIsSidebarCollapsed(savedSidebar === "true");
      }

      const savedDensity = localStorage.getItem("acciofeed_density") as ViewDensity | null;
      if (savedDensity === "comfortable" || savedDensity === "compact") {
        setDensity(savedDensity);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleToggleDensity = () => {
    setDensity((prev) => {
      const next = prev === "compact" ? "comfortable" : "compact";
      try {
        localStorage.setItem("acciofeed_density", next);
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("acciofeed_sidebar_collapsed", String(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  };

  // Sync state to URL params
  const updateUrlParams = (
    newCat: string,
    newSrc: string | null,
    newCol: string,
    newSearch: string,
    newSort: "recent" | "popular" | "history" | "last_opened"
  ) => {
    const params = new URLSearchParams();
    if (newCat && newCat !== "all") params.set("category", newCat);
    if (newSrc) params.set("source", newSrc);
    if (newCol && newCol !== "all") params.set("state", newCol);
    if (newSearch.trim()) params.set("search", newSearch.trim());
    if (newSort !== "recent" && newCol !== "history") params.set("sort", newSort);

    const queryString = params.toString();
    const target = queryString ? `?${queryString}` : "/";
    router.replace(target, { scroll: false });
  };

  const loadStats = async () => {
    const st = await fetchLibraryStats();
    setStats(st);
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshStatusText("Atualizando...");
    try {
      const { syncAllSources } = await import("@/lib/api");
      const res = await syncAllSources(true);
      const [sourcesData, statsData] = await Promise.all([
        fetchSources(true),
        fetchLibraryStats(),
      ]);
      setSources(sourcesData);
      setStats(statsData);
      setTimelineRefreshKey((k) => k + 1);

      if (res.new_articles > 0) {
        setRefreshStatusText(`${res.new_articles} novas notícias`);
      } else {
        setRefreshStatusText("Tudo atualizado");
      }
    } catch (err) {
      console.error("Refresh failed:", err);
      setRefreshStatusText("Falha ao atualizar");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshStatusText(null), 3500);
    }
  };

  useEffect(() => {
    async function loadData() {
      const [sourcesData, statsData] = await Promise.all([
        fetchSources(true),
        fetchLibraryStats(),
      ]);
      setSources(sourcesData);
      setStats(statsData);
    }
    loadData();
  }, []);

  // 300ms search debouncing to eliminate redundant API requests (Milestone 5)
  useEffect(() => {
    if (!searchInput.trim()) {
      if (debouncedSearchQuery) {
        setDebouncedSearchQuery("");
        updateUrlParams(activeCategory, activeSource, activeCollection, "", sort);
      }
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchInput.trim());
      updateUrlParams(activeCategory, activeSource, activeCollection, searchInput.trim(), sort);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCollectionSelect = (col: string) => {
    setActiveCollection(col);
    const targetSort = col === "history" ? "history" : "recent";
    setSort(targetSort);
    updateUrlParams(activeCategory, activeSource, col, debouncedSearchQuery, targetSort);
  };

  const handleCategorySelect = (cat: string) => {
    setActiveCategory(cat);
    setActiveSource(null);
    updateUrlParams(cat, null, activeCollection, debouncedSearchQuery, sort);
  };

  const handleSourceSelect = (src: string | null) => {
    setActiveSource(src);
    updateUrlParams(activeCategory, src, activeCollection, debouncedSearchQuery, sort);
  };

  const handleSearchChange = (query: string) => {
    setSearchInput(query);
    if (!query.trim()) {
      setDebouncedSearchQuery("");
      updateUrlParams(activeCategory, activeSource, activeCollection, "", sort);
    }
  };

  const handleSearchImmediate = (query: string) => {
    setSearchInput(query);
    setDebouncedSearchQuery(query);
    updateUrlParams(activeCategory, activeSource, activeCollection, query, sort);
  };

  const handleSortChange = (newSort: "recent" | "popular" | "history" | "last_opened") => {
    setSort(newSort);
    updateUrlParams(activeCategory, activeSource, activeCollection, debouncedSearchQuery, newSort);
  };

  const handleRefreshRef = useRef(handleRefresh);
  useEffect(() => {
    handleRefreshRef.current = handleRefresh;
  });

  // Global system shortcuts (Cmd+K / Ctrl+K, ?, r)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (isInput) return;

      if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsHelpOpen(true);
      } else if (e.key === "r") {
        e.preventDefault();
        handleRefreshRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Header
        searchQuery={searchInput}
        onSearchChange={handleSearchChange}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshStatusText={refreshStatusText}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-3 py-6 sm:px-6 lg:flex-row lg:px-8">
        <Sidebar
          activeCategory={activeCategory}
          onSelectCategory={handleCategorySelect}
          activeCollection={activeCollection}
          onSelectCollection={handleCollectionSelect}
          sources={sources}
          activeSource={activeSource}
          onSelectSource={handleSourceSelect}
          stats={stats}
          isCollapsed={isSidebarCollapsed}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        <Timeline
          key={timelineRefreshKey}
          activeCategory={activeCategory}
          onCategoryChange={handleCategorySelect}
          activeCollection={activeCollection}
          activeSource={activeSource}
          onSourceChange={handleSourceSelect}
          searchQuery={debouncedSearchQuery}
          onSearchChange={handleSearchChange}
          sort={sort}
          onSortChange={handleSortChange}
          density={density}
          onDensityChange={(d) => setDensity(d)}
          onResetFilters={() => {
            setActiveCategory("all");
            setActiveSource(null);
            setActiveCollection("all");
            setSearchInput("");
            setDebouncedSearchQuery("");
            setSort("recent");
            updateUrlParams("all", null, "all", "", "recent");
          }}
          onStatsRefresh={loadStats}
        />
      </main>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectCollection={handleCollectionSelect}
        onSelectCategory={handleCategorySelect}
        onSearch={handleSearchImmediate}
        onRefresh={handleRefresh}
        currentDensity={density}
        onToggleDensity={handleToggleDensity}
        onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
      />

      <ShortcutsHelpModal
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <DashboardContent />
    </Suspense>
  );
}
