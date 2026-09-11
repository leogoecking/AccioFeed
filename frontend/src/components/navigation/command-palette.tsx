"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  CheckCircle2,
  CornerDownLeft,
  Cpu,
  Globe,
  HelpCircle,
  History,
  LayoutGrid,
  Newspaper,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Terminal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ViewDensity } from "@/components/articles/timeline";

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "Coleções" | "Categorias" | "Ações";
  keywords?: string[];
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCollection: (col: string) => void;
  onSelectCategory: (cat: string) => void;
  onSearch: (query: string) => void;
  onRefresh?: () => void;
  currentDensity?: ViewDensity;
  onToggleDensity?: () => void;
  onOpenShortcutsHelp?: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectCollection,
  onSelectCategory,
  onSearch,
  onRefresh,
  currentDensity,
  onToggleDensity,
  onOpenShortcutsHelp,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open & clear query
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const allItems: CommandItem[] = useMemo(() => {
    return [
      // Collections
      {
        id: "col-all",
        title: "Todas as Notícias",
        subtitle: "Feed completo de todas as publicações",
        icon: Newspaper,
        group: "Coleções",
        keywords: ["tudo", "todas", "noticias", "home", "geral"],
        action: () => {
          onSelectCollection("all");
          onClose();
        },
      },
      {
        id: "col-unread",
        title: "Não Lidos",
        subtitle: "Apenas notícias que você ainda não abriu",
        icon: CheckCircle2,
        group: "Coleções",
        keywords: ["unread", "pendentes", "novos"],
        action: () => {
          onSelectCollection("unread");
          onClose();
        },
      },
      {
        id: "col-saved",
        title: "Salvos para Ler Depois",
        subtitle: "Artigos guardados para leitura posterior",
        icon: Bookmark,
        group: "Coleções",
        keywords: ["saved", "bookmarks", "ler depois", "guardados"],
        action: () => {
          onSelectCollection("saved");
          onClose();
        },
      },
      {
        id: "col-favorite",
        title: "Favoritos",
        subtitle: "Artigos marcados com estrela",
        icon: Star,
        group: "Coleções",
        keywords: ["stars", "favoritos", "destaques"],
        action: () => {
          onSelectCollection("favorite");
          onClose();
        },
      },
      {
        id: "col-history",
        title: "Histórico de Leitura",
        subtitle: "Linha cronológica das matérias lidas recentemente",
        icon: History,
        group: "Coleções",
        keywords: ["history", "historico", "lidos", "passado"],
        action: () => {
          onSelectCollection("history");
          onClose();
        },
      },

      // Categories
      {
        id: "cat-ai",
        title: "IA & Machine Learning",
        subtitle: "Modelos, papers, pesquisa e ecossistema de inteligência artificial",
        icon: Sparkles,
        group: "Categorias",
        keywords: ["ai", "ia", "ml", "inteligencia artificial", "deep learning", "llm"],
        action: () => {
          onSelectCategory("ai");
          onClose();
        },
      },
      {
        id: "cat-hardware",
        title: "Hardware & Chips",
        subtitle: "Semicondutores, processadores, placas e dispositivos",
        icon: Cpu,
        group: "Categorias",
        keywords: ["hardware", "chips", "gpu", "cpu", "intel", "amd", "nvidia", "apple silicon"],
        action: () => {
          onSelectCategory("hardware");
          onClose();
        },
      },
      {
        id: "cat-security",
        title: "Segurança & Privacidade",
        subtitle: "Vulnerabilidades, criptografia, brechas e defesa digital",
        icon: Shield,
        group: "Categorias",
        keywords: ["security", "segurança", "cyber", "privacidade", "vulnerabilidades"],
        action: () => {
          onSelectCategory("security");
          onClose();
        },
      },
      {
        id: "cat-dev",
        title: "Desenvolvimento & Software",
        subtitle: "Linguagens, frameworks, open source e engenharia",
        icon: Terminal,
        group: "Categorias",
        keywords: ["dev", "software", "programação", "engenharia", "github", "coding"],
        action: () => {
          onSelectCategory("development");
          onClose();
        },
      },
      {
        id: "cat-linux",
        title: "Linux & Sistemas Operacionais",
        subtitle: "Kernel, distribuições, drivers e infraestrutura",
        icon: Terminal,
        group: "Categorias",
        keywords: ["linux", "kernel", "phoronix", "unix", "sysadmin"],
        action: () => {
          onSelectCategory("linux");
          onClose();
        },
      },
      {
        id: "cat-science",
        title: "Ciência & Tecnologia",
        subtitle: "Biotecnologia, energia, física e telecomunicações",
        icon: Globe,
        group: "Categorias",
        keywords: ["science", "ciencia", "ieee", "mit", "futuro", "pesquisa"],
        action: () => {
          onSelectCategory("science");
          onClose();
        },
      },

      // Actions
      {
        id: "act-sync",
        title: "Sincronizar notícias agora",
        subtitle: "Bate nos feeds RSS e Hacker News para buscar novas publicações",
        icon: RefreshCw,
        group: "Ações",
        keywords: ["sync", "atualizar", "recarregar", "refresh", "buscar"],
        action: () => {
          onRefresh?.();
          onClose();
        },
      },
      {
        id: "act-density",
        title: `Alternar para modo ${currentDensity === "compact" ? "Confortável" : "Compacto"}`,
        subtitle: currentDensity === "compact"
          ? "Exibe cartões com imagens e resumos"
          : "Exibe linhas condensadas para varredura rápida",
        icon: LayoutGrid,
        group: "Ações",
        keywords: ["densidade", "density", "compact", "comfortable", "visualização", "layout"],
        action: () => {
          onToggleDensity?.();
          onClose();
        },
      },
      {
        id: "act-sources",
        title: "Gerenciar fontes e feeds",
        subtitle: "Configurar feeds RSS, ver status e adicionar novas fontes",
        icon: Settings,
        group: "Ações",
        keywords: ["fontes", "sources", "feeds", "rss", "config"],
        action: () => {
          onClose();
          router.push("/sources");
        },
      },
      {
        id: "act-shortcuts",
        title: "Ver atalhos de teclado (?)",
        subtitle: "Lista completa de atalhos e comandos rápidos do AccioFeed_",
        icon: HelpCircle,
        group: "Ações",
        keywords: ["atalhos", "shortcuts", "ajuda", "help", "teclado", "keys"],
        action: () => {
          onClose();
          onOpenShortcutsHelp?.();
        },
      },
    ];
  }, [
    currentDensity,
    onClose,
    onOpenShortcutsHelp,
    onRefresh,
    onSelectCategory,
    onSelectCollection,
    onToggleDensity,
    router,
  ]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;

    return allItems.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSub = item.subtitle?.toLowerCase().includes(q);
      const matchGroup = item.group.toLowerCase().includes(q);
      const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(q));
      return matchTitle || matchSub || matchGroup || matchKeywords;
    });
  }, [allItems, query]);

  // Clamp activeIndex
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems.length > 0 && filteredItems[activeIndex]) {
        filteredItems[activeIndex].action();
      } else if (query.trim()) {
        // Direct search execution
        onSearch(query.trim());
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div
        className="relative flex flex-col w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Top Search Input */}
        <div className="flex items-center border-b border-zinc-800/80 px-4 py-3 bg-zinc-900/60">
          <Search className="h-4 w-4 text-zinc-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Digite um comando, categoria ou busque uma notícia..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 rounded text-zinc-500 hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex ml-2 items-center rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2 divide-y divide-zinc-900"
        >
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <p className="text-xs text-zinc-400">Nenhum comando correspondente.</p>
              {query.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    onSearch(query.trim());
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-950/40 border border-rose-800/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-900/40 transition-colors"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Buscar por &ldquo;<strong>{query.trim()}</strong>&rdquo; na timeline</span>
                  <CornerDownLeft className="h-3 w-3 ml-1" />
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = idx === activeIndex;

              return (
                <button
                  key={item.id}
                  type="button"
                  data-index={idx}
                  onClick={item.action}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors",
                    isActive
                      ? "bg-rose-500/10 text-zinc-100 ring-1 ring-rose-500/30"
                      : "text-zinc-300 hover:bg-zinc-900/70"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                        isActive
                          ? "border-rose-500/40 bg-rose-950/60 text-rose-400"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-zinc-200 truncate">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-zinc-500 truncate">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">
                      {item.group}
                    </span>
                    {isActive && (
                      <CornerDownLeft className="h-3 w-3 text-rose-400" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 px-4 py-2.5 bg-zinc-900/30 text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-3">
            <span>↑↓ para navegar</span>
            <span>↵ para executar</span>
          </div>
          <span>AccioFeed_ Command Palette</span>
        </div>
      </div>
    </div>
  );
}
