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

            # Portal checks — Layer 3 adapters (PAN real, GSTN/Udyam mocked).
            # Run BEFORE policy verdicts so POLICY-002 can consume the adapter result
            # instead of re-deriving Udyam status from PDF text.
            portal_check_results = run_portal_checks(raw_text)

            # Policy checks
            # --- POLICY-001: Local Content (MII Class 1) ---
            # _extract_local_content returns None when no value found in PDF.
            # If absent: INCONCLUSIVE (bidder must clarify). Only NON_COMPLIANT
            # if a value was actually found and it fails the threshold.
            local_content_pct = _extract_local_content(raw_text)
            if local_content_pct is None:
                verdicts["POLICY-001"] = {
                    "verdict": "INCONCLUSIVE",
                    "reason": "No local content percentage found in the bidder's document.",
                    "review_reason": "Bidder must declare local content % explicitly (e.g., 'Local content declared: 62%'). Cannot confirm or deny Class 1 compliance.",
                    "requires_human_review": True,
                }
            else:
                verdicts["POLICY-001"] = check_mii_class1(local_content_pct)

            # --- POLICY-002: Udyam / MSE Preference ---
            # Wire to the Udyam portal adapter result, not PDF text extraction.
            # Adapter status semantics:
            #   VERIFIED   → Udyam number found and format valid  (treat as confirmed present)
            #   FAILED     → Udyam number found but format invalid (non-compliant)
            #   UNVERIFIED → No Udyam number found at all         (INCONCLUSIVE — absent ≠ fail)
            #   MOCKED     → Format OK but live portal not called  (INCONCLUSIVE — needs officer check)
            udyam_check = next(
                (c for c in portal_check_results if c["check_id"] == "UDYAM_REGISTRATION"),
                None,
            )
            udyam_status = udyam_check["status"] if udyam_check else "UNVERIFIED"

            if udyam_status == "VERIFIED":
                # Number found and format valid — treat as registered for policy scoring
                verdicts["POLICY-002"] = check_mse_preference(True, True)
            elif udyam_status == "FAILED":
                # Number present but structurally invalid — confirmed fail
                verdicts["POLICY-002"] = {
                    "verdict": "NON_COMPLIANT",
                    "reason": f"Udyam number found but failed format validation: {udyam_check.get('detail', '')}",
                }
            else:
                # UNVERIFIED (no number found) or MOCKED (found but live portal not called).
                # Either way, we cannot confirm registration — INCONCLUSIVE, not auto-fail.
                detail = udyam_check.get("detail", "Udyam registration status could not be confirmed.") if udyam_check else "Udyam check not executed."
                verdicts["POLICY-002"] = {
                    "verdict": "INCONCLUSIVE",
                    "reason": detail,
                    "review_reason": (
                        "Udyam registration could not be confirmed from the document or portal adapter. "
                        "Officer must verify manually via the Udyam portal before awarding MSE preference."
                    ),
                    "requires_human_review": True,
                }

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

            # Attach portal check results to report
            report["portal_checks"] = portal_check_results

            reports.append(report)

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    return JSONResponse(content=reports)


def _extract_local_content(raw_text: str) -> float | None:
    """
    Attempt to extract a local content percentage from raw bidder text.
    Returns None if not found — callers must treat None as INCONCLUSIVE, not 0.
    Returning None is intentionally conservative: absent data != confirmed fail.
    Expected bidder text: "Local content declared: 62%" or similar.
    """
    import re
    match = re.search(
        r"local\s+content[^%\d]*(\d+(?:\.\d+)?)\s*%",
        raw_text,
        re.IGNORECASE,
    )
    if match:
        return float(match.group(1))
    return None


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
