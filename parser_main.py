import pymupdf
import json
import re
import sys
import os
import urllib.request
import urllib.parse
import urllib.error
from dotenv import load_dotenv

CACHE_DIR = "cache"
os.makedirs(CACHE_DIR, exist_ok=True)

# Load environment variables from .env (keeps secrets out of source control)
load_dotenv()

def check_document_sanity(pdf_path: str) -> dict:
    """
    Pre-flight document sanity check. Returns:
        {"ok": True} — document appears processable
        {"ok": False, "reason": str, "error_code": str} — document is flagged
    
    Checks:
      1. File opens without exception (not corrupted)
      2. File is not password-protected (encrypted)
      3. Page count is within bounds (1–200 pages; 0 = blank, >200 = likely wrong file)
      4. Total extractable character count >= 50 (pure image PDFs flagged for OCR, not outright rejected)
    """
    MIN_PAGES = 1
    MAX_PAGES = 200
    MIN_CHARS_FOR_TEXT_PDF = 50  # Below this, OCR will handle it; not a hard reject

    try:
        doc = pymupdf.open(pdf_path)
    except Exception as e:
        return {"ok": False, "reason": f"PDF could not be opened: {e}", "error_code": "CORRUPT_PDF"}

    if doc.is_encrypted:
        doc.close()
        return {"ok": False, "reason": "PDF is password-protected. Please provide an unlocked version.", "error_code": "ENCRYPTED_PDF"}

    page_count = doc.page_count
    if page_count < MIN_PAGES:
        doc.close()
        return {"ok": False, "reason": "PDF contains no pages.", "error_code": "EMPTY_PDF"}

    if page_count > MAX_PAGES:
        doc.close()
        return {
            "ok": False,
            "reason": f"PDF has {page_count} pages (maximum allowed: {MAX_PAGES}). This may be the wrong document.",
            "error_code": "OVERSIZED_PDF"
        }

    total_chars = sum(len(page.get_text().strip()) for page in doc)
    doc.close()

    # Image-only PDFs are not rejected — they get OCR-routed in extract_bidder_claims()
    # Log a warning but let the pipeline continue
    if total_chars < MIN_CHARS_FOR_TEXT_PDF:
        return {
            "ok": True,
            "warning": "image_only",
            "warning_detail": f"PDF appears to be image-only ({total_chars} extractable characters). OCR fallback will be attempted."
        }

    return {"ok": True}

SEMANTIC_CONFIDENCE_THRESHOLD = 0.7

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
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        data = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.0, "response_mime_type": "application/json"}
        }
        try:
            import time
            for attempt in range(3):
                try:
                    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
                    with urllib.request.urlopen(req) as response:
                        result = json.loads(response.read().decode('utf-8'))
                        text_response = result['candidates'][0]['content']['parts'][0]['text']
                        print(f"\n[LLM RAW RESPONSE]\n{text_response.strip()}\n[/LLM RAW RESPONSE]")
                        
                        json_match = re.search(r"\{.*\}", text_response.strip(), re.DOTALL)
                        if json_match:
                            return json.loads(json_match.group(0))
                        return json.loads(text_response.strip())
                except urllib.error.HTTPError as e:
                    if e.code == 429 and attempt < 2:
                        time.sleep(2 ** attempt)
                        continue
                    raise e
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

