"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CSVDropzone } from "@/components/csv-dropzone";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  searchImages,
  saveFlashcardSet,
  listFlashcardSets,
  getFlashcardSet,
} from "@/lib/api";
import type {
  ImageSSEEvent,
  FlashcardCard,
  FlashcardSetSummary,
} from "@/lib/api";

// ── CSV parsing ───────────────────────────────────────────────────────────────

function parseCSV(text: string): { firstName: string; lastName: string; company: string }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; }
      else current += char;
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().trim());
  const firstIdx = headers.findIndex((h) => /first\s*name/.test(h));
  const lastIdx = headers.findIndex((h) => /last\s*name/.test(h));
  const companyIdx = headers.findIndex((h) => /company\s*name|firm/.test(h));

  return lines.slice(1).map((line) => {
    const cols = parseRow(line);
    return {
      firstName: firstIdx >= 0 ? cols[firstIdx] || "" : "",
      lastName: lastIdx >= 0 ? cols[lastIdx] || "" : "",
      company: companyIdx >= 0 ? cols[companyIdx] || "" : "",
    };
  }).filter((r) => r.firstName || r.lastName);
}

// ── Flip Card ─────────────────────────────────────────────────────────────────

function FlipCard({
  card,
  flipped,
  onFlip,
  onSwipeLeft,
  onSwipeRight,
}: {
  card: FlashcardCard;
  flipped: boolean;
  onFlip: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      dx < 0 ? onSwipeLeft() : onSwipeRight();
    } else {
      onFlip();
    }
    touchStartX.current = null;
  };

  return (
    <div
      className="w-full h-full cursor-pointer select-none"
      style={{ perspective: "1200px" }}
      onClick={onFlip}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front – photo */}
        <div
          className="absolute inset-0 rounded-2xl border bg-white shadow-xl overflow-hidden"
          style={{ backfaceVisibility: "hidden" }}
        >
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.imageUrl}
              alt="Who is this?"
              className="h-full w-full object-cover"
              draggable={false}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <span className="text-7xl font-bold text-muted-foreground/20">?</span>
            </div>
          )}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <span className="rounded-full bg-black/40 px-4 py-1.5 text-sm text-white backdrop-blur-sm">
              Tap to reveal
            </span>
          </div>
        </div>

        {/* Back – name + firm */}
        <div
          className="absolute inset-0 rounded-2xl border bg-white shadow-xl flex flex-col items-center justify-center gap-4 px-8"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="text-6xl font-bold text-muted-foreground/10">
            {(card.firstName?.[0] || "")}{(card.lastName?.[0] || "")}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-center leading-snug">
            {card.firstName} {card.lastName}
          </h2>
          {card.company && (
            <p className="text-base text-muted-foreground text-center">{card.company}</p>
          )}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <span className="rounded-full bg-black/10 px-4 py-1.5 text-sm text-muted-foreground">
              Tap to flip back
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Flash Card Viewer ──────────────────────────────────────────────────────────

