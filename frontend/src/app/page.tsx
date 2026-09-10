"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Timeline } from "@/components/articles/timeline";
import { fetchSources } from "@/lib/api";
import { SourcePublic } from "@/lib/types";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial values from URL
  const initialCategory = searchParams.get("category") || "all";
  const initialSource = searchParams.get("source") || null;
  const initialSearch = searchParams.get("search") || "";
  const initialSort = (searchParams.get("sort") as "recent" | "popular") || "recent";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [activeSource, setActiveSource] = useState<string | null>(initialSource);
  const [sort, setSort] = useState<"recent" | "popular">(initialSort);
  const [page, setPage] = useState(initialPage);
  const [sources, setSources] = useState<SourcePublic[]>([]);

  // Sync state to URL params
  const updateUrlParams = (
    newCat: string,
    newSrc: string | null,
    newSearch: string,
    newSort: "recent" | "popular",
    newPage: number
  ) => {
    const params = new URLSearchParams();
    if (newCat && newCat !== "all") params.set("category", newCat);
    if (newSrc) params.set("source", newSrc);
    if (newSearch.trim()) params.set("search", newSearch.trim());
    if (newSort !== "recent") params.set("sort", newSort);
    if (newPage > 1) params.set("page", newPage.toString());

    const queryString = params.toString();
    const target = queryString ? `?${queryString}` : "/";
    router.replace(target, { scroll: false });
  };

  useEffect(() => {
    async function loadSources() {
      const data = await fetchSources();
      setSources(data);
    }
    loadSources();
  }, []);

  const handleCategorySelect = (cat: string) => {
    setActiveCategory(cat);
    setActiveSource(null);
    setPage(1);
    updateUrlParams(cat, null, searchQuery, sort, 1);
  };

  const handleSourceSelect = (src: string | null) => {
    setActiveSource(src);
    setPage(1);
    updateUrlParams(activeCategory, src, searchQuery, sort, 1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
    updateUrlParams(activeCategory, activeSource, query, sort, 1);
  };

  const handleSortChange = (newSort: "recent" | "popular") => {
    setSort(newSort);
    setPage(1);
    updateUrlParams(activeCategory, activeSource, searchQuery, newSort, 1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    updateUrlParams(activeCategory, activeSource, searchQuery, sort, newPage);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <Header
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:px-8">
        <Sidebar
          activeCategory={activeCategory}
          onSelectCategory={handleCategorySelect}
          sources={sources}
          activeSource={activeSource}
          onSelectSource={handleSourceSelect}
        />

        <Timeline
          activeCategory={activeCategory}
          activeSource={activeSource}
          searchQuery={searchQuery}
          sort={sort}
          onSortChange={handleSortChange}
          page={page}
          onPageChange={handlePageChange}
        />
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        Tech News Hub &copy; {new Date().getFullYear()} — Agregador de Notícias Self-Hosted.
      </footer>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <div className="h-16 border-b border-slate-800 bg-slate-950"></div>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:px-8">
        <div className="w-64 h-96 rounded-xl border border-slate-800 bg-slate-900/30 animate-pulse"></div>
        <div className="flex-1 space-y-4">
          <div className="h-10 border-b border-slate-800 bg-slate-900/30 animate-pulse"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-44 rounded-xl border border-slate-800 bg-slate-900/30 animate-pulse"></div>
            <div className="h-44 rounded-xl border border-slate-800 bg-slate-900/30 animate-pulse"></div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
