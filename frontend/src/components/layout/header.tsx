"use client";

import { Search, Zap } from "lucide-react";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
}

export function Header({ searchQuery, onSearchChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-100">
              Tech News Hub
            </span>
            <span className="ml-2 hidden rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-400 ring-1 ring-cyan-500/20 sm:inline-block">
              MVP
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar notícias por título..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/60 pl-9 pr-4 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="hidden sm:inline font-mono">Self-Hosted</span>
        </div>
      </div>
    </header>
  );
}