function FlashCardViewer({
  cards,
  onFinished,
}: {
  cards: FlashcardCard[];
  onFinished: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const goNext = useCallback(() => {
    setCurrentIdx((prev) => {
      if (prev + 1 >= cards.length) { onFinished(); return prev; }
      setFlipped(false);
      return prev + 1;
    });
  }, [cards.length, onFinished]);

  const goPrev = useCallback(() => {
    setCurrentIdx((prev) => {
      if (prev === 0) return prev;
      setFlipped(false);
      return prev - 1;
    });
  }, []);

  const toggleFlip = useCallback(() => setFlipped((f) => !f), []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " ") { e.preventDefault(); toggleFlip(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, toggleFlip]);

  if (cards.length === 0) return null;

  const atStart = currentIdx === 0;
  const atEnd = currentIdx + 1 >= cards.length;

  return (
    <div className="flex flex-col items-center gap-5 w-full px-2">
      {/* Counter */}
      <p className="text-sm text-muted-foreground tabular-nums">
        {currentIdx + 1} / {cards.length}
      </p>

      {/* Card + flanking arrows */}
      <div className="flex items-center gap-2 w-full justify-center">
        {/* Left arrow */}
        <button
          onClick={goPrev}
          disabled={atStart}
          aria-label="Previous card"
          className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full border bg-white shadow-sm disabled:opacity-20 active:scale-95 transition-all touch-manipulation"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Card */}
        <div style={{ width: "min(320px, calc(100vw - 112px))", height: "min(460px, 72vh)", flexShrink: 0 }}>
          <FlipCard
            card={cards[currentIdx]}
            flipped={flipped}
            onFlip={toggleFlip}
            onSwipeLeft={goNext}
            onSwipeRight={goPrev}
          />
        </div>

        {/* Right arrow */}
        <button
          onClick={goNext}
          aria-label={atEnd ? "Finish" : "Next card"}
          className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full border bg-white shadow-sm active:scale-95 transition-all touch-manipulation"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex gap-1.5 flex-wrap justify-center max-w-xs">
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrentIdx(i); setFlipped(false); }}
            aria-label={`Go to card ${i + 1}`}
            className={`w-2 h-2 rounded-full transition-all touch-manipulation ${
              i === currentIdx ? "bg-foreground scale-125" : "bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground/50">
        Tap card to flip · swipe or use ← → to navigate
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Phase = "home" | "loading" | "name" | "cards" | "done";

export default function FlashCardsPage() {
  const [phase, setPhase] = useState<Phase>("home");
  const [cards, setCards] = useState<FlashcardCard[]>([]);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Save dialog
  const [saveOpen, setSaveOpen] = useState(false);
  const [setName, setSetName] = useState("");
  const [saving, setSaving] = useState(false);

  // Saved sets
  const [savedSets, setSavedSets] = useState<FlashcardSetSummary[]>([]);
  const [loadingSets, setLoadingSets] = useState(true);

  useEffect(() => {
    listFlashcardSets()
      .then(setSavedSets)
      .catch(() => {})
      .finally(() => setLoadingSets(false));
  }, []);

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
          setPhase("name");
        }
      });
      if (phase === "loading") setPhase("name");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setPhase("home");
    }
  }, [phase]);

  const handleSave = useCallback(async () => {
    if (!setName.trim()) return;
    setSaving(true);
    try {
      await saveFlashcardSet(setName.trim(), cards);
      setSaveOpen(false);
      setPhase("cards");
      const sets = await listFlashcardSets();
      setSavedSets(sets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [setName, cards]);

  const handleSkipSave = useCallback(() => {
    setSaveOpen(false);
    setPhase("cards");
  }, []);

  const handleLoadSet = useCallback(async (id: string) => {
    try {
      const set = await getFlashcardSet(id);
      setCards(set.cards);
      setPhase("cards");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, []);

  const handleFinished = useCallback(() => {
    setPhase("done");
  }, []);

  // When phase becomes "name", open save dialog
  useEffect(() => {
    if (phase === "name") setSaveOpen(true);
  }, [phase]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Flash Cards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV of attorneys to generate photo flash cards.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      {/* ── Home: upload + saved sets ── */}
      {phase === "home" && (
        <div className="space-y-8">
          <CSVDropzone onFile={handleFile} disabled={false} />

          {!loadingSets && savedSets.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Saved Sets</h3>
              <div className="space-y-2">
                {savedSets.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleLoadSet(s.id)}
                    className="flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left transition-colors hover:bg-muted/50 active:bg-muted touch-manipulation"
                  >
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Loading: progress ── */}
      {phase === "loading" && (
        <div className="space-y-6">
          <ProgressBar current={completed} total={total} name="Finding photos…" />
          {cards.length > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              {cards.length} photo{cards.length !== 1 ? "s" : ""} found so far
            </p>
          )}
        </div>
      )}

      {/* ── Cards: flip card viewer ── */}
      {phase === "cards" && cards.length > 0 && (
        <FlashCardViewer cards={cards} onFinished={handleFinished} />
      )}

      {/* ── Done ── */}
      {phase === "done" && (
        <div className="text-center space-y-5">
          <p className="text-lg font-semibold">All cards reviewed!</p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" className="h-12 px-6 touch-manipulation" onClick={() => setPhase("cards")}>
              Review Again
            </Button>
            <Button className="h-12 px-6 touch-manipulation" onClick={() => { setPhase("home"); setCards([]); }}>
              Back to Home
            </Button>
          </div>
        </div>
      )}

      {/* ── Save dialog ── */}
      <Dialog open={saveOpen} onOpenChange={(o) => { if (!o) handleSkipSave(); }}>
        <DialogContent className="sm:max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>Name this flash card set</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {cards.length} card{cards.length !== 1 ? "s" : ""} ready. Give it a name to save for later.
          </p>
          <Input
            className="h-12 text-base"
            placeholder="e.g. MTMP Spring 2026"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="h-12 touch-manipulation" onClick={handleSkipSave}>
              Skip
            </Button>
            <Button className="h-12 touch-manipulation" onClick={handleSave} disabled={saving || !setName.trim()}>
              {saving ? "Saving…" : "Save & Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
