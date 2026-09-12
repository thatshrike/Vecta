import os
import requests
import time

URL = "http://localhost:8000/analyze"
TENDER_FILE = "test_data/bhel/tender_bhel.pdf"

# Format: (filename, expected_verdict_direction)
BIDDERS = [
    ("test_data/bhel/bidder_compliant.pdf", "COMPLIANT"),
    ("test_data/bhel/bidder_noncompliant.pdf", "NON_COMPLIANT"),
    ("test_data/bhel/bidder_ambigous.pdf", "INCONCLUSIVE/MIXED"),
    ("test_data/bhel/bidder_tech_spec.pdf", "MIXED (TS-*)"),
    ("test_data/bhel/bidder_semantic_clear_pass.pdf", "COMPLIANT"),
    ("test_data/bhel/bidder_semantic_clear_fail.pdf", "NON_COMPLIANT"),
    ("test_data/bhel/bidder_semantic_ambiguous.pdf", "INCONCLUSIVE"),
    ("test_data/bhel/bidder_partial_compliant.pdf", "MIXED"),
    ("test_data/bhel/bidder_lakh_format.pdf", "COMPLIANT"),
    ("test_data/bhel/bidder_full_compliant.pdf", "COMPLIANT")
]

print("Waiting for server to start...")
time.sleep(2)

results = []

for bidder_file, expected in BIDDERS:
    if not os.path.exists(bidder_file):
        print(f"Skipping {bidder_file}, file not found")
        continue
    
    print(f"Testing {bidder_file}...")
    try:
        with open(TENDER_FILE, "rb") as t_f, open(bidder_file, "rb") as b_f:
            files = {
                "tender": (TENDER_FILE, t_f, "application/pdf"),
                "bidders": (bidder_file, b_f, "application/pdf")
            }
            resp = requests.post(URL, files=files)
            resp.raise_for_status()
            data = resp.json()[0] # array of 1 report
            
            portal_checks = data.get("portal_checks", [])
            pc_count = len(portal_checks)
            line_items = data.get("line_items", [])
            li_count = len(line_items)
            score = data.get("compliance_score")
            risk = data.get("risk_level")
            
            # Determine overall pass/fail logic based on risk/score/recommendation
            actual_pass = "PASS" if risk == "Low" else "FAIL" if risk == "High" else "REVIEW"
            
            # Check for drift
            drift = []
            if pc_count != 3:
                drift.append(f"Portal checks {pc_count} != 3")
            if li_count < 10:
                drift.append(f"Line items {li_count} < 10")
            if score is None or not isinstance(score, (int, float)):
                drift.append(f"Invalid score: {score}")
            if risk not in ["Low", "Medium", "High"]:
                drift.append(f"Invalid risk: {risk}")
                
            # Naive expectation matching for drift
            if "COMPLIANT" in expected and risk == "High":
                drift.append(f"Expected compliant, got {risk}")
            if "NON_COMPLIANT" in expected and risk == "Low":
                drift.append(f"Expected non-compliant, got {risk}")
                
            notes = ", ".join(drift) if drift else "OK"
            results.append(f"| `{bidder_file}` | {expected} | {score} | {risk} | {pc_count} | {actual_pass} | {notes} |")
    except Exception as e:
        results.append(f"| `{bidder_file}` | {expected} | ERROR | ERROR | ERROR | ERROR | {str(e)} |")

print("\n\n### Regression Test Results\n")
print("| Bidder | Expected | Actual Score | Actual Risk | Portal Checks Present | Pass/Fail | Drift Notes |")
print("|---|---|---|---|---|---|---|")
for r in results:
    print(r)
