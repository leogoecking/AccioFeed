"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Timeline } from "@/components/articles/timeline";
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
  const initialPage = parseInt(searchParams.get("page") || "1", 10);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [activeSource, setActiveSource] = useState<string | null>(initialSource);
  const [activeCollection, setActiveCollection] = useState<string>(initialState);
  const [sort, setSort] = useState<"recent" | "popular" | "history" | "last_opened">(initialSort);
  const [page, setPage] = useState(initialPage);
  const [sources, setSources] = useState<SourcePublic[]>([]);
  const [stats, setStats] = useState<LibraryStats>({ unread: 0, saved: 0, favorites: 0, total: 0 });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatusText, setRefreshStatusText] = useState<string | null>(null);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  // Read sidebar preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("acciofeed_sidebar_collapsed");
      if (saved !== null) {
        setIsSidebarCollapsed(saved === "true");
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

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
    newSort: "recent" | "popular" | "history" | "last_opened",
    newPage: number
  ) => {
    const params = new URLSearchParams();
    if (newCat && newCat !== "all") params.set("category", newCat);
    if (newSrc) params.set("source", newSrc);
    if (newCol && newCol !== "all") params.set("state", newCol);
    if (newSearch.trim()) params.set("search", newSearch.trim());
    if (newSort !== "recent" && newCol !== "history") params.set("sort", newSort);
    if (newPage > 1) params.set("page", newPage.toString());

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

  const handleCollectionSelect = (col: string) => {
    setActiveCollection(col);
    setPage(1);
    const targetSort = col === "history" ? "history" : "recent";
    setSort(targetSort);
    updateUrlParams(activeCategory, activeSource, col, searchQuery, targetSort, 1);
  };

  const handleCategorySelect = (cat: string) => {
    setActiveCategory(cat);
    setActiveSource(null);
    setPage(1);
    updateUrlParams(cat, null, activeCollection, searchQuery, sort, 1);
  };

  const handleSourceSelect = (src: string | null) => {
    setActiveSource(src);
    setPage(1);
    updateUrlParams(activeCategory, src, activeCollection, searchQuery, sort, 1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
    updateUrlParams(activeCategory, activeSource, activeCollection, query, sort, 1);
  };

  const handleSortChange = (newSort: "recent" | "popular" | "history" | "last_opened") => {
    setSort(newSort);
    setPage(1);
    updateUrlParams(activeCategory, activeSource, activeCollection, searchQuery, newSort, 1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    updateUrlParams(activeCategory, activeSource, activeCollection, searchQuery, sort, newPage);
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Header
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshStatusText={refreshStatusText}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
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
          activeCollection={activeCollection}
          activeSource={activeSource}
          searchQuery={searchQuery}
          sort={sort}
          onSortChange={handleSortChange}
          page={page}
          onPageChange={handlePageChange}
          onStatsRefresh={loadStats}
        />
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <DashboardContent />
    </Suspense>
  );
}
