"use client";

import {
  Bot,
  Code2,
  Cpu,
  Flame,
  Globe,
  Layers,
  Newspaper,
  Rocket,
  Shield,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SourcePublic } from "@/lib/types";

interface SidebarProps {
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  sources: SourcePublic[];
  activeSource: string | null;
  onSelectSource: (sourceSlug: string | null) => void;
}

const CATEGORIES = [
  { id: "all", label: "Tudo", icon: Layers },
  { id: "ai", label: "Inteligência Artificial", icon: Bot },
  { id: "hardware", label: "Hardware", icon: Cpu },
  { id: "dev", label: "Desenvolvimento", icon: Code2 },
  { id: "linux", label: "Linux", icon: Terminal },
  { id: "opensource", label: "Open Source", icon: Globe },
  { id: "cybersecurity", label: "Cybersecurity", icon: Shield },
  { id: "science", label: "Ciência", icon: Flame },
  { id: "startups", label: "Startups", icon: Rocket },
];

export function Sidebar({
  activeCategory,
  onSelectCategory,
  sources,
  activeSource,
  onSelectSource,
}: SidebarProps) {
  return (
    <aside className="w-full lg:w-64 shrink-0 space-y-6">
      {/* Categories */}
      <div>
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
                <Icon className={cn("h-4 w-4", isActive ? "text-cyan-400" : "text-slate-500")} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sources */}
      <div className="pt-4 border-t border-slate-800/80">
        <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Fontes
        </h3>
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
                  <Newspaper className={cn("h-4 w-4 shrink-0", isActive ? "text-cyan-400" : "text-slate-500")} />
                  <span className="truncate">{source.name}</span>
                </div>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                  {source.type.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
