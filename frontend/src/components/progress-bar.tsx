"use client";

interface ProgressBarProps {
  current: number;
  total: number;
  name?: string;
}

export function ProgressBar({ current, total, name }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          Processing {current} of {total}
        </span>
        {name && (
          <span className="text-muted-foreground truncate ml-4 max-w-[200px]">
            {name}
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
