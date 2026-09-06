import pymupdf
import json
import re
import sys

# Ensure stdout uses UTF-8 so printing rupees or other chars doesn't crash on Windows
sys.stdout.reconfigure(encoding='utf-8')

def extract_tender_req(pdf_path):
    try:
        doc = pymupdf.open(pdf_path)
        for i, page in enumerate(doc):
            text = page.get_text()
            # Look for the turnover requirement.
            # In PyMuPDF, it appears across lines:
            # "/Minimum Average Annual Turnover of the\nbidder (For 3 Years)\n35 Lakh (s)"
            match = re.search(r"Minimum Average Annual Turnover of the\s+bidder\s*\(For 3 Years\)\s+([\d.]+)\s+Lakh", text, re.IGNORECASE | re.MULTILINE)
            if match:
                value_str = match.group(1)
                return {
                    "id": "REQ-001",
                    "type": "NUMERIC",
                    "field": "bidder_avg_annual_turnover",
                    "operator": ">=",
                    "value": { "min": float(value_str), "unit": "lakh" },
                    "evidence": { "document": pdf_path, "page": i + 1, "text": match.group(0).strip() },
                    "confidence": 1.0
                }
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
    return None

def extract_bidder_claim(pdf_path):
    raw_text_full = ""
    claim = None
    try:
        doc = pymupdf.open(pdf_path)
        for i, page in enumerate(doc):
            text = page.get_text()
            raw_text_full += f"--- Page {i+1} ---\n{text}\n"
            
            # Basic parsing logic assuming text exists (even though it might not!)
            # Looking for "Average Annual Turnover (3 years): Rs. 41,50,000" or "41.5 Lakh"
            match = re.search(r"Average Annual Turnover[^\n:]*:\s*(Rs\.?)?\s*([\d,.]+)\s*(Lakh|Lac|Crores?|Cr)?", text, re.IGNORECASE)
            if match and not claim:
                prefix = match.group(1)
                num_str = match.group(2).replace(",", "")
                suffix = match.group(3)
                
                try:
                    val = float(num_str)
                    val_lakh = None
                    
                    if suffix:
                        suffix = suffix.lower()
                        if suffix.startswith('lakh') or suffix.startswith('lac'):
                            val_lakh = val
                        elif suffix.startswith('crore') or suffix.startswith('cr'):
                            val_lakh = val * 100.0
                    else:
                        # Raw rupee format
                        if prefix or "," in match.group(2) or val >= 10000:
                            val_lakh = val / 100000.0
                    
                    if val_lakh is not None:
                        claim = {
                            "value": val_lakh,
                            "unit": "lakh",
                            "evidence": { "document": pdf_path, "page": i + 1, "text": match.group(0).strip() }
                        }
                except ValueError:
                    pass
    except Exception as e:
        raw_text_full += f"Error: {e}\n"
        
    return raw_text_full, claim

def evaluate(claim, req):
    if not claim:
        return {
            "status": "INCONCLUSIVE",
            "requires_human_review": True,
            "review_reason": "No quantified turnover figure found in bidder document."
        }
    
    req_val = req["value"]["min"]
    claim_val = claim["value"]
    if claim_val >= req_val:
        return {"status": "COMPLIANT"}
    else:
        return {"status": "NON_COMPLIANT"}

def print_card(bidder_name, verdict, claim, req):
    print("=" * 60)
    print(f"BIDDER: {bidder_name}")
    print(f"STATUS: {verdict['status']}")
    if verdict['status'] == 'INCONCLUSIVE':
        print(f"REASON: {verdict['review_reason']}")
    else:
        print(f"CLAIM: {claim['value']} {claim['unit']}")
        print(f"REQUIREMENT: >= {req['value']['min']} {req['value']['unit']}")
        print(f"EVIDENCE:")
        print(f"  - Tender ({req['evidence']['document']}, p.{req['evidence']['page']}): {req['evidence']['text']}")
        print(f"  - Bidder ({claim['evidence']['document']}, p.{claim['evidence']['page']}): {claim['evidence']['text']}")
    print("=" * 60)
    print()


if __name__ == "__main__":
    print("STEP 1: TENDER EXTRACTION")
    req = extract_tender_req("tender_bhel.pdf")
    print(json.dumps(req, indent=2))
    print("\n" + "*"*80 + "\n")
    
    bidders = ["bidder_compliant.pdf", "bidder_noncompliant.pdf", "bidder_ambigous.pdf", "bidder_lakh_format.pdf"]
    
    claims = {}
    print("STEP 2: BIDDER EXTRACTION")
    for b in bidders:
        print(f"\nProcessing {b}...")
        raw_text, claim = extract_bidder_claim(b)
        print("--- RAW TEXT START ---")
        print(raw_text.strip() if raw_text.strip() else "<NO TEXT FOUND>")
        print("--- RAW TEXT END ---")
        if claim:
            print("CLAIM JSON:")
            print(json.dumps(claim, indent=2))
        else:
            print("no claim found")
        claims[b] = claim
        
    print("\n" + "*"*80 + "\n")
    print("STEP 3 & 4: VERDICT ENGINE & DISPLAY CARDS\n")
    
    for b in bidders:
        verdict = evaluate(claims[b], req)
        print_card(b, verdict, claims[b], req)
