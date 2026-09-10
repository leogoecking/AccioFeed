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
      return "agora mesmo";
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `há ${diffInMinutes} min`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `há ${diffInHours}h`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `há ${diffInDays}d`;
    }

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

export function getCategoryBadge(category: string): { label: string; className: string } {
  const cat = (category || "technology").toLowerCase();
  switch (cat) {
    case "ai":
      return { label: "IA", className: "bg-purple-500/10 text-purple-400 border-purple-500/30" };
    case "hardware":
      return { label: "Hardware", className: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
    case "dev":
      return { label: "Dev", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
    case "linux":
      return { label: "Linux", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
    case "opensource":
      return { label: "Open Source", className: "bg-teal-500/10 text-teal-400 border-teal-500/30" };
    case "cybersecurity":
      return { label: "Segurança", className: "bg-rose-500/10 text-rose-400 border-rose-500/30" };
    case "science":
      return { label: "Ciência", className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" };
    case "technology":
      return { label: "Tecnologia", className: "bg-sky-500/10 text-sky-400 border-sky-500/30" };
    case "startups":
      return { label: "Startups", className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" };
    case "games":
      return { label: "Games", className: "bg-pink-500/10 text-pink-400 border-pink-500/30" };
    default:
      return { label: "Geral", className: "bg-slate-500/10 text-slate-400 border-slate-500/30" };
  }
}

export function getSourceBadge(slug: string): { badgeClass: string } {
  switch (slug) {
    case "hacker-news":
      return { badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/30" };
    case "ars-technica":
      return { badgeClass: "bg-red-500/10 text-red-400 border-red-500/30" };
    case "the-verge":
      return { badgeClass: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30" };
    case "toms-hardware":
      return { badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
    case "mit-tech-review":
      return { badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" };
    case "ieee-spectrum":
      return { badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
    case "github-blog":
      return { badgeClass: "bg-violet-500/10 text-violet-400 border-violet-500/30" };
    case "phoronix":
      return { badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
    default:
      return { badgeClass: "bg-slate-800 text-slate-300 border-slate-700" };
  }
}
