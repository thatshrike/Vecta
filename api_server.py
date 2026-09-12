import os
import json
import tempfile
import shutil
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List

# Import the core pipeline functions from parser_main.py
from parser_main import (
    extract_tender_reqs,
    extract_bidder_claims,
    extract_tech_spec_table,
    evaluate,
    aggregate_bid_verdicts,
    call_llm,
    check_mii_class1,
    check_mse_preference,
)
from portal_checks import run_portal_checks

app = FastAPI(title="Vecta Compliance API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/analyze")
async def analyze(
    tender: UploadFile = File(...),
    bidders: List[UploadFile] = File(...),
    bidder_names: str = Form(default=""),
):
    """
    Accepts:
      - tender: single PDF file (the tender document / ATC / NIT)
      - bidders: one or more PDF files (bidder submissions)
      - bidder_names: JSON array of display names, parallel to bidders list (optional)

    Returns:
      JSON array — one aggregate report object per bidder, in submission order.
    """
    tmpdir = tempfile.mkdtemp()
    reports = []

    try:
        # 1. Save tender to temp dir and extract requirements
        tender_path = os.path.join(tmpdir, "tender.pdf")
        with open(tender_path, "wb") as f:
            shutil.copyfileobj(tender.file, f)

        reqs = extract_tender_reqs(tender_path)

        # 2. Parse display names (frontend passes them as JSON array string)
        try:
            display_names = json.loads(bidder_names) if bidder_names else []
        except Exception:
            display_names = []

        # 3. Process each bidder
        for idx, bidder_file in enumerate(bidders):
            bidder_display_name = (
                display_names[idx]
                if idx < len(display_names)
                else bidder_file.filename.replace(".pdf", "")
            )
            bidder_path = os.path.join(tmpdir, f"bidder_{idx}.pdf")

            with open(bidder_path, "wb") as f:
                shutil.copyfileobj(bidder_file.file, f)

            # Claim extraction
            raw_text, claims = extract_bidder_claims(bidder_path)
            tech_spec_claims, tech_spec_reqs = extract_tech_spec_table(bidder_path)
            claims.update(tech_spec_claims)

            bidder_reqs = reqs.copy() + tech_spec_reqs

            # LLM calls for SEMANTIC requirements
            for req in bidder_reqs:
                if req["type"] == "SEMANTIC":
                    llm_response = call_llm(req["requirement_summary"], raw_text)
                    claims[req["id"]] = llm_response

            # Verdict engine
            verdicts = {}
            for req in bidder_reqs:
                r_id = req["id"]
                verdicts[r_id] = evaluate(claims.get(r_id), req)

            # Policy checks — default to worst-case since we can't extract
            # local content % or Udyam status from arbitrary PDFs yet.
            # TODO: add regex extractors for local content % and Udyam number.
            local_content_pct = _extract_local_content(raw_text)
            udyam_verified = _extract_udyam(raw_text)
            verdicts["POLICY-001"] = check_mii_class1(local_content_pct)
            verdicts["POLICY-002"] = check_mse_preference(udyam_verified, udyam_verified)

            report = aggregate_bid_verdicts(
                bid_id=f"BID-{bidder_display_name}",
                bidder_name=bidder_display_name,
                verdicts=verdicts,
            )

            # Enrich line_items with evidence from claims so the frontend
            # can populate the evidence inspector pane without guessing.
            for item in report["line_items"]:
                r_id = item["requirement_id"]
                claim = claims.get(r_id)
                if claim and isinstance(claim, dict):
                    evidence = claim.get("evidence")
                    if evidence:
                        item["evidence"] = {"bidder": evidence}
                    # Also attach tender-side evidence from the requirement
                    req_obj = next(
                        (r for r in bidder_reqs if r["id"] == r_id), None
                    )
                    if req_obj and req_obj.get("evidence"):
                        if "evidence" not in item:
                            item["evidence"] = {}
                        item["evidence"]["tender"] = req_obj["evidence"]

            # Portal checks — Layer 3 adapters (PAN real, GSTN/Udyam mocked)
            portal_check_results = run_portal_checks(raw_text)
            report["portal_checks"] = portal_check_results

            reports.append(report)

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    return JSONResponse(content=reports)


def _extract_local_content(raw_text: str) -> float:
    """
    Attempt to extract a local content percentage from raw bidder text.
    Returns 0.0 if not found (conservative — will trigger NON_COMPLIANT
    and force human review, which is safer than assuming compliance).
    """
    import re
    match = re.search(
        r"local\s+content[^%\d]*(\d+(?:\.\d+)?)\s*%",
        raw_text,
        re.IGNORECASE,
    )
    if match:
        return float(match.group(1))
    return 0.0


def _extract_udyam(raw_text: str) -> bool:
    """
    Returns True if an Udyam registration number pattern is found.
    UDYAM-XX-00-0000000 format.
    Conservative: only returns True on explicit pattern match.
    """
    import re
    return bool(re.search(r"UDYAM-[A-Z]{2}-\d{2}-\d{7}", raw_text, re.IGNORECASE))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
