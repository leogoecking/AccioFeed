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
  Search,
  Settings,
  Shield,
  Star,
  Terminal,
  X,
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
  isCollapsed?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const CATEGORIES = [
  { id: "all", label: "Todas Categorias", icon: Layers },
  { id: "ai", label: "Inteligência Artificial", icon: Bot },
  { id: "hardware", label: "Hardware", icon: Cpu },
  { id: "dev", label: "Desenvolvimento", icon: Code2 },
  { id: "cybersecurity", label: "Segurança", icon: Shield },
  { id: "linux", label: "Linux", icon: Terminal },
  { id: "opensource", label: "Open Source", icon: Globe },
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
  isCollapsed = false,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const collections = [
    { id: "all", label: "Tudo", icon: Newspaper, count: stats?.total },
    {
      id: "unread",
      label: "Não lidos",
      icon: CircleDot,
      count: stats?.unread,
      countClass: "bg-rose-950/40 text-rose-300 ring-1 ring-rose-800/40",
    },
    {
      id: "saved",
      label: "Ler depois",
      icon: Bookmark,
      count: stats?.saved,
      countClass: "bg-amber-950/40 text-amber-300 ring-1 ring-amber-800/40",
    },
    {
      id: "favorite",
      label: "Favoritos",
      icon: Star,
      count: stats?.favorites,
      countClass: "bg-yellow-950/40 text-yellow-300 ring-1 ring-yellow-800/40",
    },
    { id: "history", label: "Histórico", icon: Clock, count: undefined },
  ];

  const handleCollectionClick = (id: string) => {
    onSelectCollection(id);
    onCloseMobile?.();
  };

  const handleCategoryClick = (id: string) => {
    onSelectCategory(id);
    onCloseMobile?.();
  };

  const handleSourceClick = (slug: string | null) => {
    onSelectSource(slug);
    onCloseMobile?.();
  };

  const sidebarContent = (
    <div className={cn("space-y-6", isCollapsed && "space-y-4")}>
      {/* Personal Collections */}
      <div>
        {!isCollapsed && (
          <h3 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 font-mono">
            Biblioteca
          </h3>
        )}
        <nav className={cn("mt-1.5 space-y-0.5", isCollapsed && "mt-0")}>
          <Link
            href="/search"
            title={isCollapsed ? "Busca Avançada (/)" : undefined}
            className={cn(
              "flex w-full items-center rounded-lg text-sm font-medium transition-colors text-left",
              isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
              "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200"
            )}
          >
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            {!isCollapsed && <span>Busca</span>}
          </Link>

          {collections.map((col) => {
            const Icon = col.icon;
            const isActive = activeCollection === col.id;
            return (
              <button
                key={col.id}
                onClick={() => handleCollectionClick(col.id)}
                title={isCollapsed ? `${col.label}${col.count ? ` (${col.count})` : ""}` : undefined}
                className={cn(
                  "flex w-full items-center rounded-lg text-sm font-medium transition-colors text-left",
                  isCollapsed ? "justify-center p-2.5 relative" : "justify-between px-3 py-2",
                  isActive
                    ? "bg-rose-500/10 text-rose-400 font-semibold ring-1 ring-rose-500/30"
                    : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-rose-500" : col.id === "unread" ? "text-rose-400" : "text-zinc-500"
                    )}
                  />
                  {!isCollapsed && <span>{col.label}</span>}
                </div>
                {!isCollapsed && col.count !== undefined && col.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-mono font-medium",
                      col.countClass || "bg-zinc-800 text-zinc-400"
                    )}
                  >
                    {col.count}
                  </span>
                )}
                {isCollapsed && col.count !== undefined && col.count > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Categories */}
      <div className={cn("pt-4 border-t border-zinc-800/80", isCollapsed && "pt-3")}>
        {!isCollapsed && (
          <h3 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 font-mono">
            Categorias
          </h3>
        )}
        <nav className={cn("mt-1.5 space-y-0.5", isCollapsed && "mt-0")}>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                title={isCollapsed ? cat.label : undefined}
                className={cn(
                  "flex w-full items-center rounded-lg text-sm font-medium transition-colors text-left",
                  isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                  isActive
                    ? "bg-rose-500/10 text-rose-400 font-semibold ring-1 ring-rose-500/30"
                    : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200"
                )}
              >
                <Icon
                  className={cn("h-4 w-4 shrink-0", isActive ? "text-rose-500" : "text-zinc-500")}
                />
                {!isCollapsed && <span className="truncate">{cat.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sources */}
      <div className={cn("pt-4 border-t border-zinc-800/80", isCollapsed && "pt-3")}>
        {!isCollapsed && (
          <div className="flex items-center justify-between px-3 mb-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 font-mono">
              Fontes
            </h3>
            <Link
              href="/sources"
              className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-rose-400 transition-colors"
              title="Gerenciar Fontes"
            >
              <Settings className="h-3 w-3" />
              <span>Gerenciar</span>
            </Link>
          </div>
        )}
        <nav className="space-y-0.5">
          <button
            onClick={() => handleSourceClick(null)}
            title={isCollapsed ? "Todas as Fontes" : undefined}
            className={cn(
              "flex w-full items-center rounded-lg text-sm font-medium transition-colors text-left",
              isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
              activeSource === null
                ? "bg-rose-500/10 text-rose-400 font-semibold ring-1 ring-rose-500/30"
                : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200"
            )}
          >
            <Layers className={cn("h-4 w-4 shrink-0", activeSource === null ? "text-rose-500" : "text-zinc-500")} />
            {!isCollapsed && <span>Todas as Fontes</span>}
          </button>

          {sources.map((source) => {
            const isActive = activeSource === source.slug;
            const badgeMeta = getSourceBadge(source.slug);
            return (
              <button
                key={source.id}
                onClick={() => handleSourceClick(source.slug)}
                title={isCollapsed ? `${source.name} (${source.type === "hacker_news" ? "API" : "RSS"})` : undefined}
                className={cn(
                  "flex w-full items-center rounded-lg text-sm font-medium transition-colors text-left",
                  isCollapsed ? "justify-center p-2.5" : "justify-between px-3 py-2",
                  isActive
                    ? "bg-rose-500/10 text-rose-400 font-semibold ring-1 ring-rose-500/30"
                    : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200"
                )}
              >
                <div className="flex items-center gap-3 truncate">
                  <Newspaper
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-rose-500" : "text-zinc-500"
                    )}
                  />
                  {!isCollapsed && <span className="truncate">{source.name}</span>}
                </div>
                {!isCollapsed && (
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.2 text-[10px] font-mono shrink-0 ml-2",
                      badgeMeta.badgeClass
                    )}
                  >
                    {source.type === "hacker_news" ? "API" : "RSS"}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:block shrink-0 transition-all duration-200 ease-in-out",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Drawer (Accessible Sheet) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu de Navegação"
            className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-zinc-950 border-r border-zinc-800 p-6 overflow-y-auto shadow-2xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-5 border-b border-zinc-800/80 mb-5">
                <div className="flex items-baseline">
                  <span className="text-lg font-bold tracking-tight text-zinc-100 font-sans">
                    AccioFeed
                  </span>
                  <span className="text-rose-500 font-mono font-black text-lg ml-0.5">
                    _
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors"
                  aria-label="Fechar menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {sidebarContent}
            </div>

            <div className="pt-6 border-t border-zinc-800/80 text-xs text-zinc-500 flex items-center justify-between">
              <span>AccioFeed_ v1.0</span>
              <Link
                href="/sources"
                onClick={onCloseMobile}
                className="text-rose-400 hover:underline"
              >
                Gerenciar Fontes
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
