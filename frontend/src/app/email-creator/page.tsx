"use client";

import { useState, useCallback, useEffect } from "react";
import { CSVDropzone } from "@/components/csv-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getTemplate,
  saveTemplate,
  resetTemplate,
  fillTemplate,
  DEFAULT_TEMPLATES,
  TEMPLATE_KEYS,
} from "@/lib/email-templates";
import type { TemplateKey } from "@/lib/email-templates";
import { generateMsg, downloadMsg } from "@/lib/msg";

type Mode = "pi" | "mt";
type PIVariant = "noPickUp" | "callBack";

interface EmailRow {
  _index: number;
  firstName: string;
  email: string;
  personalization: string;
  massTort: string;
  _variant: PIVariant;
}

function parseCSV(text: string): EmailRow[] {
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
  const emailIdx = headers.findIndex((h) => /work\s*email|email/.test(h));
  const persIdx = headers.findIndex((h) => /personalization/.test(h));
  const mtIdx = headers.findIndex((h) => /mass\s*tort/.test(h));

  return lines.slice(1).map((line, i) => {
    const cols = parseRow(line);
    return {
      _index: i,
      firstName: firstIdx >= 0 ? cols[firstIdx] || "" : "",
      email: emailIdx >= 0 ? cols[emailIdx] || "" : "",
      personalization: persIdx >= 0 ? cols[persIdx] || "" : "",
      massTort: mtIdx >= 0 ? cols[mtIdx] || "" : "",
      _variant: "noPickUp" as PIVariant,
    };
  }).filter((r) => r.firstName);
}

export default function EmailCreatorPage() {
  const [mode, setMode] = useState<Mode>("pi");
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [subject, setSubject] = useState("Question for MTMP");

  // Template editing state
  const [tplNoPickUp, setTplNoPickUp] = useState("");
  const [tplCallBack, setTplCallBack] = useState("");
  const [tplMassTort, setTplMassTort] = useState("");
  const [savedFlag, setSavedFlag] = useState<string | null>(null);

  useEffect(() => {
    setTplNoPickUp(getTemplate(TEMPLATE_KEYS.noPickUp));
    setTplCallBack(getTemplate(TEMPLATE_KEYS.callBack));
    setTplMassTort(getTemplate(TEMPLATE_KEYS.massTort));
  }, []);

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRows(parseCSV(text));
    };
    reader.readAsText(file);
  }, []);

  const setVariant = useCallback((index: number, variant: PIVariant) => {
    setRows((prev) =>
      prev.map((r) => (r._index === index ? { ...r, _variant: variant } : r)),
    );
  }, []);

  const handleSaveTemplate = useCallback(
    (key: TemplateKey, value: string) => {
      saveTemplate(key, value);
      setSavedFlag(key);
      setTimeout(() => setSavedFlag(null), 1500);
    },
    [],
  );

  const handleResetTemplate = useCallback(
    (key: TemplateKey) => {
      resetTemplate(key);
      const def = DEFAULT_TEMPLATES[key];
      if (key === "noPickUp") setTplNoPickUp(def);
      else if (key === "callBack") setTplCallBack(def);
      else setTplMassTort(def);
    },
    [],
  );

  const handleDownload = useCallback(
    (row: EmailRow) => {
      let templateKey: TemplateKey;
      if (mode === "pi") {
        templateKey = row._variant;
      } else {
        templateKey = TEMPLATE_KEYS.massTort;
      }

      const template =
        templateKey === "noPickUp"
          ? tplNoPickUp
          : templateKey === "callBack"
            ? tplCallBack
            : tplMassTort;

      const body = fillTemplate(template, {
        firstName: row.firstName,
        personalization: row.personalization,
        massTort: row.massTort,
      });

      const msg = generateMsg({
        to: row.email,
        subject,
        body,
      });

      const safeName = row.firstName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      downloadMsg(`${safeName}_email.eml`, msg);
    },
    [mode, subject, tplNoPickUp, tplCallBack, tplMassTort],
  );

  const piTemplateEditor = (
    key: TemplateKey,
    label: string,
    value: string,
    setter: (v: string) => void,
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{label}</h4>
        <div className="flex items-center gap-2">
          {value !== DEFAULT_TEMPLATES[key] && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleResetTemplate(key)}
            >
              Reset
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleSaveTemplate(key, value)}
          >
            {savedFlag === key ? "Saved" : "Save"}
          </Button>
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(e) => setter(e.target.value)}
        rows={12}
        className="text-xs font-mono"
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Email Creator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV and generate ready-to-send .eml files for each prospect.
        </p>
      </div>

      <div className="space-y-6">
        {/* Mode toggle */}
        <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setRows([]); }}>
          <TabsList>
            <TabsTrigger value="pi">Personal Injury</TabsTrigger>
            <TabsTrigger value="mt">Mass Tort</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Subject line */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Subject Line</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject line"
          />
        </div>

        {/* Template editors */}
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="text-sm font-semibold">
            Email Templates
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Use {"{firstName}"}, {"{personalization}"}
              {mode === "mt" && <>, {"{massTort}"}</>} as placeholders
            </span>
          </h3>

          {mode === "pi" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {piTemplateEditor(
                TEMPLATE_KEYS.noPickUp,
                "No Pick Up",
                tplNoPickUp,
                setTplNoPickUp,
              )}
              {piTemplateEditor(
                TEMPLATE_KEYS.callBack,
                "Call Back",
                tplCallBack,
                setTplCallBack,
              )}
            </div>
          ) : (
            piTemplateEditor(
              TEMPLATE_KEYS.massTort,
              "Mass Tort",
              tplMassTort,
              setTplMassTort,
            )
          )}
        </div>

        {/* CSV upload */}
        {rows.length === 0 && (
          <CSVDropzone onFile={handleFile} disabled={false} />
        )}

        {/* Row table */}
        {rows.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {rows.length} row{rows.length !== 1 ? "s" : ""} loaded
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRows([])}
              >
                Clear CSV
              </Button>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="max-w-[250px]">Personalization</TableHead>
                    {mode === "mt" && <TableHead>Mass Tort</TableHead>}
                    {mode === "pi" && (
                      <TableHead className="w-[160px]">Template</TableHead>
                    )}
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row._index}>
                      <TableCell className="font-medium">
                        {row.firstName}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.email}
                      </TableCell>
                      <TableCell className="max-w-[250px]">
                        <p className="truncate text-xs text-muted-foreground">
                          {row.personalization || "--"}
                        </p>
                      </TableCell>
                      {mode === "mt" && (
                        <TableCell className="text-sm">
                          {row.massTort || "--"}
                        </TableCell>
                      )}
                      {mode === "pi" && (
                        <TableCell>
                          <Select
                            value={row._variant}
                            onValueChange={(v) =>
                              setVariant(row._index, v as PIVariant)
                            }
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="noPickUp">No Pick Up</SelectItem>
                              <SelectItem value="callBack">Call Back</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleDownload(row)}
                        >
                            .eml
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