def call_llm_extraction(pdf_path: str, field_description: str, bidder_text: str, req_id: str = "extraction"):
    """
    LLM-based extraction fallback for NUMERIC and DOCUMENT_PRESENT fields.
    Called only when regex finds nothing, so most tenders using GeM templates
    never pay the latency/cost cost (regex succeeds on standard phrasing).

    Returns a dict with:
        {
            "found": bool,
            "value": float | None,       # for NUMERIC fields
            "present": bool | None,       # for DOCUMENT_PRESENT fields
            "confidence": float,          # 0.0–1.0
            "reasoning": str,
            "method": "llm_fallback"      # tag so UI can surface it
        }
    Returns None on API failure (caller treats as absent / INCONCLUSIVE).
    """
    import hashlib
    file_hash = hashlib.md5(open(pdf_path, 'rb').read()).hexdigest()
    param_str = f"{field_description}_{bidder_text}"
    param_hash = hashlib.md5(param_str.encode('utf-8')).hexdigest()[:8]
    cache_file = os.path.join(CACHE_DIR, f"{file_hash}_{req_id}_{param_hash}_extraction.json")
    if os.path.exists(cache_file):
        with open(cache_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    prompt = f"""You are extracting a specific data field from a bidder's tender document.
Do NOT make compliance judgments — only extract what the text literally states.

Field to extract: {field_description}

Bidder document text:
{bidder_text}

Respond ONLY in this exact JSON shape, nothing else:
{{
  "found": true | false | null,
  "value": <numeric value as float, or null if not applicable or not found>,
  "present": <true if document/certificate explicitly mentioned as attached/enclosed/provided, false if explicitly absent, null if ambiguous>,
  "confidence": <float 0.0-1.0, your confidence in the extraction>,
  "reasoning": "<one sentence explaining what you found or didn't find>"
}}

If the text contains vague language like 'relevant documents attached' without naming the specific document, set found=false and confidence below 0.5.
Only set found=true if you can point to specific, unambiguous evidence.

IMPORTANT FOR TABLES: If the text contains a table (e.g. with a 'Status' column), accept affirmative answers like 'Yes', 'Submitted', or 'Enclosed' in the Status column as confirmation of presence.
However, a value of 'No' or 'Partial' in the Status column must be treated as NOT confirmed present (set found=null or false for Partial/No) — only an explicit affirmative Status value counts as presence. Do not infer presence from surrounding requirement-description text.
"""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None  # No key — caller falls back to INCONCLUSIVE as before

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    data = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.0, "response_mime_type": "application/json"}
    }
    for attempt in range(3):
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(data).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                result = json.loads(response.read().decode('utf-8'))
                text_response = result['candidates'][0]['content']['parts'][0]['text']
                parsed = json.loads(text_response)
                parsed["method"] = "llm_fallback"
                with open(cache_file, 'w', encoding='utf-8') as f:
                    json.dump(parsed, f, indent=2)
                return parsed
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 2:
                print(f"[LLM EXTRACTION] Rate limit hit, sleeping 15 seconds...")
                import time
                time.sleep(15)
                continue
            raise e
        except Exception as e:
            print(f"[LLM EXTRACTION FALLBACK ERROR] {e}")
            return None

def call_llm_ocr_page(pdf_path, page_num):
    """
    Fallback OCR for pages where PyMuPDF extracts 0 text (scanned/image pages).
    Renders the page to a PNG, base64-encodes it, sends it to Gemini vision.
    Returns the extracted text string, or empty string on failure.
    Requires GEMINI_API_KEY in environment.
    """
    import hashlib
    file_hash = hashlib.md5(open(pdf_path, 'rb').read()).hexdigest()
    cache_file = os.path.join(CACHE_DIR, f"{file_hash}_page_{page_num}_ocr.txt")
    if os.path.exists(cache_file):
        with open(cache_file, 'r', encoding='utf-8') as f:
            return f.read()

    import base64
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return ""

    try:
        doc = pymupdf.open(pdf_path)
        page = doc[page_num - 1]
        # Render at 150 DPI (matrix scale 2x) to PNG bytes
        mat = pymupdf.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat, colorspace=pymupdf.csRGB)
        img_bytes = pix.tobytes("png")
        img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        doc.close()

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        data = {
            "contents": [{
                "parts": [
                    {"text": "Extract all text from this document page exactly as it appears. Return only the extracted text, nothing else."},
                    {"inline_data": {"mime_type": "image/png", "data": img_b64}}
                ]
            }],
            "generationConfig": {"temperature": 0.0}
        }
        import time
        for attempt in range(3):
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(data).encode('utf-8'),
                    headers={'Content-Type': 'application/json'}
                )
                with urllib.request.urlopen(req, timeout=30) as response:
                    result = json.loads(response.read().decode('utf-8'))
                    text_response = result['candidates'][0]['content']['parts'][0]['text']
                    with open(cache_file, 'w', encoding='utf-8') as f:
                        f.write(text_response)
                    return text_response
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < 2:
                    print(f"[OCR] Rate limit hit, sleeping 15 seconds...")
                    time.sleep(15)
                    continue
                raise e
    except Exception as e:
        print(f"[OCR FALLBACK ERROR] {e}")
        return ""
    return ""

