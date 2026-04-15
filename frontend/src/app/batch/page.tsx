"use client";

import { useState, useCallback } from "react";
import { CSVDropzone } from "@/components/csv-dropzone";
import { ProgressBar } from "@/components/progress-bar";
import { ProspectTable } from "@/components/prospect-table";
import { FirmNameModal } from "@/components/firm-name-modal";
import { PromptConfirmModal } from "@/components/prompt-confirm-modal";
import { ResearchSidebar } from "@/components/research-sidebar";
import { Button } from "@/components/ui/button";
import { searchBatch, researchProspect } from "@/lib/api";
import type { Prospect, SSEEvent } from "@/lib/api";

export default function BatchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; name?: string } | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [csvData, setCsvData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Research state
  const [researchTarget, setResearchTarget] = useState<Prospect | null>(null);
  const [firmModalOpen, setFirmModalOpen] = useState(false);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [firmForResearch, setFirmForResearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchResult, setResearchResult] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!file) return;
    setIsSearching(true);
    setError(null);
    setProspects([]);
    setCsvData(null);

    try {
      await searchBatch(file, (event: SSEEvent) => {
        if (event.type === "progress") {
          setProgress({
            current: event.current || 0,
            total: event.total || 0,
            name: event.name,
          });
        } else if (event.type === "complete") {
          setProspects(event.prospects || []);
          setCsvData(event.csv || null);
          setProgress(null);
        } else if (event.type === "error") {
          setError(event.message || "Unknown error");
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [file]);

  const handleDownload = useCallback(() => {
    if (!csvData) return;
    const blob = new Blob([csvData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kalinda_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [csvData]);

  const handleResearch = useCallback((prospect: Prospect) => {
    setResearchTarget(prospect);
    setResearchResult(null);
    if (!prospect.company) {
      setFirmModalOpen(true);
    } else {
      setFirmForResearch(prospect.company);
      setPromptModalOpen(true);
    }
  }, []);

  const handleFirmConfirm = useCallback(
    (firm: string) => {
      setFirmModalOpen(false);
      setFirmForResearch(firm);
      setPromptModalOpen(true);
    },
    [],
  );

  const handlePromptConfirm = useCallback(
    async (prompt: string) => {
      if (!researchTarget) return;
      setPromptModalOpen(false);
      setSidebarOpen(true);
      setResearchLoading(true);
      setResearchResult(null);

      try {
        const res = await researchProspect(
          researchTarget.firstName,
          researchTarget.lastName,
          firmForResearch,
          prompt,
        );
        setResearchResult(res.result);
      } catch (e) {
        setResearchResult(
          `Error: ${e instanceof Error ? e.message : "Research failed"}`,
        );
      } finally {
        setResearchLoading(false);
      }
    },
    [researchTarget, firmForResearch],
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Batch Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a prospect CSV to search PACER filings for all attendees.
        </p>
      </div>

      <div className="space-y-6">
        <CSVDropzone onFile={setFile} disabled={isSearching} />

        {file && !isSearching && prospects.length === 0 && (
          <div className="flex justify-end">
            <Button onClick={handleSearch}>Search PACER</Button>
          </div>
        )}

        {progress && (
          <ProgressBar
            current={progress.current}
            total={progress.total}
            name={progress.name}
          />
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {prospects.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {prospects.length} prospects processed
              </p>
              {csvData && (
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  Download CSV
                </Button>
              )}
            </div>
            <ProspectTable
              prospects={prospects}
              onResearch={handleResearch}
            />
          </div>
        )}
      </div>

      <FirmNameModal
        open={firmModalOpen}
        prospectName={
          researchTarget
            ? `${researchTarget.firstName} ${researchTarget.lastName}`
            : ""
        }
        onConfirm={handleFirmConfirm}
        onCancel={() => setFirmModalOpen(false)}
      />

      <PromptConfirmModal
        open={promptModalOpen}
        prospectName={
          researchTarget
            ? `${researchTarget.firstName} ${researchTarget.lastName}`
            : ""
        }
        firmName={firmForResearch}
        onConfirm={handlePromptConfirm}
        onCancel={() => setPromptModalOpen(false)}
      />

      <ResearchSidebar
        open={sidebarOpen}
        prospectName={
          researchTarget
            ? `${researchTarget.firstName} ${researchTarget.lastName}`
            : ""
        }
        loading={researchLoading}
        result={researchResult}
        onClose={() => setSidebarOpen(false)}
      />
    </div>
  );
}
