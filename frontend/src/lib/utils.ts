import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return "agora";
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) {
      return "ontem";
    }
    if (diffInDays < 7) {
      return `${diffInDays}d`;
    }

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return dateString;
  }
}

export function formatFullDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

/**
 * Deterministic reading time estimation based on 200 words per minute.
 * If text is too short (< 60 words), returns null to avoid displaying noisy "1 min" for micro-summaries.
 */
export function estimateReadingTime(text: string | null | undefined): string | null {
  if (!text) return null;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 60) return null;
  const minutes = Math.max(1, Math.round(words.length / 200));
  return `${minutes} min de leitura`;
}

export function getCategoryBadge(category: string): { label: string; className: string } {
  const cat = (category || "technology").toLowerCase();
  switch (cat) {
    case "ai":
      return { label: "IA", className: "bg-purple-950/40 text-purple-300 border-purple-800/40" };
    case "hardware":
      return { label: "Hardware", className: "bg-amber-950/40 text-amber-300 border-amber-800/40" };
    case "dev":
      return { label: "Dev", className: "bg-blue-950/40 text-blue-300 border-blue-800/40" };
    case "linux":
      return { label: "Linux", className: "bg-emerald-950/40 text-emerald-300 border-emerald-800/40" };
    case "opensource":
      return { label: "Open Source", className: "bg-teal-950/40 text-teal-300 border-teal-800/40" };
    case "cybersecurity":
      return { label: "Segurança", className: "bg-rose-950/40 text-rose-300 border-rose-800/40" };
    case "science":
      return { label: "Ciência", className: "bg-cyan-950/40 text-cyan-300 border-cyan-800/40" };
    case "technology":
      return { label: "Tecnologia", className: "bg-zinc-800/50 text-zinc-300 border-zinc-700/40" };
    case "startups":
      return { label: "Startups", className: "bg-orange-950/40 text-orange-300 border-orange-800/40" };
    default:
      return { label: "Geral", className: "bg-zinc-800/50 text-zinc-400 border-zinc-700/40" };
  }
}

export function getSourceBadge(slug: string): { badgeClass: string } {
  switch (slug) {
    case "hacker-news":
      return { badgeClass: "bg-orange-950/30 text-orange-400 border-orange-800/40" };
    case "ars-technica":
      return { badgeClass: "bg-rose-950/30 text-rose-400 border-rose-800/40" };
    case "the-verge":
      return { badgeClass: "bg-pink-950/30 text-pink-400 border-pink-800/40" };
    case "toms-hardware":
      return { badgeClass: "bg-amber-950/30 text-amber-400 border-amber-800/40" };
    case "mit-tech-review":
      return { badgeClass: "bg-indigo-950/30 text-indigo-400 border-indigo-800/40" };
    case "ieee-spectrum":
      return { badgeClass: "bg-blue-950/30 text-blue-400 border-blue-800/40" };
    case "github-blog":
      return { badgeClass: "bg-violet-950/30 text-violet-400 border-violet-800/40" };
    case "phoronix":
      return { badgeClass: "bg-emerald-950/30 text-emerald-400 border-emerald-800/40" };
    default:
      return { badgeClass: "bg-zinc-900 text-zinc-300 border-zinc-800" };
  }
}