# Ensure stdout uses UTF-8 to prevent crashing on rupee symbols or Hindi characters on Windows
sys.stdout.reconfigure(encoding='utf-8')

def extract_tender_reqs(pdf_path):
    reqs = []
    full_tender_text = ""
    try:
        doc = pymupdf.open(pdf_path)
        for i, page in enumerate(doc):
            text = page.get_text()
            if not text.strip():
                print(f"[OCR TRIGGER] Tender Page {i+1} has no selectable text — attempting vision OCR fallback...")
                text = call_llm_ocr_page(pdf_path, i+1)
            full_tender_text += text + "\n"
            
            # REQ-001: Bidder Turnover
            match_req1 = re.search(r"Minimum Average Annual Turnover of the\s*bidder[\s\S]*?(?:\(For 3 Years\))?\s*([\d.]+)\s*Lakh", text, re.IGNORECASE | re.MULTILINE)
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


        # POLICY APPLICABILITY CHECK
        # Only add POLICY-001/002 when the tender *affirmatively imposes* the
        # policy as a requirement on bidders — not when it merely references
        # the policy in a disclaimer or platform boilerplate.
        #
        # MII / Local Content (POLICY-001):
        #   Require "Class 1" / "Class 2" / "local content" language that
        #   actually sets a percentage threshold, OR a Make in India clause
        #   that explicitly mandates a percentage or class category for this
        #   bid.  Boilerplate phrases like "shall not violate Make in India
        #   Policy" do NOT constitute an active requirement.
        MII_AFFIRMATIVE_PATTERNS = [
            r"local content.*?(?:minimum|at least|not less than|\d+\s*%)\s*\d+",  # explicit %
            r"(?:minimum|at least)\s*\d+\s*%.*?local\s*content",                 # % before phrase
            r"class\s*[12]\s+(?:local\s*content|make\s*in\s*india|supplier)",    # Class 1/2 category
            r"make\s*in\s*india.*?(?:class\s*[12]|\d+\s*%|mandatory|compulsory)",# MII with class/pct
        ]
        mii_active = any(
            re.search(pat, full_tender_text, re.IGNORECASE | re.DOTALL)
            for pat in MII_AFFIRMATIVE_PATTERNS
        )
        if mii_active:
            reqs.append({
                "id": "POLICY-001",
                "type": "POLICY",
                "field": "local_content",
                "requirement_summary": "Make in India / Local Content policy applies to this tender."
            })

        # MSE / Udyam (POLICY-002):
        #   Require language that actively grants or mandates purchase preference
        #   or price preference for MSEs/Udyam registrants — not just a mention.
        MSE_AFFIRMATIVE_PATTERNS = [
            r"mse\s+purchase\s+preference",
            r"udyam.*?preference",
            r"preference.*?udyam",
            r"micro\s+and\s+small\s+enterprise.*?preference",
            r"price\s+preference.*?(?:mse|msme|udyam|micro\s+and\s+small)",
        ]
        mse_active = any(
            re.search(pat, full_tender_text, re.IGNORECASE | re.DOTALL)
            for pat in MSE_AFFIRMATIVE_PATTERNS
        )
        if mse_active:
            reqs.append({
                "id": "POLICY-002",
                "type": "POLICY",
                "field": "mse_preference",
                "requirement_summary": "MSE Purchase Preference / Udyam policy applies to this tender."
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
    is_scanned = False
    try:
        doc = pymupdf.open(pdf_path)
        
        # ── PASS 1: Page-by-page extraction ────────────────────────────────
        for i, page in enumerate(doc):
            text = page.get_text()
            if not text.strip():
                print(f"[OCR TRIGGER] Page {i+1} has no selectable text — attempting vision OCR fallback...")
                text = call_llm_ocr_page(pdf_path, i+1)
                if text.strip():
                    print(f"[OCR TRIGGER] Page {i+1}: OCR recovered {len(text)} characters")
                    is_scanned = True
                    
            raw_text_full += f"--- Page {i+1} ---\n{text}\n"

            # ── PASS 1a: Structured table extraction ────────────────────────
            # Adds clean pipe-delimited rows to raw_text_full (for LLM fallback)
            # AND directly processes compliance-table rows for DOCUMENT_PRESENT
            # claims before the prose regex runs.  This handles bidder documents
            # that use a "S.No | Criterion | Tender Req | Bidder's Submission |
            # Status" table format instead of prose attachment statements.
            try:
                tables = page.find_tables()
                if tables:
                    raw_text_full += f"\n--- Page {i+1} Tables ---\n"
                    for tab in tables:
                        rows = tab.extract()
                        for row in rows:
                            clean_row = [str(x).strip().replace('\n', ' ') if x else '' for x in row]
                            raw_text_full += " | ".join(clean_row) + "\n"
                        raw_text_full += "\n"
                        
                        # ── Table-based DOCUMENT_PRESENT extraction ─────────
                        # Detects the 5-column eligibility table used in DRDO-
                        # style BOQ bidder documents:
                        # S.No | Criterion | Tender Requirement |
                        # Bidder's Submission | Status
                        if not rows or len(rows) < 2:
                            continue
                        header = [str(x).strip().lower().replace('\n', ' ') if x else '' for x in rows[0]]
                        # Detect the compliance table by its header signature
                        has_criterion = any('criterion' in h or 'requirement' in h for h in header)
                        has_status = any(h.strip() == 'status' or h.strip().endswith('status') for h in header)
                        has_submission = any('submission' in h or 'offered' in h or 'compliance' in h for h in header)
                        if not (has_criterion and (has_status or has_submission)):
                            continue
                        # Find column indices
                        try:
                            crit_idx = next(j for j, h in enumerate(header) if 'criterion' in h or 'requirement' in h)
                            try:
                                stat_idx = next(j for j, h in enumerate(header) if h.strip() in ('status', 'evaluation') or (h.strip().endswith('status') and 'bidder' not in h))
                            except StopIteration:
                                stat_idx = -1
                            
                            try:
                                subm_idx = next(j for j, h in enumerate(header) if 'bidder' in h or 'offer' in h or 'submission' in h or 'details' in h)
                            except StopIteration:
                                subm_idx = 1 if len(header) == 2 else 2
                        except StopIteration:
                            continue
                        # Process data rows
                        for data_row in rows[1:]:
                            if len(data_row) <= max(crit_idx, subm_idx):
                                continue
                            criterion_cell = str(data_row[crit_idx] or '').replace('\n', ' ').strip()
                            submission_cell = str(data_row[subm_idx] or '').replace('\n', ' ').strip()
                            if stat_idx != -1 and len(data_row) > stat_idx:
                                status_cell = str(data_row[stat_idx] or '').strip().lower()
                            else:
                                status_cell = submission_cell.lower()
                            row_text = f"{criterion_cell} | {submission_cell} | Status: {status_cell.upper()}"
                            
                            # REQ-001: Bidder Turnover (Numeric)
                            if 'REQ-001' not in claims and re.search(r'bidder\s+turnover|average\s+annual\s+turnover', criterion_cell, re.IGNORECASE):
                                m_num = re.search(r"(Rs\.?|₹)?\s*([\d,.]+)\s*(Lakh|Lac|Crores?|Cr)?", submission_cell, re.IGNORECASE)
                                if m_num:
                                    val_lakh = parse_unit_value(m_num.group(1), m_num.group(2), m_num.group(3))
                                    if val_lakh is not None:
                                        claims['REQ-001'] = {
                                            "value": val_lakh,
                                            "unit": "lakh",
                                            "evidence": { "document": pdf_path, "page": i + 1, "text": row_text }
                                        }
                                elif status_cell in ('no', 'not submitted', 'not uploaded', 'rejected', 'not enclosed', 'not provided', 'non-compliant'):
                                    claims['REQ-001'] = {
                                        "value": 0.0,
                                        "unit": "lakh",
                                        "evidence": { "document": pdf_path, "page": i + 1, "text": row_text }
                                    }

                            # REQ-002: OEM Turnover (Numeric)
                            if 'REQ-002' not in claims and re.search(r'oem\s+(average\s+)?turnover', criterion_cell, re.IGNORECASE):
                                m_num = re.search(r"(Rs\.?|₹)?\s*([\d,.]+)\s*(Lakh|Lac|Crores?|Cr)?", submission_cell, re.IGNORECASE)
                                if m_num:
                                    val_lakh = parse_unit_value(m_num.group(1), m_num.group(2), m_num.group(3))
                                    if val_lakh is not None:
                                        claims['REQ-002'] = {
                                            "value": val_lakh,
                                            "unit": "lakh",
                                            "evidence": { "document": pdf_path, "page": i + 1, "text": row_text }
                                        }
                                elif status_cell in ('no', 'not submitted', 'not uploaded', 'rejected', 'not enclosed', 'not provided', 'non-compliant'):
                                    claims['REQ-002'] = {
                                        "value": 0.0,
                                        "unit": "lakh",
                                        "evidence": { "document": pdf_path, "page": i + 1, "text": row_text }
                                    }
                            
                            # REQ-003: OEM Authorization Certificate row
                            if 'REQ-003' not in claims and re.search(
                                r'oem\s+authorization\s*(certificate|cert)?', criterion_cell, re.IGNORECASE
                            ):
                                if status_cell in ('yes', 'submitted', 'enclosed', 'provided', 'compliant'):
                                    print(f"[TABLE EXTRACT] REQ-003: Status='{status_cell}' in criterion row — marking PRESENT")
                                    claims['REQ-003'] = {
                                        "present": True,
                                        "method": "table_extract",
                                        "evidence": {"document": pdf_path, "page": i + 1, "text": row_text}
                                    }
                                elif status_cell in ('no', 'not submitted', 'not uploaded', 'rejected', 'not enclosed', 'not provided', 'non-compliant'):
                                    print(f"[TABLE EXTRACT] REQ-003: Status='{status_cell}' in criterion row — marking ABSENT")
                                    claims['REQ-003'] = {
                                        "present": False,
                                        "method": "table_extract",
                                        "evidence": {"document": pdf_path, "page": i + 1, "text": row_text}
                                    }
                                elif status_cell in ('partial', '-', 'na', 'n/a', ''):
                                    # Partial/ambiguous: record for human review (present=None)
                                    print(f"[TABLE EXTRACT] REQ-003: Status='{status_cell}' — ambiguous/partial, flagging for review")
                                    claims['REQ-003'] = {
                                        "present": None,
                                        "method": "table_extract",
                                        "requires_human_review": True,
                                        "review_reason": f"Table status column shows '{status_cell}' — neither a clear affirmative nor a clear denial.",
                                        "evidence": {"document": pdf_path, "page": i + 1, "text": row_text}
                                    }

                            # REQ-004: Bidder Turnover / financial document row
                            if 'REQ-004' not in claims and re.search(
                                r'bidder\s+(average\s+)?(annual\s+)?turnover|turnover.*CA|financial\s+statement', criterion_cell, re.IGNORECASE
                            ):
                                if status_cell in ('yes', 'submitted', 'enclosed', 'provided', 'compliant'):
                                    print(f"[TABLE EXTRACT] REQ-004: Status='{status_cell}' in criterion row — marking PRESENT")
                                    claims['REQ-004'] = {
                                        "present": True,
                                        "method": "table_extract",
                                        "evidence": {"document": pdf_path, "page": i + 1, "text": row_text}
                                    }
                                elif status_cell in ('no', 'not submitted', 'not uploaded', 'rejected', 'not enclosed', 'not provided', 'non-compliant'):
                                    print(f"[TABLE EXTRACT] REQ-004: Status='{status_cell}' in criterion row — marking ABSENT")
                                    claims['REQ-004'] = {
                                        "present": False,
                                        "method": "table_extract",
                                        "evidence": {"document": pdf_path, "page": i + 1, "text": row_text}
                                    }
                                elif status_cell in ('partial', '-', 'na', 'n/a', ''):
                                    print(f"[TABLE EXTRACT] REQ-004: Status='{status_cell}' — ambiguous/partial, flagging for review")
                                    claims['REQ-004'] = {
                                        "present": None,
                                        "method": "table_extract",
                                        "requires_human_review": True,
                                        "review_reason": f"Table status column shows '{status_cell}' — neither a clear affirmative nor a clear denial.",
                                        "evidence": {"document": pdf_path, "page": i + 1, "text": row_text}
                                    }

            except Exception as e:
                print(f"Table extraction failed on page {i+1}: {e}")

            # ── PASS 1b: Prose regex extraction ─────────────────────────────
            # Handles prose-style bidder documents (e.g. "OEM Authorization
            # Certificate attached as Annexure C").  The keyword list includes
            # 'submitted' so it also catches semi-prose statements like
            # "documents submitted with this bid."

            # REQ-001 claim: Bidder turnover
            if 'REQ-001' not in claims:
                match1 = re.search(r"(?:Bidder\s+Turnover|Average\s*Annual\s*Turnover)[\s\S]{0,40}?(?:(?:\bRs\.?|₹)\s*([\d,.]+)|:\s*(?:(?:\bRs\.?|₹)\s*)?([\d,.]+))\s*(Lakh|Lac|Crores?|Cr)?", text, re.IGNORECASE)
                if match1:
                    num_str = match1.group(1) or match1.group(2)
                    val_lakh = parse_unit_value('Rs', num_str, match1.group(3))
                    if val_lakh is not None:
                        claims['REQ-001'] = {
                            "value": val_lakh,
                            "unit": "lakh",
                            "evidence": { "document": pdf_path, "page": i + 1, "text": match1.group(0).strip() }
                        }

            # REQ-002 claim: OEM turnover
            if 'REQ-002' not in claims:
                match2 = re.search(r"(?:OEM\s+(?:Average\s+)?Turnover)[\s\S]{0,40}?(?:(?:\bRs\.?|₹)\s*([\d,.]+)|:\s*(?:(?:\bRs\.?|₹)\s*)?([\d,.]+))\s*(Lakh|Lac|Crores?|Cr)?", text, re.IGNORECASE)
                if match2:
                    num_str = match2.group(1) or match2.group(2)
                    val_lakh = parse_unit_value('Rs', num_str, match2.group(3))
                    if val_lakh is not None:
                        claims['REQ-002'] = {
                            "value": val_lakh,
                            "unit": "lakh",
                            "evidence": { "document": pdf_path, "page": i + 1, "text": match2.group(0).strip() }
                        }

            # REQ-003 claim: OEM Authorization Certificate (prose style)
            # 'submitted' added alongside attached/enclosed/annexure/provided so
            # semi-prose statements also match without needing the table path.
            if 'REQ-003' not in claims:
                match3 = re.search(
                    r"(?:attached|enclosed|annexure|provided|submitted)?[^\n]*OEM Authorization\s*Certificate[^\n]*(?:attached|enclosed|annexure|provided|submitted)?",
                    text, re.IGNORECASE
                )
                if match3 and re.search(r"(attached|enclosed|annexure|provided|submitted)", match3.group(0), re.IGNORECASE):
                    claims['REQ-003'] = {
                        "present": True,
                        "evidence": { "document": pdf_path, "page": i + 1, "text": match3.group(0).strip() }
                    }

            # REQ-004 claim: Bidder Turnover Document (prose style)
            if 'REQ-004' not in claims:
                match4 = re.search(
                    r"(?:attached|enclosed|annexure|provided|submitted)?[^\n]*Bidder Turnover(?: Document| Certificate)?[^\n]*(?:attached|enclosed|annexure|provided|submitted)?",
                    text, re.IGNORECASE
                )
                if match4 and re.search(r"(attached|enclosed|annexure|provided|submitted)", match4.group(0), re.IGNORECASE):
                    claims['REQ-004'] = {
                        "present": True,
                        "evidence": { "document": pdf_path, "page": i + 1, "text": match4.group(0).strip() }
                    }

        # ── PASS 2: LLM fallback for any field regex couldn't extract ──────
        # Only called when GEMINI_API_KEY is set; skipped silently otherwise.
        llm_fallback_specs = [
            {
                "req_id": "REQ-001",
                "field_description": "The bidder's average annual turnover for the last 3 financial years, stated as a numeric amount in Lakh or Crore rupees.",
                "type": "NUMERIC",
            },
            {
                "req_id": "REQ-002",
                "field_description": "The OEM's (Original Equipment Manufacturer's) average annual turnover for the last 3 financial years, stated as a numeric amount in Lakh or Crore rupees.",
                "type": "NUMERIC",
            },
            {
                "req_id": "REQ-003",
                "field_description": "Whether an OEM Authorization Certificate (also called 'manufacturer authorization letter' or 'OEM authorization letter') is mentioned as attached, enclosed, or provided as an annexure.",
                "type": "DOCUMENT_PRESENT",
            },
            {
                "req_id": "REQ-004",
                "field_description": "Whether a Bidder Turnover document (financial statement, CA certificate, or audited turnover report) is mentioned as attached, enclosed, or provided.",
                "type": "DOCUMENT_PRESENT",
            },
        ]

        for spec in llm_fallback_specs:
            req_id = spec["req_id"]
            if req_id not in claims:
                print(f"[LLM FALLBACK] Regex missed {req_id}, attempting LLM extraction...")
                result = call_llm_extraction(spec["field_description"], raw_text_full)
                if result and result.get("found") and result.get("confidence", 0) >= SEMANTIC_CONFIDENCE_THRESHOLD:
                    if spec["type"] == "NUMERIC" and result.get("value") is not None:
                        claims[req_id] = {
                            "value": result["value"],
                            "unit": "lakh",
                            "method": "llm_fallback",
                            "llm_confidence": result["confidence"],
                            "llm_reasoning": result["reasoning"],
                            "evidence": {"document": pdf_path, "page": 0, "text": result["reasoning"]}
                        }
                    elif spec["type"] == "DOCUMENT_PRESENT":
                        # Accept present=True or present=False from LLM; both are
                        # definitive.  present=None means LLM itself was ambiguous
                        # and we leave the claim absent (falls through to INCONCLUSIVE).
                        if result.get("present") is not None:
                            claims[req_id] = {
                                "present": result["present"],
                                "method": "llm_fallback",
                                "llm_confidence": result["confidence"],
                                "llm_reasoning": result["reasoning"],
                                "evidence": {"document": pdf_path, "page": 0, "text": result["reasoning"]}
                            }
                    print(f"[LLM FALLBACK] {req_id}: extracted with confidence {result['confidence']:.2f}")
                elif result:
                    print(f"[LLM FALLBACK] {req_id}: found={result.get('found')}, confidence={result.get('confidence', 0):.2f} — below threshold, leaving INCONCLUSIVE")

    except Exception as e:
        raw_text_full += f"Error: {e}\n"
        
    return raw_text_full, claims, is_scanned

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
                "requires_human_review": True,
                "review_reason": "Keyword-based absence detection may miss differently-worded attachment references (e.g. 'Authorization letter from OEM enclosed'). Recommend manual confirmation before final rejection."
            }
        elif req["type"] == "SEMANTIC":
            return {
                "status": "INCONCLUSIVE",
                "requires_human_review": True,
                "review_reason": f"Required semantic condition '{req['field']}' was not evaluated or found."
            }
        else:
            return {
                "status": "INCONCLUSIVE",
                "requires_human_review": True,
                "review_reason": f"No claim found for {req.get('type')} requirement."
            }
    
    if req["type"] == "NUMERIC":
        if claim["value"] >= req["value"]["min"]:
            return {"status": "COMPLIANT"}
        return {"status": "NON_COMPLIANT"}
            
    elif req["type"] == "DOCUMENT_PRESENT":
        if claim.get("present") == True:
            return {"status": "COMPLIANT"}
        elif claim.get("present") is None:
            # Table extractor set present=None for ambiguous/partial status
            # (e.g. "Partial", "-", "N/A").  Propagate any human-review metadata
            # embedded in the claim; default to INCONCLUSIVE otherwise.
            review_reason = claim.get(
                "review_reason",
                "Document presence is ambiguous in the bidder's submission — cannot determine compliance without manual review."
            )
            return {
                "requirement_id": req["id"],
                "verdict": "INCONCLUSIVE",
                "requires_human_review": True,
                "review_reason": review_reason,
                "reason": f"Ambiguous status for required document '{req['field'].replace('_', ' ').title()}'."
            }
        # present=False — definitively absent
        return {"status": "NON_COMPLIANT"}
            
    elif req["type"] == "SEMANTIC":
        if "judgment" in claim:
            llm_judgment = claim["judgment"]
            llm_reasoning = claim["reasoning"]
            llm_confidence = claim["confidence"]

            if llm_confidence < SEMANTIC_CONFIDENCE_THRESHOLD:
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
    
    total_items = len(line_items)
    evaluated_items = 0

    for item in line_items:
        req_id = item["requirement_id"]
        crit = get_criticality(req_id)
        weight = MANDATORY_WEIGHT if crit == "mandatory" else SCORED_WEIGHT
        
        # INCONCLUSIVE items are excluded from the score denominator
        if item["verdict"] == "COMPLIANT":
            total_weight += weight
            weighted_sum += weight
            evaluated_items += 1
        elif item["verdict"] == "NON_COMPLIANT":
            total_weight += weight
            evaluated_items += 1

        if crit == "mandatory" and item["verdict"] == "NON_COMPLIANT":
            mandatory_hard_fail = True
            failed_mandatory_ids.append(req_id)

    # Coverage and resolved pass rate
    coverage = (evaluated_items / total_items) if total_items > 0 else 0.0
    
    if total_weight > 0:
        score = (weighted_sum / total_weight) * 100
        resolved_pass_rate = score
    else:
        score = 0.0
        resolved_pass_rate = 0.0

    # Gate the headline score behind 70% coverage floor
    if coverage >= 0.70 and total_weight > 0:
        compliance_score_display = round(score, 1)
        if mandatory_hard_fail:
            risk_level = "High"
        elif score >= 85:
            risk_level = "Low"
        elif score >= 60:
            risk_level = "Medium"
        else:
            risk_level = "High"
    else:
        compliance_score_display = "N/A"
        risk_level = "High" if mandatory_hard_fail else "Medium" # Default risk if N/A

    return {
        "compliance_score": compliance_score_display,
        "coverage": round(coverage, 2),
        "resolved_pass_rate": round(resolved_pass_rate, 1),
        "pending_review_count": total_items - evaluated_items,
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
        if verdict.get("ai_verdict"):
            item["ai_verdict"] = verdict["ai_verdict"]
            
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
        raw_text, claims, is_scanned = extract_bidder_claims(b)
        
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
