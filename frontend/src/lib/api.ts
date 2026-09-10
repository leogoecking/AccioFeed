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

const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001").trim();
const API_BASE =
  rawApiUrl.startsWith("http://") || rawApiUrl.startsWith("https://")
    ? rawApiUrl
    : `https://${rawApiUrl}`;

export async function fetchArticles(filters: ArticleFilters = {}): Promise<PaginatedResponse<ArticlePublic>> {
  const params = new URLSearchParams();

  if (filters.source) params.set("source", filters.source);
  if (filters.category && filters.category !== "all") params.set("category", filters.category);
  if (filters.state && filters.state !== "all") params.set("state", filters.state);
  if (filters.search) params.set("search", filters.search);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.page) params.set("page", filters.page.toString());
  if (filters.pageSize) params.set("page_size", filters.pageSize.toString());

  const url = `${API_BASE}/api/v1/articles${params.toString() ? `?${params.toString()}` : ""}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Erro ao buscar artigos: ${res.statusText}`);
    }

    return await res.json();
  } catch (error) {
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
    const res = await fetch(url, { cache: "no-store" });
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
    const res = await fetch(url, {
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
    const res = await fetch(url, {
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
    const res = await fetch(url, { cache: "no-store" });
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
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("API error fetchSources:", error);
    return [];
  }
}

export async function validateFeed(feedUrl: string): Promise<FeedValidateResponse> {
  const url = `${API_BASE}/api/v1/sources/validate`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feed_url: feedUrl }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Falha ao validar feed.");
  }
  return await res.json();
}

export async function createCustomSource(data: {
  name: string;
  feed_url: string;
  default_category: string;
  poll_interval_minutes: number;
  base_url?: string;
}): Promise<SourcePublic> {
  const url = `${API_BASE}/api/v1/sources`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Falha ao cadastrar nova fonte.");
  }
  return await res.json();
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
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Falha ao atualizar fonte.");
  }
  return await res.json();
}

export async function syncSingleSource(id: number): Promise<SyncResponse> {
  const url = `${API_BASE}/api/v1/sources/${id}/sync`;
  const res = await fetch(url, { method: "POST" });
  return await res.json();
}

export async function syncAllSources(): Promise<SyncResponse> {
  const url = `${API_BASE}/api/v1/sources/sync`;
  const res = await fetch(url, { method: "POST" });
  return await res.json();
}

export async function fetchCategories(): Promise<string[]> {
  const url = `${API_BASE}/api/v1/categories`;
  try {
    const res = await fetch(url, { cache: "no-store" });
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
    const res = await fetch(url, { cache: "no-store" });
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
  const res = await fetch(url, {
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

