"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface FirmNameModalProps {
  open: boolean;
  prospectName: string;
  onConfirm: (firmName: string) => void;
  onCancel: () => void;
}

export function FirmNameModal({
  open,
  prospectName,
  onConfirm,
  onCancel,
}: FirmNameModalProps) {
  const [firm, setFirm] = useState("");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter Firm Name</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          No company on file for <span className="font-medium text-foreground">{prospectName}</span>.
          Enter their firm name to proceed with research.
        </p>
        <Input
          placeholder="e.g. Morgan & Morgan"
          value={firm}
          onChange={(e) => setFirm(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && firm.trim()) onConfirm(firm.trim());
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => firm.trim() && onConfirm(firm.trim())}
            disabled={!firm.trim()}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
