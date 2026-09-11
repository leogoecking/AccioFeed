"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Globe, RefreshCw, Server } from "lucide-react";
import { getCustomApiUrl, setCustomApiUrl, testBackendConnection } from "@/lib/api";

interface ApiConfigBannerProps {
  onConnected?: () => void;
}

export function ApiConfigBanner({ onConnected }: ApiConfigBannerProps) {
  const [apiUrl, setApiUrl] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    const saved = getCustomApiUrl();
    if (saved) {
      setApiUrl(saved);
    } else {
      setApiUrl("https://technewshub-api.onrender.com");
    }
  }, []);

  const handleTestAndSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!apiUrl.trim()) return;

    setIsTesting(true);
    setStatusMessage({
      type: "info",
      text: "Testando conexão com o backend...",
    });

    const cleanUrl = apiUrl.trim().replace(/\/+$/, "");
    const result = await testBackendConnection(cleanUrl);

    setIsTesting(false);

    if (result.ok) {
      setCustomApiUrl(cleanUrl);
      setStatusMessage({
        type: "success",
        text: `Conectado com sucesso! (${result.sourceCount ?? 0} fontes sincronizadas)`,
      });
      setTimeout(() => {
        onConnected?.();
      }, 800);
    } else {
      setStatusMessage({
        type: "error",
        text: `Falha ao conectar: ${result.message}`,
      });
    }
  };

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-zinc-900/90 p-5 shadow-2xl backdrop-blur-md space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-rose-500/10 p-2 text-rose-400">
          <Server className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-1">
          <h3 className="text-sm font-semibold text-zinc-100">
            Conexão com a API do Backend
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            No Render Free Tier, informe a URL pública HTTPS da sua API (exibida no painel do Render no serviço <code>technewshub-api</code>):
          </p>
        </div>
      </div>

      <form onSubmit={handleTestAndSave} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 h-4 w-4 -tranzinc-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://technewshub-api.onrender.com"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/80 pl-9 pr-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30"
          />
        </div>
        <button
          type="submit"
          disabled={isTesting || !apiUrl.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-all disabled:opacity-50 shadow-md shadow-rose-950"
        >
          {isTesting ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Conectando...</span>
            </>
          ) : (
            <span>Salvar e Conectar</span>
          )}
        </button>
      </form>

      {statusMessage && (
        <div
          className={`flex items-center gap-2 rounded-lg p-2.5 text-xs ${
            statusMessage.type === "success"
              ? "border border-emerald-500/30 bg-emerald-950/30 text-emerald-300"
              : statusMessage.type === "error"
              ? "border border-rose-500/30 bg-rose-950/30 text-rose-300"
              : "border border-rose-500/30 bg-rose-950/30 text-rose-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <RefreshCw
              className={`h-4 w-4 shrink-0 ${
                statusMessage.type === "info" ? "animate-spin" : ""
              }`}
            />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
}
