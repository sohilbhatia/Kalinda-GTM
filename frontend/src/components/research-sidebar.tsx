"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Components } from "react-markdown";

interface ResearchSidebarProps {
  open: boolean;
  prospectName: string;
  loading: boolean;
  result: string | null;
  onClose: () => void;
}

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SourceTag({ href, label }: { href: string; label?: string }) {
  const domain = extractDomain(href);
  const display = label && label !== href && !label.startsWith("http") ? label : domain;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground no-underline mx-0.5 align-middle"
    >
      <img
        src={`https://www.google.com/s2/favicons?sz=16&domain=${domain}`}
        alt=""
        className="h-3 w-3 rounded-sm"
      />
      {display}
    </a>
  );
}

function cleanSeparatorLines(text: string): string {
  return text
    .replace(/[─━═╌╍┄┅┈┉]{4,}[^─━═╌╍┄┅┈┉\n]*[─━═╌╍┄┅┈┉]{4,}/g, (match) => {
      const inner = match.replace(/[─━═╌╍┄┅┈┉]/g, "").trim();
      if (inner) return `### ${inner}`;
      return "---";
    })
    .replace(/[─━═╌╍┄┅┈┉]{4,}/g, "---");
}

const markdownComponents: Components = {
  a({ href, children }) {
    if (!href) return <>{children}</>;
    const childText = typeof children === "string" ? children : "";
    return <SourceTag href={href} label={childText} />;
  },
  h1({ children }) {
    return <h2 className="mt-6 mb-2 text-base font-bold leading-snug first:mt-0">{children}</h2>;
  },
  h2({ children }) {
    return <h3 className="mt-5 mb-2 text-sm font-bold leading-snug">{children}</h3>;
  },
  h3({ children }) {
    return <h4 className="mt-4 mb-1.5 text-sm font-semibold leading-snug">{children}</h4>;
  },
  h4({ children }) {
    return <h5 className="mt-3 mb-1 text-sm font-semibold leading-snug">{children}</h5>;
  },
  p({ children }) {
    return <p className="mb-3 leading-relaxed last:mb-0">{children}</p>;
  },
  strong({ children }) {
    return <strong className="font-semibold text-foreground">{children}</strong>;
  },
  ul({ children }) {
    return <ul className="mb-3 ml-4 list-disc space-y-1.5 [&_ul]:mb-0 [&_ul]:mt-1">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="mb-3 ml-4 list-decimal space-y-1.5 [&_ol]:mb-0 [&_ol]:mt-1">{children}</ol>;
  },
  li({ children }) {
    return <li className="leading-relaxed">{children}</li>;
  },
  hr() {
    return <hr className="my-4 border-border" />;
  },
  blockquote({ children }) {
    return (
      <blockquote className="mb-3 border-l-2 border-border pl-4 italic text-muted-foreground">
        {children}
      </blockquote>
    );
  },
};

export function ResearchSidebar({
  open,
  prospectName,
  loading,
  result,
  onClose,
}: ResearchSidebarProps) {
  const cleaned = useMemo(() => {
    if (!result) return "";
    return cleanSeparatorLines(result);
  }, [result]);

  const sources = useMemo(() => {
    if (!result) return [];
    const urlRegex = /https?:\/\/[^\s)\]>"',]+/g;
    const matches = result.match(urlRegex) || [];
    const trimmed = matches.map((u) => u.replace(/[.)]+$/, ""));
    const unique = [...new Set(trimmed)];
    return unique;
  }, [result]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-3xl flex-col border-l bg-white shadow-xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold">Research</h2>
            <p className="text-xs text-muted-foreground">{prospectName}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
              <p className="mt-4 text-sm text-muted-foreground">
                Researching {prospectName}...
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                This may take a minute
              </p>
            </div>
          )}

          {!loading && result && (
            <div className="text-sm text-foreground/90">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {cleaned}
              </ReactMarkdown>

              {sources.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Sources
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {sources.map((url, i) => (
                      <SourceTag key={i} href={url} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && !result && (
            <p className="text-sm text-muted-foreground">
              No research results yet.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
