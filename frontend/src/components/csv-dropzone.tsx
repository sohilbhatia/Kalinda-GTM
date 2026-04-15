"use client";

import { useCallback, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface CSVDropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function CSVDropzone({ onFile, disabled }: CSVDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      onFile(file);
    },
    [onFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) handleFile(file);
    },
    [disabled, handleFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-all",
        isDragging
          ? "border-foreground/40 bg-muted/60"
          : "border-border hover:border-foreground/20 hover:bg-muted/30",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <svg
        className="mb-3 h-8 w-8 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>

      {fileName ? (
        <p className="text-sm font-medium">{fileName}</p>
      ) : (
        <>
          <p className="text-sm font-medium">
            Drop a CSV file here, or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Expects columns: First Name, Last Name, Company Name
          </p>
        </>
      )}
    </div>
  );
}
