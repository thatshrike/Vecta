import pymupdf
import json
import re
import sys

# Ensure stdout uses UTF-8 to prevent crashing on rupee symbols or Hindi characters on Windows
sys.stdout.reconfigure(encoding='utf-8')

def extract_tender_reqs(pdf_path):
    reqs = []
    try:
        doc = pymupdf.open(pdf_path)
        for i, page in enumerate(doc):
            text = page.get_text()
            
            # REQ-001: Bidder Turnover
            match_req1 = re.search(r"Minimum Average Annual Turnover of the\s+bidder\s*\(For 3 Years\)\s+([\d.]+)\s+Lakh", text, re.IGNORECASE | re.MULTILINE)
            if match_req1 and not any(r['id'] == 'REQ-001' for r in reqs):
                reqs.append({
                    "id": "REQ-001",
                    "type": "NUMERIC",
                    "field": "bidder_avg_annual_turnover",
                    "operator": ">=",
                    "value": { "min": float(match_req1.group(1)), "unit": "lakh" },
                    "evidence": { "document": pdf_path, "page": i + 1, "text": match_req1.group(0).strip() },
                    "confidence": 1.0
                })

            # REQ-002: OEM Turnover
            match_req2 = re.search(r"OEM Average Turnover \(Last 3 Years\)\s+([\d.]+)\s+Lakh", text, re.IGNORECASE | re.MULTILINE)
            if match_req2 and not any(r['id'] == 'REQ-002' for r in reqs):
                reqs.append({
                    "id": "REQ-002",
                    "type": "NUMERIC",
                    "field": "oem_avg_annual_turnover",
                    "operator": ">=",
                    "value": { "min": float(match_req2.group(1)), "unit": "lakh" },
                    "evidence": { "document": pdf_path, "page": i + 1, "text": match_req2.group(0).strip() },
                    "confidence": 1.0
                })

            # REQ-003 & REQ-004: Document Present
            list_match = re.search(r"Document required[^\n]*\n*from seller\s*(.*?)\n\*In case", text, re.IGNORECASE | re.DOTALL)
            if list_match:
                full_list_text = list_match.group(1).replace('\n', ' ').strip()
                
                # REQ-003: OEM Authorization Certificate
                if not any(r['id'] == 'REQ-003' for r in reqs) and re.search(r"OEM Authorization\s*Certificate", full_list_text, re.IGNORECASE):
                    reqs.append({
                        "id": "REQ-003",
                        "type": "DOCUMENT_PRESENT",
                        "field": "oem_authorization_certificate",
                        "required": True,
                        "evidence": { "document": pdf_path, "page": i + 1, "text": full_list_text },
                        "confidence": 1.0
                    })

                # REQ-004: Bidder Turnover
                if not any(r['id'] == 'REQ-004' for r in reqs) and re.search(r"Bidder Turnover", full_list_text, re.IGNORECASE):
                    reqs.append({
                        "id": "REQ-004",
                        "type": "DOCUMENT_PRESENT",
                        "field": "bidder_turnover_document",
                        "required": True,
                        "evidence": { "document": pdf_path, "page": i + 1, "text": full_list_text },
                        "confidence": 1.0
                    })

    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
    return reqs

def parse_unit_value(prefix, num_str, suffix):
    """Shared helper function to parse unit/scale (lakh/crore/rupee)."""
    try:
        val = float(num_str.replace(",", ""))
        
        if suffix:
            suffix = suffix.lower()
            if suffix.startswith('lakh') or suffix.startswith('lac'):
                return val
            elif suffix.startswith('crore') or suffix.startswith('cr'):
                return val * 100.0
        else:
            # Raw rupee format
            if prefix or "," in num_str or val >= 10000:
                return val / 100000.0
    except ValueError:
        pass
    return None

def extract_bidder_claims(pdf_path):
    raw_text_full = ""
    claims = {}
    try:
        doc = pymupdf.open(pdf_path)
        for i, page in enumerate(doc):
            text = page.get_text()
            raw_text_full += f"--- Page {i+1} ---\n{text}\n"
            
            # REQ-001 claim: Bidder turnover
            if 'REQ-001' not in claims:
                match1 = re.search(r"Average Annual Turnover[^\n:]*:\s*(Rs\.?)?\s*([\d,.]+)\s*(Lakh|Lac|Crores?|Cr)?", text, re.IGNORECASE)
                if match1:
                    val_lakh = parse_unit_value(match1.group(1), match1.group(2), match1.group(3))
                    if val_lakh is not None:
                        claims['REQ-001'] = {
                            "value": val_lakh,
                            "unit": "lakh",
                            "evidence": { "document": pdf_path, "page": i + 1, "text": match1.group(0).strip() }
                        }

            # REQ-002 claim: OEM turnover
            if 'REQ-002' not in claims:
                match2 = re.search(r"OEM Average Turnover[^\n:]*:\s*(Rs\.?)?\s*([\d,.]+)\s*(Lakh|Lac|Crores?|Cr)?", text, re.IGNORECASE)
                if match2:
                    val_lakh = parse_unit_value(match2.group(1), match2.group(2), match2.group(3))
                    if val_lakh is not None:
                        claims['REQ-002'] = {
                            "value": val_lakh,
                            "unit": "lakh",
                            "evidence": { "document": pdf_path, "page": i + 1, "text": match2.group(0).strip() }
                        }

            # REQ-003 claim: OEM Authorization Certificate
            if 'REQ-003' not in claims:
                # Look for mentions of "OEM Authorization Certificate" and cues like "attached", "enclosed", "annexure"
                match3 = re.search(r"(?:attached|enclosed|annexure|provided)?[^\n]*OEM Authorization\s*Certificate[^\n]*(?:attached|enclosed|annexure|provided)?", text, re.IGNORECASE)
                if match3:
                    # Make sure it actually contains a positive cue in the match or surrounding sentence
                    if re.search(r"(attached|enclosed|annexure|provided)", match3.group(0), re.IGNORECASE):
                        claims['REQ-003'] = {
                            "present": True,
                            "evidence": { "document": pdf_path, "page": i + 1, "text": match3.group(0).strip() }
                        }

    except Exception as e:
        raw_text_full += f"Error: {e}\n"
        
    return raw_text_full, claims

