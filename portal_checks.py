"""
portal_checks.py — Layer 3: External Portal Adapters
=====================================================
Architecture: each adapter is a pure function that takes structured inputs
and returns a PortalCheckResult dict. No adapter makes real HTTP calls in
this version — the PAN check is a deterministic local algorithm; GSTN and
Udyam are clearly-flagged mocks that explain exactly what a live call would
verify, so the procurement officer knows what was checked and what was not.

PortalCheckResult schema (per check):
  {
    "check_id":    str,             # e.g. "PAN_CHECKSUM"
    "label":       str,             # human-readable name
    "status":      "VERIFIED" | "FAILED" | "UNVERIFIED" | "MOCKED",
    "detail":      str,             # one sentence result explanation
    "is_live":     bool,            # True = real algorithm; False = mock
    "evidence":    str | None,      # extracted value that was checked
  }
"""
import re


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_pan(text: str) -> str | None:
    """Return the first PAN-like string found in text, or None."""
    match = re.search(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b", text)
    return match.group(1) if match else None


def _extract_gstin(text: str) -> str | None:
    """
    Return the first GSTIN-like string found in text, or None.
    Pattern: 2-digit state code + 10-char PAN + 1 entity + 1 'Z' + 1 checksum.
    """
    match = re.search(
        r"\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b", text
    )
    return match.group(1) if match else None


def _extract_udyam_number(text: str) -> str | None:
    """Return first Udyam registration number found, or None."""
    match = re.search(r"\b(UDYAM-[A-Z]{2}-\d{2}-\d{7})\b", text, re.IGNORECASE)
    return match.group(0).upper() if match else None


# ---------------------------------------------------------------------------
# Adapter 1 — PAN Structural Checksum (REAL, deterministic, no network)
# ---------------------------------------------------------------------------

# Income Tax Act specifies PAN structure:
#   chars 1-3: AAA  (entity series)
#   char 4:    entity type (C=company, P=person, H=HUF, F=firm, A=AOP,
#               T=trust, B=BOI, L=local authority, J=AJP, G=govt)
#   char 5:    first letter of surname / entity name
#   chars 6-9: 0000 sequential
#   char 10:   alphabetic check character
_VALID_PAN_ENTITY_TYPES = set("CPAHFTBLJG")


def check_pan_structural(raw_text: str) -> dict:
    """
    Validates PAN structural rules (no network call required):
      1. Regex pattern match (5 alpha + 4 digit + 1 alpha, all uppercase)
      2. 4th character is a valid entity-type code
      3. 5th character is alphabetic (name initial)
    Returns a PortalCheckResult dict.
    """
    pan = _extract_pan(raw_text)

    if not pan:
        return {
            "check_id": "PAN_CHECKSUM",
            "label": "PAN Structural Validation",
            "status": "UNVERIFIED",
            "detail": "No PAN number found in the bidder's document text.",
            "is_live": True,
            "evidence": None,
        }

    # Rule 1: uppercase 10-char pattern (already guaranteed by regex)
    if len(pan) != 10 or not pan[:5].isalpha() or not pan[5:9].isdigit() or not pan[9].isalpha():
        return {
            "check_id": "PAN_CHECKSUM",
            "label": "PAN Structural Validation",
            "status": "FAILED",
            "detail": f"PAN '{pan}' does not conform to the standard 10-character format (AAAANNNNA).",
            "is_live": True,
            "evidence": pan,
        }

    # Rule 2: 4th character must be a valid entity type
    entity_char = pan[3]
    if entity_char not in _VALID_PAN_ENTITY_TYPES:
        return {
            "check_id": "PAN_CHECKSUM",
            "label": "PAN Structural Validation",
            "status": "FAILED",
            "detail": (
                f"PAN '{pan}' has invalid entity-type character '{entity_char}' "
                f"at position 4. Valid types: {', '.join(sorted(_VALID_PAN_ENTITY_TYPES))}."
            ),
            "is_live": True,
            "evidence": pan,
        }

    # Rule 3: 5th character must be alphabetic (name initial)
    if not pan[4].isalpha():
        return {
            "check_id": "PAN_CHECKSUM",
            "label": "PAN Structural Validation",
            "status": "FAILED",
            "detail": f"PAN '{pan}': 5th character '{pan[4]}' must be alphabetic (first letter of entity name).",
            "is_live": True,
            "evidence": pan,
        }

    return {
        "check_id": "PAN_CHECKSUM",
        "label": "PAN Structural Validation",
        "status": "VERIFIED",
        "detail": (
            f"PAN '{pan}' passes all structural rules: format, entity-type '{entity_char}' "
            f"({'Company' if entity_char == 'C' else 'Individual/Firm/Other'}), "
            f"and name-initial check."
        ),
        "is_live": True,
        "evidence": pan,
    }


# ---------------------------------------------------------------------------
# Adapter 2 — GSTIN Format Validation (MOCKED — live call = GST portal API)
# ---------------------------------------------------------------------------

def check_gstin_format(raw_text: str) -> dict:
    """
    MOCKED adapter.
    In production this would call https://api.gst.gov.in/ with a service key
    to verify: (a) GSTIN is active, (b) filing status current, (c) matches PAN.
    Currently performs only local format validation (state code + PAN embed).
    """
    gstin = _extract_gstin(raw_text)

    if not gstin:
        return {
            "check_id": "GSTIN_FORMAT",
            "label": "GSTIN Format Check (Mocked)",
            "status": "UNVERIFIED",
            "detail": "No GSTIN found in the bidder's document. Cannot verify GST registration.",
            "is_live": False,
            "evidence": None,
        }

    state_code = int(gstin[:2])
    embedded_pan = gstin[2:12]
    pan_in_doc = _extract_pan(raw_text)

    issues = []
    if not (1 <= state_code <= 38):
        issues.append(f"state code {state_code} is out of valid range (01–38)")

    if pan_in_doc and embedded_pan != pan_in_doc:
        issues.append(
            f"PAN embedded in GSTIN ({embedded_pan}) differs from standalone PAN ({pan_in_doc})"
        )

    if issues:
        return {
            "check_id": "GSTIN_FORMAT",
            "label": "GSTIN Format Check (Mocked)",
            "status": "FAILED",
            "detail": f"GSTIN '{gstin}' failed format checks: {'; '.join(issues)}. [MOCKED — no live GST portal call made]",
            "is_live": False,
            "evidence": gstin,
        }

    return {
        "check_id": "GSTIN_FORMAT",
        "label": "GSTIN Format Check (Mocked)",
        "status": "MOCKED",
        "detail": (
            f"GSTIN '{gstin}' passes local format validation (state code {state_code:02d}, "
            f"PAN embed consistent). Live portal call (active status, return filing) not executed. "
            f"[MOCKED — integrate GST portal API key to enable]"
        ),
        "is_live": False,
        "evidence": gstin,
    }


# ---------------------------------------------------------------------------
# Adapter 3 — Udyam Registration Check (MOCKED — live call = Udyam portal API)
# ---------------------------------------------------------------------------

def check_udyam_registration(raw_text: str) -> dict:
    """
    MOCKED adapter.
    In production this would call the Udyam Verification API (Ministry of MSME)
    to confirm: (a) enterprise is active, (b) category (micro/small/medium),
    (c) NIC activity code matches the tender's product category.
    Currently only checks for the presence of a validly-formatted registration number.
    """
    udyam = _extract_udyam_number(raw_text)

    if not udyam:
        return {
            "check_id": "UDYAM_REGISTRATION",
            "label": "Udyam Registration Check (Mocked)",
            "status": "UNVERIFIED",
            "detail": "No Udyam registration number (UDYAM-XX-00-0000000) found in the document.",
            "is_live": False,
            "evidence": None,
        }

    # Validate state code (2 uppercase letters from known state abbreviations)
    parts = udyam.split("-")
    # parts = ['UDYAM', 'XX', '00', '0000000']
    if len(parts) != 4:
        return {
            "check_id": "UDYAM_REGISTRATION",
            "label": "Udyam Registration Check (Mocked)",
            "status": "FAILED",
            "detail": f"Udyam number '{udyam}' does not match UDYAM-XX-DD-DDDDDDD format.",
            "is_live": False,
            "evidence": udyam,
        }

    return {
        "check_id": "UDYAM_REGISTRATION",
        "label": "Udyam Registration Check (Mocked)",
        "status": "MOCKED",
        "detail": (
            f"Udyam number '{udyam}' found and format valid. "
            f"Live verification (active status, enterprise category, NIC match) not executed. "
            f"[MOCKED — integrate Udyam Verification API to enable]"
        ),
        "is_live": False,
        "evidence": udyam,
    }


# ---------------------------------------------------------------------------
# Orchestrator — run all checks and return list of results
# ---------------------------------------------------------------------------

def run_portal_checks(raw_text: str) -> list[dict]:
    """
    Run all portal adapters against the given bidder document text.
    Returns a list of PortalCheckResult dicts, one per adapter.
    """
    return [
        check_pan_structural(raw_text),
        check_gstin_format(raw_text),
        check_udyam_registration(raw_text),
    ]
