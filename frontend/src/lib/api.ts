import {
  ArticleDetail,
  ArticleFilters,
  ArticlePublic,
  ArticleStatePublic,
  ArticleTranslationPublic,
  FeedValidateResponse,
  LibraryStats,
  PaginatedResponse,
  SourcePublic,
  SyncResponse,
} from "./types";

export function getCustomApiUrl(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("technewshub_api_url") || "";
  }
  return "";
}

export function setCustomApiUrl(url: string): void {
  if (typeof window !== "undefined") {
    if (url.trim()) {
      localStorage.setItem("technewshub_api_url", url.trim().replace(/\/+$/, ""));
    } else {
      localStorage.removeItem("technewshub_api_url");
    }
  }
}

function getApiBase(): string {
  if (typeof window !== "undefined") {
    const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
    // Only use direct absolute URL if explicitly configured as a public https URL with valid domain
    if (raw && raw.startsWith("https://") && raw.includes(".") && !raw.includes("localhost")) {
      return raw.replace(/\/+$/, "");
    }
    // In browser, default to same-origin relative URL proxied by Next.js route handler
    return "";
  }

  const serverRaw = (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8001"
  ).trim();
  if (serverRaw.startsWith("http://") || serverRaw.startsWith("https://")) {
    return serverRaw.replace(/\/+$/, "");
  }
  return `http://${serverRaw}`.replace(/\/+$/, "");
}

const API_BASE = getApiBase();

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const custom = getCustomApiUrl();
  const headers = new Headers(init?.headers);
  if (custom && !headers.has("x-backend-url")) {
    headers.set("x-backend-url", custom);
  }
  return fetch(url, {
    ...init,
    headers,
  });
}

export async function testBackendConnection(
  testUrl?: string
): Promise<{ ok: boolean; message: string; sourceCount?: number }> {
  try {
    const headers = new Headers();
    if (testUrl && testUrl.trim()) {
      headers.set("x-backend-url", testUrl.trim());
    }
    const res = await apiFetch(`${API_BASE}/api/v1/sources`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        message: err.detail || `Erro HTTP ${res.status}: ${res.statusText}`,
      };
    }
    const data = await res.json();
    return {
      ok: true,
      message: "Conexão com a API estabelecida com sucesso!",
      sourceCount: Array.isArray(data) ? data.length : 0,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Falha na requisição",
    };
  }
}

export async function fetchArticles(
  filters: ArticleFilters = {},
  options?: { signal?: AbortSignal }
): Promise<PaginatedResponse<ArticlePublic>> {
  const params = new URLSearchParams();

  if (filters.source) params.set("source", filters.source);
  if (filters.category && filters.category !== "all") params.set("category", filters.category);
  if (filters.state && filters.state !== "all") params.set("state", filters.state);
  if (filters.search) params.set("search", filters.search);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.period && filters.period !== "all") params.set("period", filters.period);
  if (filters.page) params.set("page", filters.page.toString());
  if (filters.pageSize) params.set("page_size", filters.pageSize.toString());

  const url = `${API_BASE}/api/v1/articles${params.toString() ? `?${params.toString()}` : ""}`;

  try {
    const res = await apiFetch(url, {
      cache: "no-store",
      signal: options?.signal,
    });

    if (!res.ok) {
      throw new Error(`Erro ao buscar artigos: ${res.statusText}`);
    }

    return await res.json();
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    console.error("API error fetchArticles:", error);
    return {
      items: [],
      total: 0,
      page: 1,
      page_size: filters.pageSize || 20,
      pages: 1,
    };
  }
}

export async function fetchArticleById(id: string): Promise<ArticleDetail | null> {
  const url = `${API_BASE}/api/v1/articles/${id}`;
  try {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`API error fetchArticleById(${id}):`, error);
    return null;
  }
}

export async function updateArticleState(
  articleId: string,
  stateUpdate: Partial<ArticleStatePublic>
): Promise<ArticlePublic | null> {
  const url = `${API_BASE}/api/v1/articles/${articleId}/state`;
  try {
    const res = await apiFetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stateUpdate),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`API error updateArticleState(${articleId}):`, error);
    return null;
  }
}

export async function recordArticleOpened(articleId: string): Promise<ArticleDetail | null> {
  const url = `${API_BASE}/api/v1/articles/${articleId}/open`;
  try {
    const res = await apiFetch(url, {
      method: "POST",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`API error recordArticleOpened(${articleId}):`, error);
    return null;
  }
}

export async function fetchLibraryStats(): Promise<LibraryStats> {
  const url = `${API_BASE}/api/v1/library/stats`;
  try {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) {
      return { unread: 0, saved: 0, favorites: 0, total: 0 };
    }
    return await res.json();
  } catch (error) {
    console.error("API error fetchLibraryStats:", error);
    return { unread: 0, saved: 0, favorites: 0, total: 0 };
  }
}

