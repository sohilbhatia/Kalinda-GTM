"use client";

import { useState, useCallback, useRef } from "react";
import { CSVDropzone } from "@/components/csv-dropzone";
import { ProgressBar } from "@/components/progress-bar";
import { PromptTemplateEditor } from "@/components/prompt-template-editor";
import { ResearchSidebar } from "@/components/research-sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { researchBatch } from "@/lib/api";
import { getPromptTemplate } from "@/lib/prompt-template";
import type { BatchResearchSSEEvent, CSVRow, ResearchRow } from "@/lib/api";

type RowStatus = "idle" | "pending" | "running" | "done" | "error";

interface DisplayRow extends CSVRow {
  _index: number;
  _selected: boolean;
  _status: RowStatus;
  _research: string | null;
}

function parseCSV(text: string): CSVRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());

  const firstIdx = headers.findIndex((h) => /first\s*name/i.test(h));
  const lastIdx = headers.findIndex((h) => /last\s*name/i.test(h));
  const companyIdx = headers.findIndex((h) => /company\s*name|firm/i.test(h));

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    return {
      firstName: firstIdx >= 0 ? cols[firstIdx] || "" : "",
      lastName: lastIdx >= 0 ? cols[lastIdx] || "" : "",
      company: companyIdx >= 0 ? cols[companyIdx] || "" : "",
    };
  }).filter((r) => r.firstName || r.lastName);
}

export default function BatchResearchPage() {
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarIdx, setSidebarIdx] = useState<number | null>(null);

  const rowsRef = useRef<DisplayRow[]>([]);

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      const display: DisplayRow[] = parsed.map((r, i) => ({
        ...r,
        _index: i,
        _selected: false,
        _status: "idle" as RowStatus,
        _research: null,
      }));
      setRows(display);
      rowsRef.current = display;
      setCompleted(0);
      setTotal(0);
      setError(null);
    };
    reader.readAsText(file);
  }, []);

  const toggleRow = useCallback((index: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r._index === index ? { ...r, _selected: !r._selected } : r,
      ),
    );
  }, []);

  const toggleAll = useCallback(() => {
    setRows((prev) => {
      const allSelected = prev.every((r) => r._selected);
      return prev.map((r) => ({ ...r, _selected: !allSelected }));
    });
  }, []);

  const selectedCount = rows.filter((r) => r._selected).length;

  const handleRun = useCallback(async () => {
    const selected = rows.filter((r) => r._selected);
    if (selected.length === 0) return;

    setIsRunning(true);
    setError(null);
    setCompleted(0);
    setTotal(selected.length);

    setRows((prev) =>
      prev.map((r) =>
        r._selected ? { ...r, _status: "pending", _research: null } : r,
      ),
    );
    rowsRef.current = rows.map((r) =>
      r._selected ? { ...r, _status: "pending", _research: null } : r,
    );

    const template = getPromptTemplate();
    const selectedRows = selected.map((r) => ({
      firstName: r.firstName,
      lastName: r.lastName,
      company: r.company,
    }));

    const indexMap = selected.map((r) => r._index);

    try {
      await researchBatch(selectedRows, template, (event: BatchResearchSSEEvent) => {
        if (event.type === "row_complete" && event.result != null && event.index != null) {
          const originalIdx = indexMap[event.index];
          const result = event.result as ResearchRow;

          setRows((prev) =>
            prev.map((r) =>
              r._index === originalIdx
                ? {
                    ...r,
                    _status: (result.status === "error" ? "error" : "done") as RowStatus,
                    _research: result.research,
                  }
                : r,
            ),
          );
          setCompleted(event.completed || 0);
        } else if (event.type === "complete") {
          setIsRunning(false);
        } else if (event.type === "error") {
          setError(event.message || "Unknown error");
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch research failed");
    } finally {
      setIsRunning(false);
    }
  }, [rows]);

  const handleRowClick = useCallback((row: DisplayRow) => {
    setSidebarIdx(row._index);
    setSidebarOpen(true);
  }, []);

  const sidebarRow = sidebarIdx !== null ? rows.find((r) => r._index === sidebarIdx) : null;

  const handleDownload = useCallback(() => {
    const doneRows = rows.filter((r) => r._status === "done" && r._research);
    if (doneRows.length === 0) return;
    const headers = ["First Name", "Last Name", "Company Name", "Research"];
    const csvRows = doneRows.map((r) => [
      r.firstName,
      r.lastName,
      r.company,
      `"${(r._research || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      headers.join(",") + "\n" + csvRows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kalinda_research_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  const handleDeleteSelected = useCallback(() => {
    setRows((prev) => {
      const kept = prev.filter((r) => !r._selected);
      // If the open sidebar row was deleted, close it
      if (sidebarIdx !== null && !kept.find((r) => r._index === sidebarIdx)) {
        setSidebarOpen(false);
        setSidebarIdx(null);
      }
      return kept;
    });
  }, [sidebarIdx]);

  const doneCount = rows.filter((r) => r._status === "done").length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Batch Research</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV, select the rows you want to research, then run.
        </p>
      </div>

      <div className="space-y-6">
        <PromptTemplateEditor />

        {rows.length === 0 && (
          <CSVDropzone onFile={handleFile} disabled={isRunning} />
        )}

        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  {rows.length} row{rows.length !== 1 ? "s" : ""} loaded
                </p>
                {selectedCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedCount} selected
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedCount > 0 && !isRunning && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleDeleteSelected}
                  >
                    Delete {selectedCount} row{selectedCount !== 1 ? "s" : ""}
                  </Button>
                )}
                {doneCount > 0 && (
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    Download CSV
                  </Button>
                )}
                <Button
                  onClick={handleRun}
                  disabled={selectedCount === 0 || isRunning}
                  size="sm"
                >
                  {isRunning
                    ? `Researching…`
                    : `Research ${selectedCount} Row${selectedCount !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </div>

            {isRunning && total > 0 && (
              <ProgressBar current={completed} total={total} name="Running research…" />
            )}

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px] px-3">
                      <Checkbox
                        checked={rows.length > 0 && rows.every((r) => r._selected)}
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row._index}
                      className={`cursor-pointer transition-colors ${
                        sidebarIdx === row._index
                          ? "bg-accent"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => handleRowClick(row)}
                    >
                      <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={row._selected}
                          onCheckedChange={() => toggleRow(row._index)}
                          disabled={isRunning && row._status !== "idle"}
                          aria-label={`Select ${row.firstName} ${row.lastName}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.firstName} {row.lastName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.company || "--"}
                      </TableCell>
                      <TableCell>
                        {row._status === "idle" && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {row._status === "pending" && (
                          <Badge variant="outline" className="text-xs">
                            Queued
                          </Badge>
                        )}
                        {row._status === "running" && (
                          <Badge variant="outline" className="text-xs animate-pulse">
                            Running
                          </Badge>
                        )}
                        {row._status === "done" && (
                          <Badge variant="secondary" className="text-xs">
                            Done
                          </Badge>
                        )}
                        {row._status === "error" && (
                          <Badge variant="destructive" className="text-xs">
                            Error
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      <ResearchSidebar
        open={sidebarOpen}
        prospectName={
          sidebarRow ? `${sidebarRow.firstName} ${sidebarRow.lastName}` : ""
        }
        loading={
          sidebarRow?._status === "pending" || sidebarRow?._status === "running"
        }
        result={sidebarRow?._research ?? null}
        onClose={() => {
          setSidebarOpen(false);
          setSidebarIdx(null);
        }}
      />
    </div>
  );
}
