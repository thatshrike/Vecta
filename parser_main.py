import pymupdf
import json
import re
import sys
import os
import urllib.request
import urllib.parse

def call_llm(requirement_summary, bidder_text):
    prompt = f"""You are extracting a compliance judgment from a bidder's document. You are
NOT making a final decision — you are reporting what the evidence shows.

Tender requirement: {requirement_summary}

Bidder's statement: {bidder_text}

Respond ONLY in this exact JSON shape, nothing else:
{{
  "judgment": "SATISFIES" | "DOES_NOT_SATISFY" | "UNCLEAR",
  "reasoning": "<one sentence explaining what evidence led to this judgment>",
  "confidence": <float 0.0-1.0, your own confidence in this judgment>
}}

If the bidder's statement doesn't give you enough concrete, specific evidence
(exact quantities, specific govt/PSU entity named, specific year) to confirm
or deny the requirement, respond UNCLEAR — do not guess based on vague
positive-sounding language like "extensive experience" or "successfully
completed."
"""
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        data = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.0, "response_mime_type": "application/json"}
        }
        try:
            req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode('utf-8'))
                text_response = result['candidates'][0]['content']['parts'][0]['text']
                print(f"\n[LLM RAW RESPONSE]\n{text_response.strip()}\n[/LLM RAW RESPONSE]")
                return json.loads(text_response)
        except Exception as e:
            print(f"\n[LLM ERROR] {e}")
            
    # Mock fallback for demonstration if no API key is present
    print(f"\n[LLM MOCK] No GEMINI_API_KEY found, using mock response for pipeline demonstration.")
    if "5,000 units" in bidder_text:
        res = {
            "judgment": "SATISFIES",
            "reasoning": "Bidder explicitly states supplying 5,000 units (60% of tendered quantity) to Chennai Petroleum Corporation Limited (a Central PSU) in FY 2023-24.",
            "confidence": 0.95
        }
    elif "exclusively to private sector" in bidder_text:
        res = {
            "judgment": "DOES_NOT_SATISFY",
            "reasoning": "Bidder explicitly states they have not supplied to any Government or PSU entity.",
            "confidence": 0.95
        }
    else:
        res = {
            "judgment": "UNCLEAR",
            "reasoning": "Bidder mentions 'extensive experience' and 'reputed clients' but provides no specific entities, quantities, or years to confirm compliance.",
            "confidence": 0.90
        }
    print(f"\n[LLM RAW RESPONSE]\n{json.dumps(res, indent=2)}\n[/LLM RAW RESPONSE]")
    return res

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
            
            # REQ-005: Past Performance
            match_req5 = re.search(r"Past Performance:(.*?Organization / PSU\.)", text, re.IGNORECASE | re.DOTALL)
            if match_req5 and not any(r['id'] == 'REQ-005' for r in reqs):
                full_text = match_req5.group(0).replace('\n', ' ').strip()
                reqs.append({
                    "id": "REQ-005",
                    "type": "SEMANTIC",
                    "field": "past_performance",
                    "requirement_summary": "Bidder or OEM must have supplied 50% of bid quantity to a Central/State Govt org or PSU in at least one of the last 3 financial years.",
                    "evidence": { "document": pdf_path, "page": i + 1, "text": full_text },
                    "extraction_method": "rule",
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

def extract_tech_spec_table(pdf_path):
    claims = {}
    reqs = []
    try:
        doc = pymupdf.open(pdf_path)
        for page_num, page in enumerate(doc):
            tabs = page.find_tables()
            for tab in tabs:
                rows = tab.extract()
                if not rows or len(rows) < 2: continue
                header = [str(x).strip().lower() for x in rows[0] if x]
                if 'parameter' in header and 'required' in header and 'offered' in header:
                    p_idx = header.index('parameter')
                    r_idx = header.index('required')
                    o_idx = header.index('offered')
                    for row in rows[1:]:
                        if len(row) > max(p_idx, r_idx, o_idx):
                            param = str(row[p_idx]).strip()
                            required = str(row[r_idx]).strip()
                            offered = str(row[o_idx]).strip()
                            if param:
                                req_id = f"TS-{param.replace(' ', '_')}"
                                claims[req_id] = {
                                    "offered": offered,
                                    "evidence": {"document": pdf_path, "page": page_num+1, "text": f"{param} | {required} | {offered}"}
                                }
                                reqs.append({
                                    "id": req_id,
                                    "type": "TECH_SPEC_ROW",
                                    "field": param,
                                    "required_str": required
                                })
    except Exception as e:
        pass
    return claims, reqs

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

            # REQ-004 claim: Bidder Turnover Document
            if 'REQ-004' not in claims:
                match4 = re.search(r"(?:attached|enclosed|annexure|provided)?[^\n]*Bidder Turnover(?: Document| Certificate)?[^\n]*(?:attached|enclosed|annexure|provided)?", text, re.IGNORECASE)
                if match4:
                    if re.search(r"(attached|enclosed|annexure|provided)", match4.group(0), re.IGNORECASE):
                        claims['REQ-004'] = {
                            "present": True,
                            "evidence": { "document": pdf_path, "page": i + 1, "text": match4.group(0).strip() }
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
                "verdict": "INCONCLUSIVE",
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
            
    elif req["type"] == "SEMANTIC":
        if "judgment" in claim:
            llm_judgment = claim["judgment"]
            llm_reasoning = claim["reasoning"]
            llm_confidence = claim["confidence"]

            if llm_confidence < 0.7:
                return {
                    "requirement_id": req["id"],
                    "verdict": "INCONCLUSIVE",
                    "requires_human_review": True,
                    "review_reason": f"LLM extraction confidence ({llm_confidence}) is too low. LLM Reasoning: {llm_reasoning}"
                }
            
            if llm_judgment == "SATISFIES":
                return {"status": "COMPLIANT"}
            elif llm_judgment == "DOES_NOT_SATISFY":
                return {"status": "NON_COMPLIANT"}
            elif llm_judgment == "UNCLEAR":
                return {
                    "requirement_id": req["id"],
                    "verdict": "INCONCLUSIVE",
                    "requires_human_review": True,
                    "review_reason": f"LLM extraction found insufficient specific evidence to confirm or deny compliance: {llm_reasoning}"
                }
        return {"status": "ERROR"}

    elif req["type"] == "TECH_SPEC_ROW":
        req_val = req["required_str"].lower()
        off_val = claim["offered"].lower()
        
        # Check for ambiguous units in required string e.g. "30 (11.8)"
        if "(" in req_val and ")" in req_val and any(char.isdigit() for char in req_val):
            return {
                "verdict": "INCONCLUSIVE", 
                "requires_human_review": True, 
                "review_reason": "Tender's stated requirement contains ambiguous unit formats (e.g. parentheticals). Cannot reliably compare computationally."
            }
        
        # Boolean Yes/No matching
        if req_val in ["yes", "no"] or off_val in ["yes", "no"]:
            if req_val == "no" and off_val == "yes":
                # Giving more than required? Or violation?
                # I will make a call: supplying an extra component (Yes when No is required) 
                # shouldn't strictly fail the bid unless it's a size/weight limit. 
                # I will flag it as INCONCLUSIVE so a human can decide.
                return {
                    "verdict": "INCONCLUSIVE",
                    "requires_human_review": True,
                    "review_reason": "Bidder offered 'Yes' when 'No' was required. Offering an unrequested feature may be acceptable, but requires human confirmation."
                }
            elif req_val == off_val:
                return {"status": "COMPLIANT"}
            else:
                return {"status": "NON_COMPLIANT"}
                
        # Numeric rows
        req_match = re.search(r"([0-9.]+)", req_val)
        off_match = re.search(r"([0-9.]+)", off_val)
        if req_match and off_match:
            req_num = float(req_match.group(1))
            off_num = float(off_match.group(1))
            
            # Combine parameter name and requirement string to search for operator words
            full_req_str = f"{req['field'].lower()} {req_val}"
            
            # 1. explicit symbols
            if "<" in req_val or "<=" in req_val:
                return {"status": "COMPLIANT"} if off_num <= req_num else {"status": "NON_COMPLIANT"}
            elif ">" in req_val or ">=" in req_val:
                return {"status": "COMPLIANT"} if off_num >= req_num else {"status": "NON_COMPLIANT"}
            
            # 2. word-based ceiling
            elif any(w in full_req_str for w in ["max", "maximum", "not exceed", "up to"]):
                return {"status": "COMPLIANT"} if off_num <= req_num else {"status": "NON_COMPLIANT"}
                
            # 3. word-based floor
            elif any(w in full_req_str for w in ["min", "minimum", "at least", "not less than"]):
                return {"status": "COMPLIANT"} if off_num >= req_num else {"status": "NON_COMPLIANT"}
                
            # 4. genuinely ambiguous
            else:
                return {
                    "verdict": "INCONCLUSIVE",
                    "requires_human_review": True,
                    "review_reason": f"Requirement states a bare number ('{req_val}') with no clear min/max/exact indicator. Cannot determine correct comparison direction without human interpretation."
                }
                
        # Fallback to string match
        if req_val == off_val:
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
                print(f"EVIDENCE (Bidder, p.{claim['evidence']['page']}): {claim['evidence']['text'].replace(chr(10), ' ')}")
            elif req["type"] == "DOCUMENT_PRESENT":
                print(f"CLAIM: Document Attached ({claim['present']})")
                print(f"REQUIREMENT: Must be present")
                print(f"EVIDENCE (Bidder, p.{claim['evidence']['page']}): {claim['evidence']['text'].replace(chr(10), ' ')}")
            elif req["type"] == "SEMANTIC":
                print(f"LLM JUDGMENT: {claim['judgment']} (Confidence: {claim['confidence']})")
                print(f"LLM REASONING: {claim['reasoning']}")
            elif req["type"] == "TECH_SPEC_ROW":
                print(f"CLAIM (Offered): {claim['offered']}")
                print(f"REQUIREMENT (Stated): {req['required_str']}")
                print(f"EVIDENCE: {claim['evidence']['text']}")
                
        print()
    print()

def check_mii_class1(local_content_pct: float) -> dict:
    if local_content_pct >= 50:
        return {"verdict": "COMPLIANT", "reason": f"Local content {local_content_pct}% meets Class 1 threshold (50%)."}
    elif local_content_pct >= 20:
        return {"verdict": "NON_COMPLIANT", "reason": f"Local content {local_content_pct}% qualifies only for Class 2, not Class 1 (requires 50%)."}
    else:
        return {"verdict": "NON_COMPLIANT", "reason": f"Local content {local_content_pct}% does not meet minimum local content requirements."}

def check_mse_preference(udyam_verified: bool, is_manufacturer: bool) -> dict:
    if udyam_verified and is_manufacturer:
        return {"verdict": "COMPLIANT", "reason": "Valid Udyam registration and confirmed manufacturer status — eligible for MSE purchase preference."}
    elif not udyam_verified:
        return {"verdict": "NON_COMPLIANT", "reason": "No valid Udyam registration found — not eligible for MSE preference."}
    else:
        return {"verdict": "NON_COMPLIANT", "reason": "Bidder is a reseller, not the manufacturer/OEM — MSE preference does not apply to resellers per policy."}

CRITICALITY_MAP = {
    "REQ-001": "mandatory",  # bidder turnover
    "REQ-002": "mandatory",  # OEM turnover
    "REQ-003": "mandatory",  # OEM authorization cert
    "REQ-004": "mandatory",  # bidder turnover doc
    "REQ-005": "mandatory",  # past performance (semantic)
    "POLICY-001": "mandatory",
    "POLICY-002": "mandatory",
    # all TS-* (technical spec rows) default to "scored" unless listed above
}

def get_criticality(req_id: str) -> str:
    if req_id in CRITICALITY_MAP:
        return CRITICALITY_MAP[req_id]
    return "scored"  # default for TS-* and anything unmapped

STATUS_COEFFICIENT = {"COMPLIANT": 1.0, "INCONCLUSIVE": 0.5, "NON_COMPLIANT": 0.0}
MANDATORY_WEIGHT = 3
SCORED_WEIGHT = 1

def compute_compliance_score(line_items: list) -> dict:
    total_weight = 0
    weighted_sum = 0
    mandatory_hard_fail = False
    failed_mandatory_ids = []

    for item in line_items:
        req_id = item["requirement_id"]
        crit = get_criticality(req_id)
        weight = MANDATORY_WEIGHT if crit == "mandatory" else SCORED_WEIGHT
        coeff = STATUS_COEFFICIENT.get(item["verdict"], 0.0)

        total_weight += weight
        weighted_sum += weight * coeff

        if crit == "mandatory" and item["verdict"] == "NON_COMPLIANT":
            mandatory_hard_fail = True
            failed_mandatory_ids.append(req_id)

    score = (weighted_sum / total_weight * 100) if total_weight > 0 else 0

    if mandatory_hard_fail:
        risk_level = "High"
    elif score >= 85:
        risk_level = "Low"
    elif score >= 60:
        risk_level = "Medium"
    else:
        risk_level = "High"

    return {
        "compliance_score": round(score, 1),
        "risk_level": risk_level,
        "mandatory_hard_fail": mandatory_hard_fail,
        "failed_mandatory_requirements": failed_mandatory_ids
    }

def aggregate_bid_verdicts(bid_id, bidder_name, verdicts):
    compliant = 0
    non_compliant = 0
    inconclusive = 0
    line_items = []
    
    failed_reqs = []
    inconclusive_reqs = []
    
    for r_id, verdict in verdicts.items():
        v_status = verdict.get("status", verdict.get("verdict", "ERROR"))
        
        item = {
            "requirement_id": r_id,
            "verdict": v_status,
            "criticality": get_criticality(r_id),
        }
        if verdict.get("reason"):
            item["reason"] = verdict["reason"]
        if verdict.get("review_reason"):
            item["review_reason"] = verdict["review_reason"]
        if verdict.get("requires_human_review"):
            item["requires_human_review"] = True
        if verdict.get("evidence"):
            item["evidence"] = verdict["evidence"]
            
        line_items.append(item)
        
        if v_status == "COMPLIANT":
            compliant += 1
        elif v_status == "NON_COMPLIANT":
            non_compliant += 1
            failed_reqs.append(r_id)
        elif v_status == "INCONCLUSIVE":
            inconclusive += 1
            inconclusive_reqs.append(r_id)
            
    total = compliant + non_compliant + inconclusive
    
    if non_compliant == 0 and inconclusive == 0:
        recommendation = "Fully compliant across all evaluated requirements."
    elif non_compliant > 0:
        recommendation = f"Non-compliant — {non_compliant} requirement(s) failed. Recommend rejection pending review. (Failed: {', '.join(failed_reqs)})"
    else:
        recommendation = f"Conditionally compliant — {inconclusive} item(s) require manual verification before final decision."
        
    score_data = compute_compliance_score(line_items)
        
    return {
        "bid_id": bid_id,
        "bidder_name": bidder_name,
        "summary": {
            "compliant": compliant,
            "non_compliant": non_compliant,
            "inconclusive": inconclusive,
            "total": total
        },
        "compliance_score": score_data["compliance_score"],
        "risk_level": score_data["risk_level"],
        "mandatory_hard_fail": score_data["mandatory_hard_fail"],
        "failed_mandatory_requirements": score_data["failed_mandatory_requirements"],
        "recommendation": recommendation,
        "human_override_applicable": True,
        "line_items": line_items
    }

if __name__ == "__main__":
    print("STEP 1: TENDER EXTRACTION")
    reqs = extract_tender_reqs("test_data/bhel/tender_bhel.pdf")
    
    bidders = [
        "test_data/bhel/bidder_compliant.pdf",
        "test_data/bhel/bidder_noncompliant.pdf",
        "test_data/bhel/bidder_ambigous.pdf",
        "test_data/bhel/bidder_full_compliant.pdf",
        "test_data/bhel/bidder_partial_compliant.pdf",
        "test_data/bhel/bidder_semantic_clear_pass.pdf",
        "test_data/bhel/bidder_semantic_clear_fail.pdf",
        "test_data/bhel/bidder_semantic_ambiguous.pdf",
        "test_data/bhel/bidder_tech_spec.pdf"
    ]
    
    all_claims = {}
    all_bidders_reqs = {}
    print("STEP 2: BIDDER EXTRACTION")
    for b in bidders:
        print(f"\nProcessing {b}...")
        raw_text, claims = extract_bidder_claims(b)
        
        # Part A: Tech Spec Table Extraction
        tech_spec_claims, tech_spec_reqs = extract_tech_spec_table(b)
        claims.update(tech_spec_claims)
        
        bidder_reqs = reqs.copy() + tech_spec_reqs
        all_bidders_reqs[b] = bidder_reqs
        
        print("--- RAW TEXT START ---")
        print(raw_text.strip() if raw_text.strip() else "<NO TEXT FOUND>")
        print("--- RAW TEXT END ---")
        
        # LLM calls for SEMANTIC requirements
        for req in reqs:
            if req["type"] == "SEMANTIC":
                print(f"Calling LLM for {req['id']} against {b}...")
                llm_response = call_llm(req["requirement_summary"], raw_text)
                claims[req["id"]] = llm_response

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
        bidder_reqs = all_bidders_reqs[b]
        for req in bidder_reqs:
            r_id = req["id"]
            verdicts[r_id] = evaluate(all_claims[b].get(r_id), req)
            
        # Part B: Policy Rules
        # To test all branches, let's artificially vary the inputs based on the file name or just add dummy checks
        # Let's add them as custom verdicts for demonstration
        if "full_compliant" in b:
            verdicts["POLICY-001"] = check_mii_class1(62.0)
            verdicts["POLICY-002"] = check_mse_preference(True, True)
            
            # Create synthetic requirements to print_card
            bidder_reqs.append({"id": "POLICY-001", "type": "DOCUMENT_PRESENT", "field": "Local Content 62%"})
            bidder_reqs.append({"id": "POLICY-002", "type": "DOCUMENT_PRESENT", "field": "MSE (Udyam=True, OEM=True)"})
            all_claims[b]["POLICY-001"] = {"present": verdicts["POLICY-001"]["verdict"] == "COMPLIANT", "evidence": {"page":1, "text": verdicts["POLICY-001"]["reason"]}}
            all_claims[b]["POLICY-002"] = {"present": verdicts["POLICY-002"]["verdict"] == "COMPLIANT", "evidence": {"page":1, "text": verdicts["POLICY-002"]["reason"]}}
            
        elif "partial_compliant" in b:
            verdicts["POLICY-001"] = check_mii_class1(30.0)
            verdicts["POLICY-002"] = check_mse_preference(True, False)
            
            bidder_reqs.append({"id": "POLICY-001", "type": "DOCUMENT_PRESENT", "field": "Local Content 30%"})
            bidder_reqs.append({"id": "POLICY-002", "type": "DOCUMENT_PRESENT", "field": "MSE (Udyam=True, OEM=False)"})
            all_claims[b]["POLICY-001"] = {"present": verdicts["POLICY-001"]["verdict"] == "COMPLIANT", "evidence": {"page":1, "text": verdicts["POLICY-001"]["reason"]}}
            all_claims[b]["POLICY-002"] = {"present": verdicts["POLICY-002"]["verdict"] == "COMPLIANT", "evidence": {"page":1, "text": verdicts["POLICY-002"]["reason"]}}

        elif "tech_spec" in b:
            verdicts["POLICY-001"] = check_mii_class1(10.0)
            verdicts["POLICY-002"] = check_mse_preference(False, False)
            
            bidder_reqs.append({"id": "POLICY-001", "type": "DOCUMENT_PRESENT", "field": "Local Content 10%"})
            bidder_reqs.append({"id": "POLICY-002", "type": "DOCUMENT_PRESENT", "field": "MSE (Udyam=False, OEM=False)"})
            all_claims[b]["POLICY-001"] = {"present": verdicts["POLICY-001"]["verdict"] == "COMPLIANT", "evidence": {"page":1, "text": verdicts["POLICY-001"]["reason"]}}
            all_claims[b]["POLICY-002"] = {"present": verdicts["POLICY-002"]["verdict"] == "COMPLIANT", "evidence": {"page":1, "text": verdicts["POLICY-002"]["reason"]}}

        print_card(b, verdicts, all_claims[b], bidder_reqs)
        
        # Part C: Final aggregation
        print("=" * 80)
        print("AGGREGATED BID REPORT:")
        report = aggregate_bid_verdicts(f"BID-{b}", b, verdicts)
        print(json.dumps(report, indent=2))
        print("=" * 80)
        print("\n")
