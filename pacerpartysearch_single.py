#!/usr/bin/env python3
import os, csv, json, time, sys
from datetime import date
from pathlib import Path
import requests

# -------------------- CONFIG --------------------
NG = "Im6mXxlN5jlA4aTNHVxdvOsxEV30ceboaczRuI37yqQuuYKB5746GrVzBGPEFcyfMZU8tSPAKjKTBYcF6gZQL0rPynZaqtSPftwslXRpYEFOJueOxWXaH1WlOb1IzOo9"
FROM_DATE = "2022-10-15"
TO_DATE = date.today().isoformat()
HOST = "pcl.uscourts.gov"            # use "qa-pcl.uscourts.gov" for QA
API_PATH = "/pcl-public-api/rest/parties/find"
PAGE_PAUSE_SEC = 0.2                 # gentle pacing
# -----------------------------------------------------------

def fetch_all_pages(first_name, last_name):
    """Fetch page 0..N (until empty) and return list of full page payloads."""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-NEXT-GEN-CSO": NG,
    }
    base_url = f"https://{HOST}{API_PATH}"
    payload = {
        "lastName": last_name,
        "firstName": first_name,
        "role": ["aty"],  # attorney
        "courtCase": {
            "jurisdictionType": "mdl",        # Multidistrict
            "dateFiledFrom": FROM_DATE,
            "dateFiledTo": TO_DATE,
        }
    }

    pages = []
    page = 0
    while True:
        resp = requests.post(base_url, headers=headers, params={"page": page}, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        content = data.get("content", []) or []
        print(f"Fetched page {page} for {first_name} {last_name}: {len(content)} rows")
        pages.append(data)
        if not content:
            break
        page += 1
        time.sleep(PAGE_PAUSE_SEC)
    return pages

def collect_headers(pages):
    """
    Build a complete set of CSV headers by walking EVERY item in EVERY page:
      - include all top-level keys from each content item
      - include all nested courtCase.* keys (prefixed)
    """
    top_keys = set()
    case_keys = set()
    for page in pages:
        for item in page.get("content", []) or []:
            # top-level keys
            for k in item.keys():
                if k != "courtCase":
                    top_keys.add(k)
            # nested courtCase keys
            cc = item.get("courtCase") or {}
            for ck in cc.keys():
                case_keys.add(ck)

    # Sort keys for stable output
    top_cols = sorted(top_keys)
    case_cols = sorted(case_keys)
    # Put frequently used columns near the front if present
    priority = [
        "courtId","caseId","caseYear","caseNumber","caseOffice","caseType",
        "caseNumberFull","caseTitle","dateFiled","dateTermed",
        "partyType","partyRole","lastName","firstName","middleName","generation",
        "jurisdictionType","natureOfSuit","bankruptcyChapter","disposition",
        "partyId"
    ]
    # Keep priority order then the rest
    def ordered(cols):
        seen = set()
        ordered_list = [c for c in priority if c in cols and not (c in seen or seen.add(c))]
        ordered_list += [c for c in cols if c not in set(priority)]
        return ordered_list

    top_cols = ordered(top_cols)
    # For courtCase, we always prefix with "courtCase."
    case_cols = ordered(case_cols)

    headers = top_cols + [f"courtCase.{c}" for c in case_cols]
    return headers, top_cols, case_cols

def flatten_item(item, top_cols, case_cols):
    """Return a flat dict for CSV: all top-level keys + courtCase.* keys."""
    row = {}
    # top-level
    for k in top_cols:
        row[k] = item.get(k, None)
    # nested
    cc = item.get("courtCase") or {}
    for ck in case_cols:
        row[f"courtCase.{ck}"] = cc.get(ck, None)
    return row

def save_outputs(pages, first_name, last_name, base_dir):
    """Save outputs for a specific person to their subdirectory."""
    base_dir.mkdir(parents=True, exist_ok=True)
    base = f"{last_name}_{first_name}"

    # 1) Save full raw JSON (all pages, including receipt & pageInfo per page)
    raw_json_path = base_dir / f"{base}.json"
    with open(raw_json_path, "w", encoding="utf-8") as f:
        json.dump({"pages": pages}, f, ensure_ascii=False, indent=2)
    print(f"Saved RAW JSON → {raw_json_path}")

    # Check if there are any results
    total_rows = 0
    for page in pages:
        content = page.get("content", []) or []
        total_rows += len(content)
    
    if total_rows == 0:
        print(f"No cases found for {first_name} {last_name}")
        return None

    # 2) Build CSV headers dynamically from ALL content rows across pages
    headers, top_cols, case_cols = collect_headers(pages)

    # 3) Write merged CSV (one row per content item across all pages)
    csv_path = base_dir / f"{base}.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        for page in pages:
            for item in page.get("content", []) or []:
                w.writerow(flatten_item(item, top_cols, case_cols))
    print(f"Saved CSV      → {csv_path} (rows: {total_rows})")
    
    return csv_path

def search_single_person(first_name, last_name):
    """Search for a single person and save results."""
    if not NG or NG.startswith("PASTE_"):
        raise SystemExit("Set NG env var to your nextGenCSO token (e.g., `export NG='...'`).")
    
    # Clean up inputs
    first_name = first_name.strip()
    last_name = last_name.strip()
    
    if not first_name or not last_name:
        raise SystemExit("Both first name and last name are required.")
    
    print(f"\n--- Searching for: {first_name} {last_name} ---")
    
    try:
        # Fetch all pages for this person
        all_pages = fetch_all_pages(first_name, last_name)
        
        # Check if there are any results before creating directory
        total_rows = 0
        for page in all_pages:
            content = page.get("content", []) or []
            total_rows += len(content)
        
        if total_rows == 0:
            print(f"\nNo cases found for {first_name} {last_name}")
            return None
        
        # Create subdirectory for this person
        base_downloads = Path("/Users/sohilbhatia/Downloads/jpml_scraper")
        person_dir = base_downloads / f"{last_name}_{first_name}"
        
        # Save outputs to person's subdirectory
        csv_path = save_outputs(all_pages, first_name, last_name, person_dir)
        
        print(f"\n✓ Completed! Found {total_rows} cases")
        print(f"  CSV: {csv_path}")
        print(f"  JSON: {person_dir / f'{last_name}_{first_name}.json'}")
        
        return csv_path
        
    except Exception as e:
        print(f"Error searching for {first_name} {last_name}: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """Main entry point - accepts command line args or prompts for input."""
    if len(sys.argv) >= 3:
        # Command line arguments provided
        first_name = sys.argv[1]
        last_name = sys.argv[2]
    else:
        # Prompt for input
        print("PACER Party Search - Single Person")
        print("=" * 50)
        first_name = input("Enter first name: ").strip()
        last_name = input("Enter last name: ").strip()
    
    csv_path = search_single_person(first_name, last_name)
    
    if csv_path:
        print(f"\nTo generate a summary, run:")
        print(f"  python mtmp_generate_alg_output_single.py '{csv_path}'")

if __name__ == "__main__":
    main()
