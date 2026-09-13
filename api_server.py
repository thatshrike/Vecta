import os
import json
import tempfile
import shutil
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Any, List

# Import the core pipeline functions from parser_main.py
from parser_main import (
    extract_tender_reqs,
    extract_bidder_claims,
    extract_tech_spec_table,
    evaluate,
    aggregate_bid_verdicts,
    compute_compliance_score,
    call_llm,
    check_mii_class1,
    check_mse_preference,
    SEMANTIC_CONFIDENCE_THRESHOLD
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
    vendor_ids: str = Form(default=""),
):
    """
    Accepts:
      - tender: single PDF file (the tender document / ATC / NIT)
      - bidders: one or more PDF files (bidder submissions)
      - bidder_names: JSON array of display names, parallel to bidders list (optional)
      - vendor_ids: JSON array of vendor IDs, parallel to bidders list (optional)

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

        # 2. Parse display names and vendor IDs (frontend passes them as JSON array string)
        try:
            display_names = json.loads(bidder_names) if bidder_names else []
        except Exception:
            display_names = []

        try:
            vendor_ids_parsed = json.loads(vendor_ids) if vendor_ids else []
        except Exception:
            vendor_ids_parsed = []

        # 3. Server-side collision guard — frontend pre-flight is UX-only and bypassable.
        # Build the resolved ID for every bidder (same logic as UploadDashboard.jsx)
        # and reject the batch early if any two packets would share a bid_id.
        def _derive_name(filename: str) -> str:
            return (
                filename
                .replace(".pdf", "")
                .removeprefix("bidder_")
                .replace("_", " ")
                .upper()
            )

        resolved_ids = []
        for idx_check, bf in enumerate(bidders):
            vid = vendor_ids_parsed[idx_check].strip() if idx_check < len(vendor_ids_parsed) else ""
            resolved_ids.append(f"BID-{vid}" if vid else f"BID-{_derive_name(bf.filename)}")

        if len(set(resolved_ids)) != len(resolved_ids):
            seen = set()
            dupe = next(r for r in resolved_ids if r in seen or seen.add(r))
            return JSONResponse(
                status_code=409,
                content={"error": "bid_id_collision", "detail": f"Two bidder packets resolve to the same ID: {dupe!r}. Assign unique Vendor IDs or rename the files."},
            )

        # 4. Process each bidder
        for idx, bidder_file in enumerate(bidders):
            # Normalize the filename fallback the same way UploadDashboard does:
            # strip .pdf, strip leading "bidder_", replace underscores with spaces.
            raw_filename_name = (
                bidder_file.filename
                .replace(".pdf", "")
                .removeprefix("bidder_")
                .replace("_", " ")
                .upper()
            )
            
            vendor_id = vendor_ids_parsed[idx] if idx < len(vendor_ids_parsed) and vendor_ids_parsed[idx].strip() else None
            
            bidder_display_name = (
                display_names[idx]
                if idx < len(display_names) and display_names[idx].strip()
                else raw_filename_name
            )
            
            # Idempotency guard: if vendor_id is omitted, fallback to the stable derived name
            # instead of generating a random UUID so that re-uploads don't break frontend state tracking
            bid_id_value = f"BID-{vendor_id}" if vendor_id else f"BID-{raw_filename_name}"
            
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

            # Flag extraction failure: if no claims were produced, the PDF
            # was likely corrupt, empty, or not parseable — surface this explicitly
            # rather than silently returning a score of 0 with no line_items.
            extraction_failed = len(claims) == 0

            # Replay officer overrides from audit log before aggregation
            if os.path.exists("audit_log.jsonl"):
                audit_overrides = {}
                with open("audit_log.jsonl", "r") as f:
                    for line in f:
                        try:
                            entry = json.loads(line)
                            b_id = entry.get("bid_id")
                            r_id = entry.get("requirement_id")
                            if b_id and r_id:
                                if b_id not in audit_overrides:
                                    audit_overrides[b_id] = {}
                                audit_overrides[b_id][r_id] = {
                                    "verdict": entry.get("new_verdict"),
                                    "reason": entry.get("reason", "Officer accepted finding.")
                                }
                        except Exception:
                            pass
                
                if bid_id_value in audit_overrides:
                    for r_id, override in audit_overrides[bid_id_value].items():
                        if r_id in verdicts:
                            # Keep original AI verdict in the payload for explainability
                            verdicts[r_id]["ai_verdict"] = verdicts[r_id]["verdict"]
                            
                            # Apply the override
                            verdicts[r_id]["verdict"] = override["verdict"]
                            verdicts[r_id]["requires_human_review"] = False
                            
                            reason_text = override["reason"]
                            if reason_text and reason_text != "Officer accepted finding.":
                                verdicts[r_id]["review_reason"] = f"Officer Override: {reason_text}"
                            else:
                                verdicts[r_id]["review_reason"] = "Officer accepted finding."

            report = aggregate_bid_verdicts(
                bid_id=bid_id_value,
                bidder_name=bidder_display_name,
                verdicts=verdicts,
            )

            if extraction_failed:
                report["extraction_error"] = True
                report["extraction_error_detail"] = (
                    "No requirements could be extracted from this bidder's PDF. "
                    "The document may be scanned (image-only), password-protected, or "
                    "not contain the expected clause text. Manual review is required."
                )

            # Enrich line_items with evidence from claims so the frontend
            # can populate the evidence inspector pane without guessing.
            for item in report["line_items"]:
                r_id = item["requirement_id"]
                claim = claims.get(r_id)
                req_obj = next((r for r in bidder_reqs if r["id"] == r_id), None)

                if claim and isinstance(claim, dict):
                    # Build structured bidder evidence
                    bidder_evidence = {}
                    raw_evidence = claim.get("evidence")
                    if raw_evidence:
                        bidder_evidence.update(raw_evidence)  # copies text, page, document

                    # For NUMERIC claims, surface the extracted value vs required value
                    # so the UI can show a structured comparison, not just raw text.
                    if req_obj and req_obj.get("type") == "NUMERIC" and "value" in claim:
                        bidder_evidence["extracted_value"] = claim["value"]
                        bidder_evidence["required_value"] = req_obj["value"]["min"]
                        bidder_evidence["unit"] = claim.get("unit", req_obj["value"].get("unit", ""))

                    # For DOCUMENT_PRESENT claims, surface presence flag
                    if req_obj and req_obj.get("type") == "DOCUMENT_PRESENT" and "present" in claim:
                        bidder_evidence["document_found"] = claim["present"]

                    # For SEMANTIC claims, surface confidence and LLM reasoning
                    if req_obj and req_obj.get("type") == "SEMANTIC" and "judgment" in claim:
                        bidder_evidence["llm_judgment"] = claim["judgment"]
                        bidder_evidence["llm_confidence"] = claim["confidence"]
                        bidder_evidence["llm_reasoning"] = claim.get("reasoning", "")
                        bidder_evidence["confidence_threshold"] = SEMANTIC_CONFIDENCE_THRESHOLD

                    if bidder_evidence:
                        item["evidence"] = {"bidder": bidder_evidence}

                # Also attach tender-side evidence from the requirement
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


import datetime
import json
from typing import Any, List, Optional


class OverrideDetail(BaseModel):
    requirement_id: str
    new_verdict: str
    reason: str


class RecalculateRequest(BaseModel):
    bid_id: str
    line_items: list[dict[str, Any]]
    override: Optional[OverrideDetail] = None


@app.post("/recalculate")
async def recalculate(body: RecalculateRequest):
    """
    Accepts a bid_id and the current (possibly officer-overridden) line_items list.
    Re-runs compute_compliance_score over them — no PDF parsing, no LLM calls.
    Returns only the scoring fields so the frontend can update the headline score
    without running any local formula.

    Also persists the specific officer override action to an append-only audit log.
    """
    if not body.line_items:
        return JSONResponse(
            status_code=422,
            content={"error": "empty_line_items", "detail": "line_items must not be empty."},
        )

    if body.override:
        audit_entry = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "bid_id": body.bid_id,
            "requirement_id": body.override.requirement_id,
            "new_verdict": body.override.new_verdict,
            "reason": body.override.reason
        }
        with open("audit_log.jsonl", "a") as f:
            f.write(json.dumps(audit_entry) + "\n")

    score_result = compute_compliance_score(body.line_items)
    return JSONResponse(content={"bid_id": body.bid_id, **score_result})


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
    uvicorn.run("api_server:app", host="0.0.0.0", port=8000, reload=True)
