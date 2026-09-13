import os
from parser_main import extract_tender_reqs, extract_bidder_claims, evaluate

PASS = "✅"
FAIL = "❌"

def test_tender(tender_name, tender_pdf, bidder_pdf, expected_compliant, expected_missing_reqs):
    print(f"\n==================================================")
    print(f"Testing {tender_name} with {os.path.basename(bidder_pdf)}")
    print(f"==================================================")
    
    reqs = extract_tender_reqs(tender_pdf)
    text, claims, is_scanned = extract_bidder_claims(bidder_pdf)
    results = []
    is_compliant = True
    for req in reqs:
        if req["type"] == "POLICY":
            continue
        claim = claims.get(req["id"])
        res = evaluate(claim, req)
        if not res: continue
        res["id"] = req["id"]
        results.append(res)
        if res.get("status") in ("NON_COMPLIANT", "DOES_NOT_SATISFY", "NOT_FOUND", "INCONCLUSIVE") or res.get("verdict") in ("NOT_FOUND", "DOES_NOT_SATISFY", "INCONCLUSIVE"):
            is_compliant = False
    
    errors = 0
    if is_compliant != expected_compliant:
        print(f"  {FAIL} Expected Compliance: {expected_compliant}, Got: {is_compliant}")
        errors += 1
    else:
        print(f"  {PASS} Compliance exactly matches expected: {expected_compliant}")
        
    for expected_missing in expected_missing_reqs:
        # Check if the missing req is actually flagged as NOT_FOUND or DOES_NOT_SATISFY
        found = False
        for res in results:
            stat = res.get('status') or res.get('verdict')
            if res['id'] == expected_missing and stat in ("NOT_FOUND", "DOES_NOT_SATISFY", "NON_COMPLIANT", "INCONCLUSIVE"):
                found = True
                break
        if not found:
            print(f"  {FAIL} Expected {expected_missing} to fail, but it didn't!")
            errors += 1
        else:
            print(f"  {PASS} {expected_missing} correctly identified as failing.")

    return errors

total_errors = 0

# 1. BHEL Tests
total_errors += test_tender("BHEL", "test_data/bhel/tender_bhel.pdf", "test_data/bhel/bidder_compliant.pdf", False, ["REQ-002"])
total_errors += test_tender("BHEL", "test_data/bhel/tender_bhel.pdf", "test_data/bhel/bidder_missing_pan.pdf", False, ["REQ-002"])

# 2. DRDO Tests
total_errors += test_tender("DRDO", "test_data/drdo/tender_drdo.pdf", "test_data/drdo/drdo_boq_bidder_compliant.pdf", True, [])
total_errors += test_tender("DRDO", "test_data/drdo/tender_drdo.pdf", "test_data/drdo/drdo_boq_bidder_missing_oem.pdf", False, ["REQ-003"])

# 3. IIT Kanpur Tests
total_errors += test_tender("IIT Kanpur", "test_data/iitkanpur/tender_iitkanpur.pdf", "test_data/iitkanpur/iitkanpur_compliant_bidder.pdf", True, [])
total_errors += test_tender("IIT Kanpur", "test_data/iitkanpur/tender_iitkanpur.pdf", "test_data/iitkanpur/iitkanpur_non_compliant_bidder.pdf", False, ["REQ-001"]) # Assuming turnover is less

# 4. Niti Aayog Tests
total_errors += test_tender("Niti Aayog", "test_data/niti_ayog/tender_niti_ayog.pdf", "test_data/niti_ayog/bidder_compliant_niti_ayog.pdf", True, [])
total_errors += test_tender("Niti Aayog", "test_data/niti_ayog/tender_niti_ayog.pdf", "test_data/niti_ayog/bidder_noncompliant_niti_ayog.pdf", False, ["REQ-001"]) # Assuming turnover is less

print("\n" + "="*70)
if total_errors == 0:
    print("ALL ASSERTIONS PASSED")
else:
    print(f"{total_errors} ASSERTION(S) FAILED")
print("="*70)
