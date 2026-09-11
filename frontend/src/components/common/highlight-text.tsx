"use client";

import React, { useMemo } from "react";

interface HighlightTextProps {
  text: string;
  query?: string | null;
  className?: string;
  highlightClassName?: string;
}

// Maps characters to their accented / diacritic variants for resilient regex construction
function escapeRegexWithAccents(term: string): string {
  const accentMap: Record<string, string> = {
    a: "[aàáâãäåāAÀÁÂÃÄÅĀ]",
    e: "[eèéêëēEÈÉÊËĒ]",
    i: "[iìíîïīIÌÍÎÏĪ]",
    o: "[oòóôõöōOÒÓÔÕÖŌ]",
    u: "[uùúûüūUÙÚÛÜŪ]",
    c: "[cçCÇ]",
    n: "[nñNÑ]",
  };

  return term
    .split("")
    .map((char) => {
      const lower = char.toLowerCase();
      if (accentMap[lower]) {
        return accentMap[lower];
      }
      return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
}

export function HighlightText({
  text,
  query,
  className,
  highlightClassName = "bg-rose-500/20 text-rose-300 font-semibold px-0.5 rounded",
}: HighlightTextProps) {
  const parts = useMemo(() => {
    if (!query || !query.trim() || !text) {
      return null;
    }

    const terms = query
      .trim()
      .split(/\s+/)
      .map((t) => t.replace(/^[^\w]+|[^\w]+$/g, ""))
      .filter((t) => t.length > 0);

    if (terms.length === 0) {
      return null;
    }

    try {
      const patterns = terms.map(escapeRegexWithAccents).join("|");
      const regex = new RegExp(`(${patterns})`, "gi");
      const splitParts = text.split(regex);

      if (splitParts.length <= 1) {
        return null;
      }

      return splitParts.map((part, index) => {
        const isMatch = regex.test(part);
        regex.lastIndex = 0;
        return {
          text: part,
          isMatch,
          key: index,
        };
      });
    } catch {
      return null;
    }
  }, [text, query]);

  if (!parts) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {parts.map(({ text: partText, isMatch, key }) =>
        isMatch ? (
          <mark key={key} className={highlightClassName}>
            {partText}
          </mark>
        ) : (
          <React.Fragment key={key}>{partText}</React.Fragment>
        )
      )}
    </span>
  );
}