def evaluate(claim, req):
    if not claim:
        if req["type"] == "NUMERIC":
            return {
                "status": "INCONCLUSIVE",
                "requires_human_review": True,
                "review_reason": f"No quantified figure found for {req['field']}."
            }
        elif req["type"] == "DOCUMENT_PRESENT":
            field_name_formatted = req['field'].replace('_', ' ').title() if req['field'] != 'oem_authorization_certificate' else 'OEM Authorization Certificate'
            return {
                "requirement_id": req["id"],
                "verdict": "NON_COMPLIANT",
                "reason": f"Required document '{field_name_formatted}' was not found in the bidder's submission.",
                "requires_human_review": True,
                "review_reason": "Keyword-based absence detection may miss differently-worded attachment references (e.g. 'Authorization letter from OEM enclosed'). Recommend manual confirmation before final rejection."
            }
    
    if req["type"] == "NUMERIC":
        if claim["value"] >= req["value"]["min"]:
            return {"status": "COMPLIANT"}
        return {"status": "NON_COMPLIANT"}
            
    elif req["type"] == "DOCUMENT_PRESENT":
        if claim.get("present") == True:
            return {"status": "COMPLIANT"}
        return {"status": "NON_COMPLIANT"}
            
    else:
        raise ValueError(f"Requirement type {req['type']} is not handled by the verdict engine!")

def print_card(bidder_name, verdicts, claims, reqs):
    print("=" * 80)
    print(f"BIDDER: {bidder_name}")
    print("=" * 80)
    
    for req in reqs:
        r_id = req["id"]
        verdict = verdicts.get(r_id, {"status": "ERROR"})
        claim = claims.get(r_id)
        
        v_status = verdict.get('status', verdict.get('verdict', 'ERROR'))
        print(f"--- Requirement: {req['field']} ({r_id}) ---")
        print(f"STATUS: {v_status}")
        
        if verdict.get('requires_human_review'):
            if 'reason' in verdict:
                print(f"REASON: {verdict['reason']}")
            print(f"REVIEW REASON: {verdict['review_reason']}")
        else:
            if req["type"] == "NUMERIC":
                print(f"CLAIM: {claim['value']} {claim['unit']}")
                print(f"REQUIREMENT: >= {req['value']['min']} {req['value']['unit']}")
            elif req["type"] == "DOCUMENT_PRESENT":
                print(f"CLAIM: Document Attached ({claim['present']})")
                print(f"REQUIREMENT: Must be present")
            
            print(f"EVIDENCE (Bidder, p.{claim['evidence']['page']}): {claim['evidence']['text'].replace(chr(10), ' ')}")
        print()
    print()

if __name__ == "__main__":
    print("STEP 1: TENDER EXTRACTION")
    reqs = extract_tender_reqs("tender_bhel.pdf")
    print(json.dumps(reqs, indent=2))
    print("\n" + "*"*80 + "\n")
    
    bidders = [
        "bidder_full_compliant.pdf",
        "bidder_partial_compliant.pdf"
    ]
    
    all_claims = {}
    print("STEP 2: BIDDER EXTRACTION")
    for b in bidders:
        print(f"\nProcessing {b}...")
        raw_text, claims = extract_bidder_claims(b)
        print("--- RAW TEXT START ---")
        print(raw_text.strip() if raw_text.strip() else "<NO TEXT FOUND>")
        print("--- RAW TEXT END ---")
        if claims:
            print("CLAIMS JSON:")
            print(json.dumps(claims, indent=2))
        else:
            print("no claims found")
        all_claims[b] = claims
        
    print("\n" + "*"*80 + "\n")
    print("STEP 3 & 4: VERDICT ENGINE & DISPLAY CARDS\n")
    
    for b in bidders:
        verdicts = {}
        for req in reqs:
            r_id = req["id"]
            verdicts[r_id] = evaluate(all_claims[b].get(r_id), req)
        print_card(b, verdicts, all_claims[b], reqs)
