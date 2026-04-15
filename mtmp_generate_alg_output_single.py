#!/usr/bin/env python3
import os
import csv
import sys
from pathlib import Path


def extract_party(case_title: str) -> str:
    """Extract the defendant party from case title."""
    lower_title = (case_title or "").lower()
    if "v." in lower_title:
        idx = lower_title.index("v.")
        processed = case_title[idx:]
        if " et al" in processed:
            processed = processed.split(" et al", 1)[0].strip()
        return processed.strip()
    return (case_title or "").strip()


def build_summary_text(input_csv_path: str) -> str:
    """Build a summary of filings by year and case."""
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
    """Write summary text file next to the input CSV."""
    folder = os.path.dirname(input_csv_path)
    out_path = os.path.join(folder, "summary.txt")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    return out_path


def generate_summary_for_csv(csv_path: str):
    """Generate a summary for a single CSV file."""
    csv_path = Path(csv_path)
    
    if not csv_path.exists():
        raise SystemExit(f"CSV file not found: {csv_path}")
    
    if not csv_path.suffix.lower() == '.csv':
        raise SystemExit(f"File must be a CSV: {csv_path}")
    
    print(f"Processing: {csv_path.name}")
    
    # Build the summary
    summary_text = build_summary_text(str(csv_path))
    
    # Write summary to file
    summary_path = write_summary_next_to_csv(str(csv_path), summary_text)
    
    print(f"\n✓ Summary generated!")
    print(f"  Output: {summary_path}")
    print(f"\n{'-' * 50}")
    print(summary_text)
    print(f"{'-' * 50}")
    
    return summary_path


def main():
    """Main entry point - accepts CSV path as argument or prompts for input."""
    if len(sys.argv) >= 2:
        # Command line argument provided
        csv_path = sys.argv[1]
    else:
        # Prompt for input
        print("PACER Summary Generator - Single CSV")
        print("=" * 50)
        csv_path = input("Enter path to CSV file: ").strip()
        
        # Remove quotes if user copy-pasted a path with quotes
        if csv_path.startswith('"') and csv_path.endswith('"'):
            csv_path = csv_path[1:-1]
        if csv_path.startswith("'") and csv_path.endswith("'"):
            csv_path = csv_path[1:-1]
    
    generate_summary_for_csv(csv_path)


if __name__ == "__main__":
    main()
