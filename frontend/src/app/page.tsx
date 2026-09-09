"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Timeline } from "@/components/articles/timeline";
import { fetchSources } from "@/lib/api";
import { SourcePublic } from "@/lib/types";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [sources, setSources] = useState<SourcePublic[]>([]);

  useEffect(() => {
    async function loadSources() {
      const data = await fetchSources();
      setSources(data);
    }
    loadSources();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:px-8">
        <Sidebar
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          sources={sources}
          activeSource={activeSource}
          onSelectSource={setActiveSource}
        />

        <Timeline
          activeCategory={activeCategory}
          activeSource={activeSource}
          searchQuery={searchQuery}
        />
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        Tech News Hub &copy; {new Date().getFullYear()} — Agregador de Notícias Self-Hosted.
      </footer>
    </div>
  );
}
