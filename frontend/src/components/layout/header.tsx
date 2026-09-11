"use client";

import { useEffect, useState } from "react";
import {
  HelpCircle,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { cn } from "@/lib/utils";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
  refreshStatusText?: string | null;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onToggleMobileMenu?: () => void;
  onOpenShortcutsHelp?: () => void;
  onOpenCommandPalette?: () => void;
}

export function Header({
  searchQuery,
  onSearchChange,
  onRefresh,
  isRefreshing = false,
  refreshStatusText = null,
  isSidebarCollapsed = false,
  onToggleSidebar,
  onToggleMobileMenu,
  onOpenShortcutsHelp,
  onOpenCommandPalette,
}: HeaderProps) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || ""));
    }
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8 gap-3">
        {/* Left Section: Mobile Menu + Desktop Collapse + Brand */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors"
            aria-label="Abrir menu de navegação"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop Sidebar Toggle */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="hidden lg:flex rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
              title={isSidebarCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
              aria-label={isSidebarCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Brand Logo */}
          <BrandLogo size="sm" />
        </div>

        {/* Center: Search Field with Cmd/Ctrl+K Hint */}
        <div className="flex flex-1 max-w-md mx-auto">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar notícias..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onSearchChange("");
              }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 pl-8 pr-16 py-1.5 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 outline-none transition-all focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30"
              aria-label="Buscar notícias"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-500 hover:text-zinc-200"
                title="Limpar busca (Esc)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : onOpenCommandPalette ? (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded border border-zinc-700/60 bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                title="Abrir Command Palette"
              >
                <span>{isMac ? "⌘" : "Ctrl"}</span>
                <span>K</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Right Section: Sync Button & Shortcuts */}
        <div className="flex items-center gap-2 shrink-0">
          {refreshStatusText && (
            <span className="hidden md:inline-block text-xs font-mono text-rose-400 bg-rose-950/30 border border-rose-800/30 px-2 py-0.5 rounded-md animate-fade-in">
              {refreshStatusText}
            </span>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50 transition-colors shadow-xs",
                isRefreshing && "text-rose-400 border-rose-900/40"
              )}
              title="Sincronizar notícias com fontes oficiais"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-rose-500")}
              />
              <span className="hidden sm:inline">
                {isRefreshing ? "Atualizando..." : "Atualizar"}
              </span>
            </button>
          )}

          {onOpenShortcutsHelp && (
            <button
              type="button"
              onClick={onOpenShortcutsHelp}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
              title="Atalhos de teclado (?)"
              aria-label="Atalhos de teclado"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
