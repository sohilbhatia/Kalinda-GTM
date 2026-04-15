"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FirmNameModal } from "@/components/firm-name-modal";
import { PromptConfirmModal } from "@/components/prompt-confirm-modal";
import { ResearchSidebar } from "@/components/research-sidebar";
import { searchSingle, researchProspect } from "@/lib/api";
import type { SingleSearchResult } from "@/lib/api";

export default function SinglePage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SingleSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Research state
  const [firmModalOpen, setFirmModalOpen] = useState(false);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [firmForResearch, setFirmForResearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchResult, setResearchResult] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      const res = await searchSingle(firstName.trim(), lastName.trim());
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [firstName, lastName]);

  const handleResearchClick = useCallback(() => {
    setResearchResult(null);
    setFirmModalOpen(true);
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
      if (!result) return;
      setPromptModalOpen(false);
      setSidebarOpen(true);
      setResearchLoading(true);
      setResearchResult(null);

      try {
        const res = await researchProspect(
          result.firstName,
          result.lastName,
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
    [result, firmForResearch],
  );

  const prospectName = result
    ? `${result.firstName} ${result.lastName}`
    : `${firstName} ${lastName}`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Single Search
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Look up PACER MDL filings for one attorney.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              First Name
            </label>
            <Input
              placeholder="John"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Last Name
            </label>
            <Input
              placeholder="Smith"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={!firstName.trim() || !lastName.trim() || isSearching}
          >
            {isSearching ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Searching
              </span>
            ) : (
              "Search"
            )}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="flex items-start justify-between rounded-lg border p-5">
              <div>
                <h2 className="text-lg font-semibold">
                  {result.firstName} {result.lastName}
                </h2>
                <div className="mt-2 flex items-center gap-3">
                  <Badge variant="secondary">
                    {result.numCases} case{result.numCases !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResearchClick}
              >
                Research
              </Button>
            </div>

            {result.summary && (
              <div className="rounded-lg border p-5">
                <h3 className="mb-3 text-sm font-semibold">Filing Summary</h3>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {result.summary}
                </pre>
              </div>
            )}

            {result.cases.length > 0 && (
              <div className="rounded-lg border p-5">
                <h3 className="mb-3 text-sm font-semibold">
                  Case Details ({result.cases.length})
                </h3>
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        {["caseTitle", "caseYear", "dateFiled", "courtCase.jurisdictionType"].map(
                          (col) => (
                            <th
                              key={col}
                              className="px-2 py-2 text-left font-medium text-muted-foreground"
                            >
                              {col.replace("courtCase.", "")}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {result.cases.map((c, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="max-w-[250px] truncate px-2 py-1.5">
                            {String(c.caseTitle || c["courtCase.caseTitle"] || "--")}
                          </td>
                          <td className="px-2 py-1.5">
                            {String(c.caseYear || c["courtCase.caseYear"] || "--")}
                          </td>
                          <td className="px-2 py-1.5">
                            {String(c.dateFiled || c["courtCase.dateFiled"] || "--")}
                          </td>
                          <td className="px-2 py-1.5">
                            {String(c["courtCase.jurisdictionType"] || c.jurisdictionType || "--")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <FirmNameModal
        open={firmModalOpen}
        prospectName={prospectName}
        onConfirm={handleFirmConfirm}
        onCancel={() => setFirmModalOpen(false)}
      />

      <PromptConfirmModal
        open={promptModalOpen}
        prospectName={prospectName}
        firmName={firmForResearch}
        onConfirm={handlePromptConfirm}
        onCancel={() => setPromptModalOpen(false)}
      />

      <ResearchSidebar
        open={sidebarOpen}
        prospectName={prospectName}
        loading={researchLoading}
        result={researchResult}
        onClose={() => setSidebarOpen(false)}
      />
    </div>
  );
}
