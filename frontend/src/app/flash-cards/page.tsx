"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { CSVDropzone } from "@/components/csv-dropzone";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { searchImages } from "@/lib/api";
import type { ImageSSEEvent, ImageSearchResult } from "@/lib/api";

interface FlashCard {
  firstName: string;
  lastName: string;
  company: string;
  imageUrl: string;
}

function parseCSV(text: string): { firstName: string; lastName: string; company: string }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().trim());
  const firstIdx = headers.findIndex((h) => /first\s*name/.test(h));
  const lastIdx = headers.findIndex((h) => /last\s*name/.test(h));
  const companyIdx = headers.findIndex((h) => /company\s*name|firm/.test(h));

  return lines
    .slice(1)
    .map((line) => {
      const cols = parseRow(line);
      return {
        firstName: firstIdx >= 0 ? cols[firstIdx] || "" : "",
        lastName: lastIdx >= 0 ? cols[lastIdx] || "" : "",
        company: companyIdx >= 0 ? cols[companyIdx] || "" : "",
      };
    })
    .filter((r) => r.firstName || r.lastName);
}

// ── Flashcard Viewer ──────────────────────────────────────────────────────────

function FlashCardViewer({ cards }: { cards: FlashCard[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const goNext = useCallback(() => {
    setCurrentIdx((prev) => Math.min(prev + 1, cards.length - 1));
    setSwipeOffset(0);
  }, [cards.length]);

  const goPrev = useCallback(() => {
    setCurrentIdx((prev) => Math.max(prev - 1, 0));
    setSwipeOffset(0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.touches[0].clientX - touchStart;
    setSwipeOffset(diff);
  };

  const handleTouchEnd = () => {
    if (Math.abs(swipeOffset) > 60) {
      if (swipeOffset < 0) goNext();
      else goPrev();
    }
    setSwipeOffset(0);
    setTouchStart(null);
  };

  if (cards.length === 0) return null;

  const card = cards[currentIdx];

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Card */}
      <div
        ref={containerRef}
        className="relative select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${swipeOffset * 0.3}px)`, transition: swipeOffset === 0 ? "transform 0.3s ease" : "none" }}
      >
        <div className="w-[320px] sm:w-[360px] overflow-hidden rounded-2xl border bg-white shadow-lg">
          {/* Image */}
          <div className="relative aspect-[3/4] w-full bg-muted">
            {card.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.imageUrl}
                alt={`${card.firstName} ${card.lastName}`}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="text-6xl font-bold text-muted-foreground/30">
                  {card.firstName[0]}{card.lastName[0]}
                </div>
              </div>
            )}
          </div>

          {/* Name */}
          <div className="px-5 py-4 text-center">
            <h2 className="text-lg font-semibold tracking-tight">
              {card.firstName} {card.lastName}
            </h2>
            {card.company && (
              <p className="mt-0.5 text-sm text-muted-foreground">{card.company}</p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={goPrev}
          disabled={currentIdx === 0}
        >
          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Prev
        </Button>

        <span className="text-sm text-muted-foreground tabular-nums">
          {currentIdx + 1} / {cards.length}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={goNext}
          disabled={currentIdx === cards.length - 1}
        >
          Next
          <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>

      {/* Dot indicators */}
      <div className="flex gap-1.5 flex-wrap justify-center max-w-[360px]">
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrentIdx(i); setSwipeOffset(0); }}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === currentIdx ? "bg-foreground" : "bg-muted-foreground/25"
            }`}
            aria-label={`Go to card ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FlashCardsPage() {
  const [phase, setPhase] = useState<"upload" | "loading" | "cards">("upload");
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;

    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) {
      setError("No valid rows found. CSV needs First Name and Last Name columns.");
      return;
    }

    setPhase("loading");
    setTotal(rows.length);
    setCompleted(0);
    setError(null);
    setCards([]);

    try {
      await searchImages(rows, (event: ImageSSEEvent) => {
        if (event.type === "row_complete" && event.result) {
          const r = event.result;
          setCards((prev) => [...prev, {
            firstName: r.firstName,
            lastName: r.lastName,
            company: r.company,
            imageUrl: r.imageUrl,
          }]);
          setCompleted(event.completed || 0);
        } else if (event.type === "complete") {
          setPhase("cards");
        }
      });
      setPhase("cards");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to search images");
      setPhase("upload");
    }
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Flash Cards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV of attorneys to generate photo flash cards.
        </p>
      </div>

      {error && (
        <div className="mx-auto mb-6 max-w-md rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {phase === "upload" && (
        <div className="mx-auto max-w-md">
          <CSVDropzone onFile={handleFile} disabled={false} />
        </div>
      )}

      {phase === "loading" && (
        <div className="mx-auto max-w-md space-y-6">
          <ProgressBar
            current={completed}
            total={total}
            name="Finding photos…"
          />
          {cards.length > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              {cards.length} photo{cards.length !== 1 ? "s" : ""} found so far
            </p>
          )}
        </div>
      )}

      {phase === "cards" && cards.length > 0 && (
        <div className="flex flex-col items-center gap-6">
          <FlashCardViewer cards={cards} />
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 text-xs text-muted-foreground"
            onClick={() => { setPhase("upload"); setCards([]); }}
          >
            Upload new CSV
          </Button>
        </div>
      )}

      {phase === "cards" && cards.length === 0 && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No images found.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setPhase("upload")}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
