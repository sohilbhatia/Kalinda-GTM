"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  getPromptTemplate,
  savePromptTemplate,
  resetPromptTemplate,
  DEFAULT_PROMPT_TEMPLATE,
} from "@/lib/prompt-template";

interface PromptTemplateEditorProps {
  onTemplateChange?: (template: string) => void;
}

export function PromptTemplateEditor({ onTemplateChange }: PromptTemplateEditorProps) {
  const [template, setTemplate] = useState(DEFAULT_PROMPT_TEMPLATE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTemplate(getPromptTemplate());
  }, []);

  const handleSave = () => {
    savePromptTemplate(template);
    onTemplateChange?.(template);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    resetPromptTemplate();
    setTemplate(DEFAULT_PROMPT_TEMPLATE);
    onTemplateChange?.(DEFAULT_PROMPT_TEMPLATE);
  };

  const isDefault = template === DEFAULT_PROMPT_TEMPLATE;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Prompt Template</h3>
          <p className="text-xs text-muted-foreground">
            Use <code className="rounded bg-muted px-1 text-[10px]">{"{name}"}</code> and{" "}
            <code className="rounded bg-muted px-1 text-[10px]">{"{firm}"}</code> as placeholders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isDefault && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={handleReset}>
              Reset
            </Button>
          )}
          <Button size="sm" className="text-xs" onClick={handleSave}>
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>
      <Textarea
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        rows={5}
        className="text-sm"
      />
    </div>
  );
}
