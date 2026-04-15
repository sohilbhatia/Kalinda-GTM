"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getPromptTemplate, fillPromptTemplate } from "@/lib/prompt-template";

interface PromptConfirmModalProps {
  open: boolean;
  prospectName: string;
  firmName: string;
  onConfirm: (prompt: string) => void;
  onCancel: () => void;
}

export function PromptConfirmModal({
  open,
  prospectName,
  firmName,
  onConfirm,
  onCancel,
}: PromptConfirmModalProps) {
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (open && prospectName && firmName) {
      const template = getPromptTemplate();
      setPrompt(fillPromptTemplate(template, prospectName, firmName));
    }
  }, [open, prospectName, firmName]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Confirm Research Prompt</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Review the prompt below before sending to OpenAI. You can edit it if needed.
        </p>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={8}
          className="text-sm"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(prompt)}>Run Research</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
