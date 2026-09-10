"use client";

import Link from "next/link";
import {
  Bookmark,
  Bot,
  CircleDot,
  Clock,
  Code2,
  Cpu,
  Flame,
  Globe,
  Layers,
  Newspaper,
  Rocket,
  Settings,
  Shield,
  Sparkles,
  Star,
  Terminal,
} from "lucide-react";
import { LibraryStats, SourcePublic } from "@/lib/types";
import { cn, getSourceBadge } from "@/lib/utils";

interface SidebarProps {
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  activeCollection: string;
  onSelectCollection: (collection: string) => void;
  sources: SourcePublic[];
  activeSource: string | null;
  onSelectSource: (sourceSlug: string | null) => void;
  stats?: LibraryStats;
}

const CATEGORIES = [
  { id: "all", label: "Todas Categorias", icon: Layers },
  { id: "ai", label: "Inteligência Artificial", icon: Bot },
  { id: "hardware", label: "Hardware", icon: Cpu },
  { id: "dev", label: "Desenvolvimento", icon: Code2 },
  { id: "linux", label: "Linux", icon: Terminal },
  { id: "opensource", label: "Open Source", icon: Globe },
  { id: "cybersecurity", label: "Cybersecurity", icon: Shield },
  { id: "technology", label: "Tecnologia", icon: Sparkles },
  { id: "science", label: "Ciência", icon: Flame },
  { id: "startups", label: "Startups", icon: Rocket },
];

export function Sidebar({
  activeCategory,
  onSelectCategory,
  activeCollection,
  onSelectCollection,
  sources,
  activeSource,
  onSelectSource,
  stats,
}: SidebarProps) {
  const collections = [
    { id: "all", label: "Tudo", icon: Newspaper, count: stats?.total },
    { id: "unread", label: "Não lidos", icon: CircleDot, count: stats?.unread, countClass: "bg-cyan-500/20 text-cyan-300" },
    { id: "saved", label: "Ler depois", icon: Bookmark, count: stats?.saved, countClass: "bg-amber-500/20 text-amber-300" },
    { id: "favorite", label: "Favoritos", icon: Star, count: stats?.favorites, countClass: "bg-yellow-500/20 text-yellow-300" },
    { id: "history", label: "Histórico", icon: Clock, count: undefined },
  ];

  return (
    <aside className="w-full lg:w-64 shrink-0 space-y-6">
      {/* Personal Collections */}
      <div>
        <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Biblioteca
        </h3>
        <nav className="mt-2 space-y-1">
          {collections.map((col) => {
            const Icon = col.icon;
            const isActive = activeCollection === col.id;
            return (
              <button
                key={col.id}
                onClick={() => onSelectCollection(col.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all text-left",
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 font-semibold ring-1 ring-cyan-500/30"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isActive ? "text-cyan-400" : col.id === "unread" ? "text-cyan-400" : "text-slate-500"
                    )}
                  />
                  <span>{col.label}</span>
                </div>
                {col.count !== undefined && col.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-mono font-medium",
                      col.countClass || "bg-slate-800 text-slate-400"
                    )}
                  >
                    {col.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Categories */}
      <div className="pt-4 border-t border-slate-800/80">
        <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Categorias
        </h3>
        <nav className="mt-2 space-y-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all text-left",
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 font-semibold ring-1 ring-cyan-500/30"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                )}
              >
                <Icon
                  className={cn("h-4 w-4", isActive ? "text-cyan-400" : "text-slate-500")}
                />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sources */}
      <div className="pt-4 border-t border-slate-800/80">
        <div className="flex items-center justify-between px-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Fontes
          </h3>
          <Link
            href="/sources"
            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
            title="Gerenciar Fontes"
          >
            <Settings className="h-3 w-3" />
            <span>Gerenciar</span>
          </Link>
        </div>
        <div className="mt-2 space-y-1">
          <button
            onClick={() => onSelectSource(null)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all text-left",
              activeSource === null
                ? "bg-cyan-500/10 text-cyan-400 font-semibold ring-1 ring-cyan-500/30"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            )}
          >
            <div className="flex items-center gap-3">
              <Layers className="h-4 w-4 text-slate-500" />
              <span>Todas as Fontes</span>
            </div>
          </button>

          {sources.map((source) => {
            const isActive = activeSource === source.slug;
            const badgeMeta = getSourceBadge(source.slug);
            return (
              <button
                key={source.id}
                onClick={() => onSelectSource(source.slug)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all text-left",
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 font-semibold ring-1 ring-cyan-500/30"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                )}
              >
                <div className="flex items-center gap-3 truncate">
                  <Newspaper
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-cyan-400" : "text-slate-500"
                    )}
                  />
                  <span className="truncate">{source.name}</span>
                </div>
                <span
                  className={cn(
                    "rounded border px-1.5 py-0.2 text-[10px] font-mono",
                    badgeMeta.badgeClass
                  )}
                >
                  {source.type === "hacker_news" ? "API" : "RSS"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
