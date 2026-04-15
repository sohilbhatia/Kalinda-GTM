#!/usr/bin/env python3
import os
import csv
from pathlib import Path


MTMP_CSV = "MTMP Attendee List Spring 2026 - MTMP Attorneys.csv"
OUTPUT_CSV = "MTMP Attendee List Spring 2026 - with Alg Output.csv"


def extract_party(case_title: str) -> str:
    lower_title = (case_title or "").lower()
    if "v." in lower_title:
        idx = lower_title.index("v.")
        processed = case_title[idx:]
        if " et al" in processed:
            processed = processed.split(" et al", 1)[0].strip()
        return processed.strip()
    return (case_title or "").strip()


def build_summary_text(input_csv_path: str) -> str:
    # Count filings by (processed_case, caseYear)
    counts = {}  # key: (processed_case, year) -> int
    total_by_year = {}  # key: year -> int

    with open(input_csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            case_title = row.get("caseTitle", "")
            processed_case = extract_party(case_title)
            year_str = row.get("caseYear", "")
            try:
                year = int(year_str)
            except Exception:
                # Skip rows without a valid year
                continue

            key = (processed_case, year)
            counts[key] = counts.get(key, 0) + 1
            total_by_year[year] = total_by_year.get(year, 0) + 1

    # Prepare summary for last three years we care about
    target_years = [2025, 2024, 2023]
    available_years = [y for y in target_years if y in total_by_year]

    lines = []
    lines.append("* Total")
    for y in available_years:
        lines.append(f"   - {y}: {total_by_year.get(y, 0)} filings")

    # Collect distinct case names
    cases = sorted({case for (case, _y) in counts.keys()})
    for case in cases:
        sub = []
        for y in available_years:
            c = counts.get((case, y), 0)
            if c:
                sub.append(f"   - {y}: {c} filings")
        if sub:
            lines.append(f"* {case}")
            lines.extend(sub)

    return "\n".join(lines)


def write_summary_next_to_csv(input_csv_path: str, text: str) -> str:
    folder = os.path.dirname(input_csv_path)
    out_path = os.path.join(folder, "summary.txt")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    return out_path


def main_process_all():
    # Read all rows from the input CSV
    with open(MTMP_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    # Ensure " Alg Output" column exists in fieldnames
    fieldnames = list(rows[0].keys()) if rows else []
    if " Alg Output" not in fieldnames:
        fieldnames.append(" Alg Output")
    
    # Process each row
    for idx, row in enumerate(rows):
        num_cases = (row.get("Number of Cases", "") or "").strip()
        path_val = (row.get("Path", "") or "").strip()

        # Treat any non-zero numeric string as valid
        if num_cases and num_cases != "0" and path_val.lower().endswith(".csv") and os.path.exists(path_val):
            firm = (row.get("Company Name", "") or "").strip()
            first = (row.get("First Name", "") or "").strip()
            last = (row.get("Last Name", "") or "").strip()
            attorney = f"{first} {last}".strip()

            print(f"Processing row {idx+2} → {attorney} at {firm}")  # +2 accounts for header + 1-based rows

            summary_text = build_summary_text(path_val)
            out_path = write_summary_next_to_csv(path_val, summary_text)
            print(f"Wrote summary to {out_path}")

            # Update the row's Alg Output field
            row[" Alg Output"] = summary_text
            print(f"Generated Alg Output for row {idx+2}")
        else:
            # For rows without cases, leave Alg Output empty or as-is
            if " Alg Output" not in row:
                row[" Alg Output"] = ""
    
    # Write all rows to the new output CSV
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"\n✓ All processing complete! Results saved to: {OUTPUT_CSV}")


if __name__ == "__main__":
    main_process_all()


