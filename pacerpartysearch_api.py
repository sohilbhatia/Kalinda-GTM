#!/usr/bin/env python3
import os, csv, json, time
from datetime import date
from pathlib import Path
import requests

# -------------------- CONFIG --------------------
NG = "FmZQNm4xUDAurFbmmDP2lBlEVqmDIkpAoMWIPweGP3oHHBUJjBwOum5EYw1gL5TRtQ4cFOR7rzMO6JUZrKOrweFktXdfJoAjt7Xngchd5AH7EVWdk92QOI96cwdN4QyT"
FROM_DATE = "2024-01-01"
TO_DATE = date.today().isoformat()
HOST = "pcl.uscourts.gov"            # use "qa-pcl.uscourts.gov" for QA
API_PATH = "/pcl-public-api/rest/parties/find"
PAGE_PAUSE_SEC = 0.2                 # gentle pacing
CSV_FILE = "MTMP Attendee List Spring 2026 - MTMP Attorneys.csv"
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
    """Save outputs for a specific attendee to their subdirectory."""
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

def update_csv_row(row_index, path_value, case_count):
    """Update a specific row in the CSV file with path and case count."""
    csv_path = Path(CSV_FILE)
    
    # Read the CSV
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    # Update the specific row
    if row_index < len(rows):
        rows[row_index]['Path'] = path_value
        rows[row_index]['Number of Cases'] = case_count
    
    # Write back to CSV
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        if rows:
            fieldnames = list(rows[0].keys())
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

def process_attendee_list():
    """Process the MTMP attendee list CSV and create searches for each attendee."""
    if not NG or NG.startswith("PASTE_"):
        raise SystemExit("Set NG env var to your nextGenCSO token (e.g., `export NG='...'`).")
    
    # Read the attendee list CSV
    csv_path = Path(CSV_FILE)
    if not csv_path.exists():
        raise SystemExit(f"CSV file not found: {csv_path}")
    
    # Read all rows from the CSV
    attendees = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            attendees.append(row)
    
    print(f"Found {len(attendees)} attendees to process")
    
    # Create base directory for all outputs
    base_downloads = Path("/Users/sohilbhatia/Downloads/jpml_scraper")
    base_downloads.mkdir(parents=True, exist_ok=True)
    
    # Process each attendee and update CSV after each one
    for i, attendee in enumerate(attendees, 1):
        first_name = attendee.get('First Name', '').strip()
        last_name = attendee.get('Last Name', '').strip()
        
        if not first_name or not last_name:
            print(f"Skipping row {i}: Missing first or last name")
            update_csv_row(i-1, 'NO CASES FOUND', 0)
            continue
        
        print(f"\n--- Processing attendee {i}/{len(attendees)}: {first_name} {last_name} ---")
        
        try:
            # Fetch all pages for this attendee
            all_pages = fetch_all_pages(first_name, last_name)
            
            # Check if there are any results before creating directory
            total_rows = 0
            for page in all_pages:
                content = page.get("content", []) or []
                total_rows += len(content)
            
            if total_rows == 0:
                print(f"No cases found for {first_name} {last_name} - skipping folder creation")
                update_csv_row(i-1, 'NO CASES FOUND', 0)
                continue
            
            # Create subdirectory for this attendee only if there are results
            attendee_dir = base_downloads / f"{last_name}_{first_name}"
            
            # Save outputs to attendee's subdirectory
            csv_path = save_outputs(all_pages, first_name, last_name, attendee_dir)
            path_value = str(csv_path.absolute()) if csv_path else 'NO CASES FOUND'
            
            # Update CSV row immediately
            update_csv_row(i-1, path_value, total_rows)
            
            print(f"Completed processing {first_name} {last_name} - {total_rows} cases")
            
        except Exception as e:
            print(f"Error processing {first_name} {last_name}: {e}")
            update_csv_row(i-1, 'NO CASES FOUND', 0)
    
    print(f"All searches completed!")

if __name__ == "__main__":
    process_attendee_list()
