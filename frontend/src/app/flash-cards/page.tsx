"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

// ── Tinder-style Card ─────────────────────────────────────────────────────────

function TinderCard({
  card,
  onSwipe,
  isTop,
}: {
  card: FlashcardCard;
  onSwipe: () => void;
  isTop: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false, startX: 0, startY: 0 });
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);

  const rotation = drag.x * 0.08;
  const opacity = Math.max(0.4, 1 - Math.abs(drag.x) / 400);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isTop) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ x: 0, y: 0, active: true, startX: e.clientX, startY: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag.active) return;
    setDrag((d) => ({
      ...d,
      x: e.clientX - d.startX,
      y: e.clientY - d.startY,
    }));
  };

  const handlePointerUp = () => {
    if (!drag.active) return;
    if (Math.abs(drag.x) > 100) {
      setExiting(drag.x > 0 ? "right" : "left");
      setTimeout(onSwipe, 300);
    }
    setDrag({ x: 0, y: 0, active: false, startX: 0, startY: 0 });
  };

  const style = exiting
    ? {
        transform: `translateX(${exiting === "right" ? 800 : -800}px) rotate(${exiting === "right" ? 30 : -30}deg)`,
        opacity: 0,
        transition: "transform 0.3s ease-out, opacity 0.3s ease-out",
      }
    : {
        transform: `translateX(${drag.x}px) translateY(${drag.y * 0.3}px) rotate(${rotation}deg)`,
        opacity,
        transition: drag.active ? "none" : "transform 0.3s ease, opacity 0.3s ease",
        cursor: isTop ? "grab" : "default",
        zIndex: isTop ? 10 : 1,
      };

  return (
    <div
      ref={cardRef}
      className="absolute inset-0"
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="w-full h-full overflow-hidden rounded-2xl border bg-white shadow-xl select-none">
        <div className="relative w-full" style={{ height: "75%" }}>
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.imageUrl}
              alt={`${card.firstName} ${card.lastName}`}
              className="h-full w-full object-cover pointer-events-none"
              draggable={false}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <div className="text-7xl font-bold text-muted-foreground/20">
                {(card.firstName?.[0] || "")}{(card.lastName?.[0] || "")}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center justify-center px-4" style={{ height: "25%" }}>
          <h2 className="text-xl font-semibold tracking-tight text-center">
            {card.firstName} {card.lastName}
          </h2>
          {card.company && (
            <p className="mt-1 text-sm text-muted-foreground text-center">{card.company}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tinder Viewer ─────────────────────────────────────────────────────────────

function TinderViewer({
  cards,
  onFinished,
}: {
  cards: FlashcardCard[];
  onFinished: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        setCurrentIdx((prev) => {
          const next = prev + 1;
          if (next >= cards.length) { onFinished(); return prev; }
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [cards.length, onFinished]);

  const handleSwipe = useCallback(() => {
    setCurrentIdx((prev) => {
      const next = prev + 1;
      if (next >= cards.length) {
        setTimeout(onFinished, 100);
        return prev;
      }
      return next;
    });
  }, [cards.length, onFinished]);

  if (cards.length === 0) return null;

  const visibleCards = cards.slice(currentIdx, currentIdx + 2).reverse();

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div
        className="relative mx-auto"
        style={{ width: "min(340px, 90vw)", height: "min(480px, 75vh)" }}
      >
        {visibleCards.map((card, i) => (
          <TinderCard
            key={currentIdx + visibleCards.length - 1 - i}
            card={card}
            onSwipe={handleSwipe}
            isTop={i === visibleCards.length - 1}
          />
        ))}
      </div>

      <p className="text-sm text-muted-foreground tabular-nums">
        {Math.min(currentIdx + 1, cards.length)} / {cards.length}
      </p>

      <p className="text-xs text-muted-foreground/60">
        Swipe or use arrow keys
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
          <button className="ml-2 underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      {/* ── Home: upload + saved sets ── */}
      {phase === "home" && (
        <div className="space-y-8">
          <div className="mx-auto max-w-md">
            <CSVDropzone onFile={handleFile} disabled={false} />
          </div>

          {!loadingSets && savedSets.length > 0 && (
            <div className="mx-auto max-w-md space-y-3">
              <h3 className="text-sm font-semibold">Saved Sets</h3>
              <div className="space-y-2">
                {savedSets.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleLoadSet(s.id)}
                    className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50"
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
        <div className="mx-auto max-w-md space-y-6">
          <ProgressBar current={completed} total={total} name="Finding photos…" />
          {cards.length > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              {cards.length} photo{cards.length !== 1 ? "s" : ""} found so far
            </p>
          )}
        </div>
      )}

      {/* ── Cards: Tinder viewer ── */}
      {phase === "cards" && cards.length > 0 && (
        <TinderViewer cards={cards} onFinished={handleFinished} />
      )}

      {/* ── Done ── */}
      {phase === "done" && (
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold">All cards reviewed!</p>
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => setPhase("cards")}
            >
              Review Again
            </Button>
            <Button
              onClick={() => { setPhase("home"); setCards([]); }}
            >
              Back to Home
            </Button>
          </div>
        </div>
      )}

      {/* ── Save dialog ── */}
      <Dialog open={saveOpen} onOpenChange={(o) => { if (!o) handleSkipSave(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Name this flash card set</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {cards.length} card{cards.length !== 1 ? "s" : ""} ready. Give it a name to save for later.
          </p>
          <Input
            placeholder="e.g. MTMP Spring 2026"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={handleSkipSave}>
              Skip
            </Button>
            <Button onClick={handleSave} disabled={saving || !setName.trim()}>
              {saving ? "Saving…" : "Save & Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