export async function fetchSources(activeOnly: boolean = false): Promise<SourcePublic[]> {
  const url = `${API_BASE}/api/v1/sources${activeOnly ? "?active_only=true" : ""}`;
  try {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("API error fetchSources:", error);
    return [];
  }
}

export async function validateFeed(feedUrl: string): Promise<FeedValidateResponse> {
  const url = `${API_BASE}/api/v1/sources/validate`;
  const res = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feed_url: feedUrl }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail || `Falha ao validar feed (${res.status})`);
  }
  const data = await res.json().catch(() => null);
  if (!data) {
    throw new Error("Resposta inválida recebida do servidor ao validar feed.");
  }
  return data;
}

export async function createCustomSource(data: {
  name: string;
  feed_url: string;
  default_category: string;
  poll_interval_minutes: number;
  base_url?: string;
}): Promise<SourcePublic> {
  const url = `${API_BASE}/api/v1/sources`;
  const res = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail || `Falha ao cadastrar nova fonte (${res.status})`);
  }
  const result = await res.json().catch(() => null);
  if (!result) {
    throw new Error("Resposta inválida recebida do servidor ao cadastrar fonte.");
  }
  return result;
}

export async function updateSource(
  id: number,
  data: {
    name?: string;
    default_category?: string;
    poll_interval_minutes?: number;
    is_active?: boolean;
  }
): Promise<SourcePublic> {
  const url = `${API_BASE}/api/v1/sources/${id}`;
  const res = await apiFetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail || `Falha ao atualizar fonte (${res.status})`);
  }
  const result = await res.json().catch(() => null);
  if (!result) {
    throw new Error("Resposta inválida recebida do servidor ao atualizar fonte.");
  }
  return result;
}

export async function syncSingleSource(id: number): Promise<SyncResponse> {
  const url = `${API_BASE}/api/v1/sources/${id}/sync`;
  try {
    const res = await apiFetch(url, { method: "POST" });
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      const detail =
        errorData?.detail ||
        `Erro ao sincronizar fonte (Status HTTP ${res.status}${res.statusText ? `: ${res.statusText}` : ""})`;
      return {
        status: "error",
        message: detail,
        new_articles: 0,
        sources_processed: 0,
      };
    }
    const data = await res.json().catch(() => null);
    if (!data) {
      return {
        status: "error",
        message: "Resposta do servidor em formato inválido.",
        new_articles: 0,
        sources_processed: 0,
      };
    }
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Falha na requisição de sincronização.";
    return {
      status: "error",
      message: msg,
      new_articles: 0,
      sources_processed: 0,
    };
  }
}

export async function syncAllSources(force: boolean = true): Promise<SyncResponse> {
  const url = `${API_BASE}/api/v1/sources/sync?force=${force}`;
  try {
    const res = await apiFetch(url, { method: "POST" });
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      const detail =
        errorData?.detail ||
        `Erro ao sincronizar fontes (Status HTTP ${res.status}${res.statusText ? `: ${res.statusText}` : ""})`;
      return {
        status: "error",
        message: detail,
        new_articles: 0,
        sources_processed: 0,
      };
    }
    const data = await res.json().catch(() => null);
    if (!data) {
      return {
        status: "error",
        message: "Resposta do servidor em formato inválido.",
        new_articles: 0,
        sources_processed: 0,
      };
    }
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Falha na requisição de sincronização.";
    return {
      status: "error",
      message: msg,
      new_articles: 0,
      sources_processed: 0,
    };
  }
}

export async function fetchCategories(): Promise<string[]> {
  const url = `${API_BASE}/api/v1/categories`;
  try {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("API error fetchCategories:", error);
    return [];
  }
}

export async function fetchArticleTranslation(
  articleId: string,
  language: string = "pt-BR"
): Promise<ArticleTranslationPublic | null> {
  const url = `${API_BASE}/api/v1/articles/${articleId}/translations?language=${encodeURIComponent(language)}`;
  try {
    const res = await apiFetch(url, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("API error fetchArticleTranslation:", error);
    return null;
  }
}

export async function translateArticle(
  articleId: string,
  language: string = "pt-BR"
): Promise<ArticleTranslationPublic> {
  const url = `${API_BASE}/api/v1/articles/${articleId}/translations`;
  const res = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail ||
        "Não foi possível traduzir esta notícia agora. Você ainda pode visualizar o conteúdo original."
    );
  }
  return await res.json();
}
