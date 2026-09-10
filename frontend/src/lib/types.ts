export interface SourceSimple {
  name: string;
  slug: string;
  type?: string | null;
}

export interface SourcePublic {
  id: number;
  name: string;
  slug: string;
  type: string;
  base_url: string;
  feed_url?: string | null;
  default_category: string;
  is_active: boolean;
  poll_interval_minutes: number;
  status: "healthy" | "warning" | "error" | "disabled";
  last_polled_at?: string | null;
  last_success_at?: string | null;
  last_error_at?: string | null;
  last_error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetricSummary {
  score: number | null;
  comments: number | null;
}

export interface ArticleStatePublic {
  is_read: boolean;
  is_favorite: boolean;
  is_saved: boolean;
  is_hidden: boolean;
  saved_at?: string | null;
  first_opened_at?: string | null;
  last_opened_at?: string | null;
}

export interface ArticlePublic {
  id: string;
  title: string;
  url: string;
  canonical_url?: string | null;
  source: SourceSimple;
  author?: string | null;
  summary?: string | null;
  content?: string | null;
  image_url?: string | null;
  published_at: string;
  category: string;
  metrics: MetricSummary;
  state: ArticleStatePublic;
}

export interface ArticleDetail extends ArticlePublic {
  source: SourcePublic;
  collected_at: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ArticleFilters {
  source?: string;
  category?: string;
  state?: "all" | "unread" | "favorite" | "saved" | "hidden" | "history";
  search?: string;
  sort?: "recent" | "popular" | "history" | "last_opened";
  page?: number;
  pageSize?: number;
}

export interface LibraryStats {
  unread: number;
  saved: number;
  favorites: number;
  total: number;
}

export interface FeedValidateResponse {
  is_valid: boolean;
  format: string;
  title: string;
  description?: string | null;
  site_url?: string | null;
  articles_count: number;
  latest_article_title?: string | null;
  latest_article_published_at?: string | null;
  sample_articles?: Array<{
    title: string;
    url: string;
    published_at: string;
    author?: string | null;
  }>;
}

export interface SyncResponse {
  status: string;
  message: string;
  new_articles: number;
  sources_processed: number;
}
