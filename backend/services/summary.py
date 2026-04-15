def extract_party(case_title: str) -> str:
    """Extract the defendant party from a case title string."""
    lower_title = (case_title or "").lower()
    if "v." in lower_title:
        idx = lower_title.index("v.")
        processed = case_title[idx:]
        if " et al" in processed:
            processed = processed.split(" et al", 1)[0].strip()
        return processed.strip()
    return (case_title or "").strip()


def build_summary_from_rows(rows: list[dict]) -> str:
    """Build a filing summary from in-memory row dicts (with caseTitle and caseYear keys)."""
    counts: dict[tuple[str, int], int] = {}
    total_by_year: dict[int, int] = {}

    for row in rows:
        case_title = row.get("caseTitle", "") or row.get("courtCase.caseTitle", "")
        processed_case = extract_party(case_title)
        year_str = row.get("caseYear", "") or row.get("courtCase.caseYear", "")
        try:
            year = int(year_str)
        except (ValueError, TypeError):
            continue

        key = (processed_case, year)
        counts[key] = counts.get(key, 0) + 1
        total_by_year[year] = total_by_year.get(year, 0) + 1

    target_years = [2026, 2025, 2024, 2023]
    available_years = [y for y in target_years if y in total_by_year]

    lines: list[str] = ["* Total"]
    for y in available_years:
        lines.append(f"   - {y}: {total_by_year.get(y, 0)} filings")

    cases = sorted({case for (case, _) in counts.keys()})
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
