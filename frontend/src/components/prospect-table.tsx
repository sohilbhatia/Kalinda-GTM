"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Prospect } from "@/lib/api";

interface ProspectTableProps {
  prospects: Prospect[];
  onResearch: (prospect: Prospect) => void;
}

export function ProspectTable({ prospects, onResearch }: ProspectTableProps) {
  if (prospects.length === 0) return null;

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead className="w-[100px] text-right">Cases</TableHead>
            <TableHead className="max-w-[300px]">Summary</TableHead>
            <TableHead className="w-[100px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {prospects.map((p, i) => {
            const cases = parseInt(p.numCases) || 0;
            return (
              <TableRow key={i}>
                <TableCell className="font-medium">
                  {p.firstName} {p.lastName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.company || "--"}
                </TableCell>
                <TableCell className="text-right">
                  {cases > 0 ? (
                    <Badge variant="secondary">{cases}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">0</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[300px]">
                  <p className="truncate text-xs text-muted-foreground">
                    {p.algOutput || "--"}
                  </p>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => onResearch(p)}
                  >
                    Research
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
