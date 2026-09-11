import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * AccioFeed_ Brand Symbol:
 * Information converging to a focal point:
 *    •   •
 *  ↘ ↓ ↙
 *    ◉
 *  ACCIOFEED_
 */
export function BrandSymbol({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const dimensions = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  }[size];

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-lg bg-zinc-900/90 border border-zinc-800 text-rose-500 shadow-sm shrink-0 transition-transform duration-200 group-hover:scale-105",
        dimensions,
        className
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full p-1.5"
      >
        {/* Converging rays/vectors pointing toward the central node */}
        <path
          d="M5 4.5L9.5 9M12 3V9M19 4.5L14.5 9"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-rose-500/80"
        />
        {/* Outer focal pulse circle */}
        <circle
          cx="12"
          cy="16"
          r="4.5"
          className="fill-rose-500/15 stroke-rose-500"
          strokeWidth="1.6"
        />
        {/* Inner center nucleus */}
        <circle cx="12" cy="16" r="1.8" className="fill-rose-500" />
      </svg>
    </div>
  );
}

export function BrandLogo({ className, showText = true, size = "md" }: BrandLogoProps) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg py-1", className)}
      title="AccioFeed_ — Início"
    >
      <BrandSymbol size={size} />
      {showText && (
        <div className="flex items-baseline">
          <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-100 group-hover:text-white transition-colors font-sans">
            AccioFeed
          </span>
          <span className="text-rose-500 font-mono font-black text-lg ml-0.5 animate-pulse">
            _
          </span>
        </div>
      )}
    </Link>
  );
}
