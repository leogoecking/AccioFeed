"use client";

import { useEffect } from "react";
import { Command, Keyboard, X } from "lucide-react";

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  items: ShortcutItem[];
}

export function ShortcutsHelpModal({ isOpen, onClose }: ShortcutsHelpModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sections: ShortcutSection[] = [
    {
      title: "Navegação na Timeline",
      items: [
        { keys: ["j"], description: "Avançar para o próximo artigo" },
        { keys: ["k"], description: "Voltar para o artigo anterior" },
        { keys: ["Enter", "o"], description: "Abrir no leitor focado (Reader)" },
        { keys: ["Espaço", "p"], description: "Abrir visualização rápida lateral (Quick Preview)" },
      ],
    },
    {
      title: "Ações no Artigo Selecionado",
      items: [
        { keys: ["s"], description: "Salvar / remover de Ler Depois" },
        { keys: ["f"], description: "Favoritar / remover dos favoritos" },
        { keys: ["m"], description: "Alternar estado lido / não lido" },
      ],
    },
    {
      title: "Leitor Focado (Reader)",
      items: [
        { keys: ["←"], description: "Navegar para o artigo anterior" },
        { keys: ["→"], description: "Navegar para o próximo artigo" },
        { keys: ["Esc"], description: "Fechar leitor e voltar à timeline" },
      ],
    },
    {
      title: "Sistema & Busca",
      items: [
        { keys: ["Ctrl", "K"], description: "Abrir Command Palette" },
        { keys: ["r"], description: "Sincronizar notícias oficiais" },
        { keys: ["?"], description: "Exibir esta janela de atalhos" },
        { keys: ["Esc"], description: "Fechar painéis ou limpar busca" },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-dialog-title"
    >
      <div
        className="relative flex flex-col w-full max-w-xl max-h-[90vh] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-6 py-4 bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-950/60 border border-rose-800/40 text-rose-400">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <h2 id="shortcuts-dialog-title" className="text-base font-semibold text-zinc-100">
                Atalhos de Teclado
              </h2>
              <p className="text-xs text-zinc-400">Navegue pelo AccioFeed_ na velocidade do pensamento</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            title="Fechar (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2.5">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-rose-400/90">
                {section.title}
              </h3>
              <div className="divide-y divide-zinc-900/90 rounded-xl border border-zinc-800/70 bg-zinc-900/30 overflow-hidden">
                {section.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3.5 py-2 text-xs"
                  >
                    <span className="text-zinc-300 font-medium">{item.description}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {item.keys.map((k, ki) => (
                        <span key={ki} className="flex items-center gap-1">
                          {ki > 0 && <span className="text-[10px] text-zinc-600 font-mono">+</span>}
                          <kbd className="inline-flex min-w-[22px] items-center justify-center rounded border border-zinc-700/80 bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-zinc-200 shadow-xs">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 px-6 py-3 bg-zinc-900/30 text-xs text-zinc-500 font-mono">
          <div className="flex items-center gap-1.5">
            <Command className="h-3.5 w-3.5 text-zinc-400" />
            <span>Dica: Use <kbd className="text-zinc-300 border border-zinc-700 bg-zinc-800 px-1 rounded">Ctrl+K</kbd> a qualquer momento para comandos</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
