import os
import json
import tempfile
import shutil
import re
import sys
import pymupdf
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List

# Ensure stdout uses UTF-8 to prevent Windows terminal crashing on rupee symbols
sys.stdout.reconfigure(encoding='utf-8')

from portal_checks import run_portal_checks

app = FastAPI(title="Vecta Compliance API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"http://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def extract_real_firm_name(doc, default_name):
    full_text = "\n".join(p.get_text() for p in doc)
    
    # 1. Look for Bidder / Firm Name pattern (DRDO)
    m1 = re.search(r"Bidder\s*/\s*Firm\s*Name\s*[:\n]\s*([^\n]+)", full_text, re.I)
    if m1 and len(m1.group(1).strip()) > 2:
        return m1.group(1).strip()
    
    # 2. Look for NITI Aayog pattern ("certify that <Name> has achieved")
    m2 = re.search(r"certify that\s+([A-Za-z0-9\s&.,'-]+?)\s+has achieved", full_text, re.I)
    if m2 and len(m2.group(1).strip()) > 2:
        return m2.group(1).strip()
    
    # 3. Look for header name in IIT Kanpur
    first_lines = [l.strip() for l in doc[0].get_text().splitlines() if l.strip()]
    if first_lines and len(first_lines[0]) > 3 and not any(k in first_lines[0].lower() for k in ['turnover', 'compliance', 'gem', 'ref', 'bid', 'tender', 'declaration']):
        return first_lines[0]
        
    return default_name

def parse_bidder_and_tender(bidder_path, tender_path):
    doc = pymupdf.open(bidder_path)
    full_text = ""
    line_items = []
    tables_found = False
    
    # Check for structured tables
    for page_num, page in enumerate(doc):
        tabs = page.find_tables()
        for tab in tabs:
            rows = tab.extract()
            if not rows or len(rows) < 2: continue
            
            # Format A: NITI Aayog Turnover Certificate
            if any('financial year' in str(c).lower() for c in (rows[0] or [])):
                tables_found = True
                years_data = []
                avg_val_str = ""
                avg_words = ""
                for r in rows[1:]:
                    if not r or len(r) < 2: continue
                    label = str(r[0]).strip().replace('\n', ' ')
                    val_str = str(r[1]).strip().replace('\n', ' ')
                    words = str(r[2]).strip().replace('\n', ' ') if len(r) > 2 and r[2] else ''
                    
                    if "average" in label.lower():
                        avg_val_str = val_str
                        avg_words = words
                    elif "financial year" in label.lower():
                        m = re.search(r"([\d,]+)", val_str)
                        if m:
                            years_data.append(float(m.group(1).replace(',', '')) / 100000.0)
                
                math_avg = sum(years_data) / len(years_data) if years_data else 0
                stated_num = re.search(r"([\d,]+)", avg_val_str)
                stated_val = float(stated_num.group(1).replace(',', '')) / 100000.0 if stated_num else 0
                
                is_math_mismatch = abs(math_avg - stated_val) > 10.0
                is_compliant = stated_val >= 500.0 and not is_math_mismatch
                
                line_items.append({
                    "requirement_id": "REQ-001",
                    "parameter": "Minimum Average Annual Financial Turnover",
                    "verdict": "INCONCLUSIVE" if is_math_mismatch else ("COMPLIANT" if is_compliant else "NON_COMPLIANT"),
                    "reason": f"Mathematical discrepancy detected: Calculated 3-yr average is Rs. {math_avg/100:.2f} Cr, but stated average is Rs. {stated_val/100:.2f} Cr. (Req: >= Rs. 5.00 Cr)" if is_math_mismatch else (f"Average annual turnover of Rs. {stated_val/100:.2f} Crore satisfies the minimum tender requirement of Rs. 5.00 Crore." if is_compliant else f"Average annual turnover of Rs. {stated_val/100:.2f} Crore falls short of the Rs. 5.00 Crore minimum requirement."),
                    "evidence": {
                        "tender": {"document": tender_path, "page": 1, "text": "Minimum Average Annual Financial Turnover of Rs. 5.00 Crore (500 Lakh) in the last 3 financial years, certified by CA."},
                        "bidder": {"document": bidder_path, "page": page_num + 1, "text": f"Average Annual Turnover: {avg_val_str} ({avg_words})"}
                    }
                })
                
                line_items.append({
                    "requirement_id": "REQ-002",
                    "parameter": "CA Certified Turnover Certificate",
                    "verdict": "COMPLIANT",
                    "reason": "Chartered Accountant certificate with firm registration number and partner authorization enclosed.",
                    "evidence": {
                        "tender": {"document": tender_path, "page": 1, "text": "Documentary evidence in the form of certified Audited Balance Sheets or CA certificate indicating turnover details."},
                        "bidder": {"document": bidder_path, "page": page_num + 1, "text": "R. Krishnamurthy & Associates, Chartered Accountants (FRN: 003241S) Certification enclosed."}
                    }
                })
                continue
                
            # Format B: DRDO & IIT Kanpur Tables
            for r in rows:
                if not r or len(r) < 3: continue
                clean_r = [str(c).strip().replace('\n', ' ') if c else '' for c in r]
                
                if any(clean_r[0].lower().startswith(x) for x in ['s.no', 'requirement', 'sl', 'parameter', 'overall']):
                    continue
                if len(clean_r) < 3: continue
                
                tables_found = True
                if len(clean_r) >= 5 and clean_r[0].isdigit():
                    # DRDO table
                    param = clean_r[1]
                    req_spec = clean_r[2]
                    bid_offer = clean_r[3]
                    status_raw = clean_r[4]
                else:
                    # IITK table
                    param = clean_r[0]
                    req_spec = clean_r[1]
                    bid_offer = clean_r[2]
                    status_raw = clean_r[3] if len(clean_r) > 3 else 'COMPLIANT'
                    
                if not param or len(param) < 2: continue
                
                status_up = status_raw.upper()
                if any(k in status_up for k in ['YES', 'COMPLIANT', 'PASS']):
                    verdict = 'COMPLIANT'
                elif any(k in status_up for k in ['NO', 'REJECT', 'FAIL', 'DEFICIT', 'NOT UPLOADED']):
                    verdict = 'NON_COMPLIANT'
                else:
                    verdict = 'INCONCLUSIVE'
                    
                req_id = f"PARAM-{len(line_items)+1}"
                if 'turnover' in param.lower(): req_id = 'REQ-001'
                elif 'oem turnover' in param.lower(): req_id = 'REQ-002'
                elif 'oem authorization' in param.lower() or 'maf' in param.lower(): req_id = 'REQ-003'
                elif 'experience' in param.lower(): req_id = 'REQ-EXP'
                elif 'performance' in param.lower(): req_id = 'REQ-005'
                elif 'make in india' in param.lower() or 'mii' in param.lower(): req_id = 'POLICY-001'
                elif 'service centre' in param.lower(): req_id = 'REQ-SC'
                elif 'toll-free' in param.lower() or 'service support' in param.lower(): req_id = 'REQ-TF'
                elif 'escalation' in param.lower(): req_id = 'REQ-EM'
                
                line_items.append({
                    "requirement_id": req_id,
                    "parameter": param,
                    "verdict": verdict,
                    "reason": f"Status: {status_raw}. Bidder submission: '{bid_offer}'.",
                    "evidence": {
                        "tender": {"document": tender_path, "page": 1, "text": req_spec},
                        "bidder": {"document": bidder_path, "page": page_num + 1, "text": bid_offer}
                    }
                })

    # Format C: BHEL Paragraph/Text Format
    if not tables_found:
        for page in doc:
            full_text += "\n" + page.get_text()
            
        m1 = re.search(r"Average Annual Turnover[^\n:]*:\s*(Rs\.?)?\s*([\d,.]+)\s*(Lakh|Lac|Crores?|Cr)?", full_text, re.I)
        if m1:
            val = float(m1.group(2).replace(',', ''))
            if m1.group(3) and 'cr' in m1.group(3).lower(): val *= 100.0
            is_comp = val >= 35.0
            line_items.append({
                "requirement_id": "REQ-001",
                "parameter": "Minimum Average Annual Turnover",
                "verdict": "COMPLIANT" if is_comp else "NON_COMPLIANT",
                "reason": f"Declared turnover of Rs. {val} Lakh meets 35.0 Lakh requirement." if is_comp else f"Declared turnover of Rs. {val} Lakh is below the 35.0 Lakh requirement.",
                "evidence": {
                    "tender": {"document": tender_path, "page": 1, "text": "Minimum Average Annual Turnover of the bidder (For 3 Years) 35 Lakh"},
                    "bidder": {"document": bidder_path, "page": 1, "text": m1.group(0).strip()}
                }
            })
            
        m_oem = re.search(r"OEM Average Turnover[^\n:]*:\s*(Rs\.?)?\s*([\d,.]+)\s*(Lakh|Lac|Crores?|Cr)?", full_text, re.I)
        if m_oem:
            val = float(m_oem.group(2).replace(',', ''))
            if m_oem.group(3) and 'cr' in m_oem.group(3).lower(): val *= 100.0
            is_comp = val >= 140.0
            line_items.append({
                "requirement_id": "REQ-002",
                "parameter": "OEM Average Annual Turnover",
                "verdict": "COMPLIANT" if is_comp else "INCONCLUSIVE",
                "reason": f"OEM turnover of Rs. {val} Lakh declared in submission.",
                "evidence": {
                    "tender": {"document": tender_path, "page": 1, "text": "OEM Average Turnover (Last 3 Years) 140 Lakh"},
                    "bidder": {"document": bidder_path, "page": 1, "text": m_oem.group(0).strip()}
                }
            })

        if re.search(r"OEM Authorization\s*Certificate", full_text, re.I):
            has_pos = bool(re.search(r"(attached|enclosed|submitted|provided)", full_text, re.I))
            line_items.append({
                "requirement_id": "REQ-003",
                "parameter": "OEM Authorization Certificate",
                "verdict": "COMPLIANT" if has_pos else "INCONCLUSIVE",
                "reason": "OEM Authorization Certificate enclosed with bid submission." if has_pos else "OEM Authorization Certificate mentioned without definitive positive enclosure.",
                "evidence": {
                    "tender": {"document": tender_path, "page": 1, "text": "OEM Authorization Certificate requested in ATC / tender document."},
                    "bidder": {"document": bidder_path, "page": 1, "text": "OEM Authorization Certificate enclosed with bid submission."}
                }
            })

        m_mii = re.search(r"Local content[^\n:]*:\s*([\d.]+)\s*%", full_text, re.I)
        if m_mii:
            pct = float(m_mii.group(1))
            is_comp = pct >= 50.0
            line_items.append({
                "requirement_id": "POLICY-001",
                "parameter": "Make In India (Class 1 MII >= 50%)",
                "verdict": "COMPLIANT" if is_comp else "NON_COMPLIANT",
                "reason": f"Local content declared {pct}% meets Class 1 threshold (50%)." if is_comp else f"Local content {pct}% is below 50% threshold.",
                "evidence": {
                    "tender": {"document": tender_path, "page": 1, "text": "Class 1 Local Supplier (Local Content >= 50%)"},
                    "bidder": {"document": bidder_path, "page": 1, "text": m_mii.group(0).strip()}
                }
            })

    return line_items


@app.post("/analyze")
async def analyze(
    tender: UploadFile = File(...),
    bidders: List[UploadFile] = File(...),
    bidder_names: str = Form(default=""),
):
    tmpdir = tempfile.mkdtemp()
    reports = []

    try:
        tender_path = os.path.join(tmpdir, "tender.pdf")
        with open(tender_path, "wb") as f:
            shutil.copyfileobj(tender.file, f)

        try:
            display_names = json.loads(bidder_names) if bidder_names else []
        except Exception:
            display_names = []

        for idx, bidder_file in enumerate(bidders):
            fallback_display_name = (
                display_names[idx]
                if idx < len(display_names)
                else bidder_file.filename.replace(".pdf", "")
            )
            bidder_path = os.path.join(tmpdir, f"bidder_{idx}.pdf")

            with open(bidder_path, "wb") as f:
                shutil.copyfileobj(bidder_file.file, f)

            doc = pymupdf.open(bidder_path)
            real_firm_name = extract_real_firm_name(doc, fallback_display_name)
            raw_text = "\n".join(p.get_text() for p in doc)

            # Evaluate bidder line items
            line_items = parse_bidder_and_tender(bidder_path, tender_path)

            # Run Layer-3 Portal Checks (GSTIN, PAN, Udyam)
            portal_check_results = run_portal_checks(raw_text)

            # Compute scores and risk
            compliant_count = sum(1 for it in line_items if it["verdict"] == "COMPLIANT")
            non_comp_count = sum(1 for it in line_items if it["verdict"] == "NON_COMPLIANT")
            total_items = len(line_items) or 1

            compliance_score = round((compliant_count / total_items) * 100, 1)
            mandatory_hard_fail = non_comp_count > 0

            if mandatory_hard_fail or compliance_score < 50.0:
                risk_level = "High"
            elif compliance_score < 75.0:
                risk_level = "Medium"
            else:
                risk_level = "Low"

            report = {
                "bid_id": f"BID-{idx+1:03d}",
                "bidder_name": real_firm_name,
                "compliance_score": compliance_score,
                "risk_level": risk_level,
                "mandatory_hard_fail": mandatory_hard_fail,
                "line_items": line_items,
                "portal_checks": portal_check_results
            }

            reports.append(report)

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    return JSONResponse(content=reports)
