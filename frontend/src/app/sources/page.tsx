"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Globe,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import {
  createCustomSource,
  fetchSources,
  syncAllSources,
  syncSingleSource,
  updateSource,
  validateFeed,
} from "@/lib/api";
import { FeedValidateResponse, SourcePublic } from "@/lib/types";
import { formatRelativeTime, getCategoryBadge, getSourceBadge } from "@/lib/utils";
import { ApiConfigBanner } from "@/components/common/api-config-banner";

const CATEGORIES = [
  { id: "technology", label: "Tecnologia" },
  { id: "ai", label: "Inteligência Artificial" },
  { id: "hardware", label: "Hardware" },
  { id: "dev", label: "Desenvolvimento" },
  { id: "linux", label: "Linux" },
  { id: "opensource", label: "Open Source" },
  { id: "cybersecurity", label: "Cybersecurity" },
  { id: "science", label: "Ciência" },
  { id: "startups", label: "Startups" },
];

export default function SourcesPage() {
  const [sources, setSources] = useState<SourcePublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Add Source Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<FeedValidateResponse | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceCategory, setSourceCategory] = useState("technology");
  const [pollInterval, setPollInterval] = useState(15);
  const [isSaving, setIsSaving] = useState(false);

  const loadSources = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSources(false);
      setSources(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleToggleActive = async (source: SourcePublic) => {
    const nextState = !source.is_active;
    // Optimistic update
    setSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, is_active: nextState } : s))
    );
    try {
      await updateSource(source.id, { is_active: nextState });
      setFeedbackMessage({
        type: "success",
        text: `Fonte "${source.name}" ${nextState ? "ativada" : "desativada"} com sucesso.`,
      });
      loadSources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao alterar estado da fonte.";
      setFeedbackMessage({ type: "error", text: msg });
      loadSources();
    }
  };

  const handleSyncSource = async (source: SourcePublic) => {
    setSyncingSourceId(source.id);
    try {
      const res = await syncSingleSource(source.id);
      setFeedbackMessage({
        type: res.status === "error" ? "error" : "success",
        text: res.message,
      });
      loadSources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao sincronizar fonte.";
      setFeedbackMessage({ type: "error", text: msg });
    } finally {
      setSyncingSourceId(null);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const res = await syncAllSources();
      setFeedbackMessage({
        type: res.status === "error" ? "error" : "success",
        text: res.message,
      });
      loadSources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao sincronizar fontes.";
      setFeedbackMessage({ type: "error", text: msg });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleValidateFeed = async () => {
    if (!feedUrl.trim()) return;
    setIsValidating(true);
    setValidationError(null);
    setValidationResult(null);

    try {
      const preview = await validateFeed(feedUrl.trim());
      setValidationResult(preview);
      if (!sourceName) {
        setSourceName(preview.title || "Novo Feed RSS");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao validar URL do feed.";
      setValidationError(msg);
    } finally {
      setIsValidating(false);
    }
  };

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedUrl.trim() || !sourceName.trim()) return;

    setIsSaving(true);
    try {
      await createCustomSource({
        name: sourceName.trim(),
        feed_url: feedUrl.trim(),
        default_category: sourceCategory,
        poll_interval_minutes: pollInterval,
        base_url: validationResult?.site_url || undefined,
      });

      setFeedbackMessage({
        type: "success",
        text: `Fonte "${sourceName}" cadastrada com sucesso!`,
      });
      setShowAddModal(false);
      setFeedUrl("");
      setSourceName("");
      setValidationResult(null);
      loadSources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao salvar fonte.";
      setValidationError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 hover:text-slate-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar à Timeline</span>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Gerenciamento de Fontes</h1>
              <p className="text-xs text-slate-400">Ative, configure e adicione feeds RSS personalizados</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncAll}
              disabled={isSyncingAll}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50 transition-all"
              title="Sincronizar todas as fontes ativas"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncingAll ? "animate-spin text-cyan-400" : ""}`} />
              <span>{isSyncingAll ? "Sincronizando..." : "Sincronizar Todas"}</span>
            </button>

            <button
              onClick={() => {
                setShowAddModal(true);
                setValidationError(null);
                setValidationResult(null);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold px-3 py-2 text-xs transition-all shadow-md shadow-cyan-950/30"
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar RSS</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Feedback Alert Banner */}
        {feedbackMessage && (
          <div
            className={`flex items-center justify-between rounded-xl border p-4 text-sm ${
              feedbackMessage.type === "success"
                ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                : feedbackMessage.type === "error"
                ? "border-rose-500/30 bg-rose-950/20 text-rose-300"
                : "border-cyan-500/30 bg-cyan-950/20 text-cyan-300"
            }`}
          >
            <span>{feedbackMessage.text}</span>
            <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center animate-pulse">
            <p className="text-slate-400 text-sm">Carregando fontes cadastradas...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center space-y-4">
            <Globe className="mx-auto h-10 w-10 text-slate-600" />
            <div className="space-y-1">
              <p className="text-slate-300 font-medium">Nenhuma fonte cadastrada encontrada no banco de dados.</p>
              <p className="text-xs text-slate-500">
                Você pode sincronizar para carregar as fontes padrão ou adicionar seu primeiro feed RSS manualmente.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleSyncAll}
                disabled={isSyncingAll}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-500 disabled:opacity-50 transition-colors shadow-lg shadow-cyan-950/40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncingAll ? "animate-spin" : ""}`} />
                <span>{isSyncingAll ? "Sincronizando..." : "Sincronizar Fontes Padrão"}</span>
              </button>
              <button
                onClick={() => {
                  setShowAddModal(true);
                  setValidationError(null);
                  setValidationResult(null);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Adicionar RSS Manual</span>
              </button>
            </div>

            <div className="pt-4 max-w-xl mx-auto text-left">
              <ApiConfigBanner onConnected={loadSources} />
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Fonte</th>
                    <th className="px-6 py-4">Categoria</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Última Coleta</th>
                    <th className="px-6 py-4">Intervalo</th>
                    <th className="px-6 py-4">Ativo</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sources.map((source) => {
                    const badgeMeta = getSourceBadge(source.slug);
                    const catMeta = getCategoryBadge(source.default_category);

                    return (
                      <tr key={source.id} className="hover:bg-slate-900/80 transition-colors">
                        {/* Name & URL */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[10px] font-mono ${badgeMeta.badgeClass}`}
                            >
                              {source.type === "hacker_news" ? "API" : "RSS"}
                            </span>
                            <div>
                              <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                                <span>{source.name}</span>
                                <a
                                  href={source.base_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-500 hover:text-cyan-400"
                                  title="Visitar website"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                              <span className="text-[11px] text-slate-500 truncate max-w-xs block">
                                {source.feed_url || source.base_url}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="px-6 py-4">
                          <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${catMeta.className}`}>
                            {catMeta.label}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          {source.status === "disabled" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-2.5 py-0.5 text-[11px] text-slate-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                              Desativada
                            </span>
                          ) : source.status === "error" ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                Erro
                              </span>
                              {source.last_error_message && (
                                <p className="text-[10px] text-rose-400/80 max-w-xs truncate" title={source.last_error_message}>
                                  {source.last_error_message}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Saudável
                            </span>
                          )}
                        </td>

                        {/* Last Poll */}
                        <td className="px-6 py-4 text-slate-400">
                          {source.last_polled_at ? (
                            <div className="space-y-0.5">
                              <span>{formatRelativeTime(source.last_polled_at)}</span>
                              {source.last_success_at && (
                                <span className="text-[10px] text-slate-500 block">
                                  Sucesso: {formatRelativeTime(source.last_success_at)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600 italic">Pendente</span>
                          )}
                        </td>

                        {/* Interval */}
                        <td className="px-6 py-4 font-mono text-slate-400">
                          {source.poll_interval_minutes} min
                        </td>

                        {/* Toggle Active */}
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(source)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              source.is_active ? "bg-cyan-500" : "bg-slate-800"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                                source.is_active ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </td>

                        {/* Action buttons */}
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleSyncSource(source)}
                            disabled={syncingSourceId === source.id || !source.is_active}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 hover:border-slate-700 hover:text-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title="Sincronizar fonte individual"
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${syncingSourceId === source.id ? "animate-spin text-cyan-400" : ""}`}
                            />
                            <span>Sync</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add Custom Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8 space-y-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Globe className="h-5 w-5 text-cyan-400" />
                <span>Adicionar Feed RSS/Atom</span>
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSource} className="space-y-4">
              {/* Feed URL + Validate Button */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  URL do Feed RSS ou Atom <span className="text-rose-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    placeholder="https://exemplo.com/feed.xml"
                    value={feedUrl}
                    onChange={(e) => setFeedUrl(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleValidateFeed}
                    disabled={isValidating || !feedUrl.trim()}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    {isValidating ? "Validando..." : "Validar"}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Proteção integrada contra SSRF: apenas endereços públicos são aceitos.
                </p>
              </div>

              {/* Validation Error Message */}
              {validationError && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Validation Preview Card */}
              {validationResult && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Feed válido ({validationResult.format.toUpperCase()})</span>
                  </div>
                  <p className="text-slate-200 font-medium">{validationResult.title}</p>
                  <p className="text-slate-400">
                    {validationResult.articles_count} artigos detectados no feed.
                  </p>
                  {validationResult.latest_article_title && (
                    <p className="text-slate-500 text-[11px] truncate">
                      Último: {validationResult.latest_article_title}
                    </p>
                  )}
                </div>
              )}

              {/* Source Name */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nome da Fonte <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Phoronix Linux"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Category & Poll Interval Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Categoria Padrão
                  </label>
                  <select
                    value={sourceCategory}
                    onChange={(e) => setSourceCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Intervalo de Coleta
                  </label>
                  <select
                    value={pollInterval}
                    onChange={(e) => setPollInterval(parseInt(e.target.value, 10))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value={10}>10 minutos</option>
                    <option value={15}>15 minutos</option>
                    <option value={30}>30 minutos</option>
                    <option value={60}>1 hora</option>
                    <option value={120}>2 horas</option>
                  </select>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg px-4 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !sourceName.trim() || !feedUrl.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold px-4 py-2 text-xs disabled:opacity-50 transition-all shadow-md shadow-cyan-950/40"
                >
                  {isSaving ? "Salvando..." : "Cadastrar Fonte"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
