const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Prospect {
  firstName: string;
  lastName: string;
  company: string;
  numCases: string;
  algOutput: string;
}

export interface SingleSearchResult {
  firstName: string;
  lastName: string;
  numCases: number;
  summary: string;
  cases: Record<string, unknown>[];
}

export interface ResearchResult {
  result: string;
  promptUsed: string;
}

export interface SSEEvent {
  type: "progress" | "complete" | "error";
  current?: number;
  total?: number;
  name?: string;
  csv?: string;
  prospects?: Prospect[];
  message?: string;
}

export interface BatchResearchSSEEvent {
  type: "row_complete" | "complete" | "error";
  index?: number;
  total?: number;
  completed?: number;
  result?: ResearchRow;
  message?: string;
}

export interface ResearchRow {
  firstName: string;
  lastName: string;
  company: string;
  research: string;
  status?: string;
}

export interface CSVRow {
  firstName: string;
  lastName: string;
  company: string;
}

export async function searchSingle(firstName: string, lastName: string): Promise<SingleSearchResult> {
  const resp = await fetch(`${API_BASE}/api/search/single`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName, lastName }),
  });
  if (!resp.ok) throw new Error(`Search failed: ${resp.statusText}`);
  return resp.json();
}

export async function searchBatch(
  file: File,
  onProgress: (event: SSEEvent) => void,
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  const resp = await fetch(`${API_BASE}/api/search/batch`, {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) throw new Error(`Batch search failed: ${resp.statusText}`);
  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        try {
          const data = JSON.parse(trimmed.slice(6));
          onProgress(data);
        } catch {
          // skip malformed events
        }
      }
    }
  }
}

export async function researchBatch(
  rows: CSVRow[],
  promptTemplate: string,
  onEvent: (event: BatchResearchSSEEvent) => void,
): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/research/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rows: rows.map((r) => ({
        firstName: r.firstName,
        lastName: r.lastName,
        company: r.company,
      })),
      promptTemplate,
    }),
  });

  if (!resp.ok) throw new Error(`Batch research failed: ${resp.statusText}`);
  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        try {
          const data = JSON.parse(trimmed.slice(6));
          onEvent(data);
        } catch {
          // skip malformed events
        }
      }
    }
  }
}

export interface ImageSearchResult {
  firstName: string;
  lastName: string;
  company: string;
  imageUrl: string;
  status?: string;
}

export interface ImageSSEEvent {
  type: "row_complete" | "complete" | "error";
  index?: number;
  total?: number;
  completed?: number;
  result?: ImageSearchResult;
  message?: string;
}

export async function searchImages(
  rows: CSVRow[],
  onEvent: (event: ImageSSEEvent) => void,
): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/research/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });

  if (!resp.ok) throw new Error(`Image search failed: ${resp.statusText}`);
  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        try {
          const data = JSON.parse(trimmed.slice(6));
          onEvent(data);
        } catch {
          // skip malformed events
        }
      }
    }
  }
}

export async function researchProspect(
  firstName: string,
  lastName: string,
  firmName: string,
  customPrompt?: string,
  prospectId?: string,
): Promise<ResearchResult> {
  const resp = await fetch(`${API_BASE}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName,
      lastName,
      firmName,
      prospectId: prospectId || undefined,
      customPrompt: customPrompt || undefined,
    }),
  });
  if (!resp.ok) throw new Error(`Research failed: ${resp.statusText}`);
  return resp.json();
}
