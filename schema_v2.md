# VECTA Data Contract (Schema V2)

This document defines the canonical JSON schema for the evaluation output produced by the deterministic backend layer (`parser_main.py`) and consumed by the frontend application (`ResultsDashboard.jsx`, `IndividualBidderView.jsx`).

## `EvaluationReport`

An array of these objects is returned by the `/analyze` endpoint for each bidder.

| Field | Type | Description |
|---|---|---|
| `bid_id` | string | Unique identifier for the bid/bidder. |
| `bidder_name` | string | Extracted legal name of the bidder. |
| `summary` | object | Contains `compliant`, `non_compliant`, `inconclusive`, and `total` integer counts. |
| `compliance_score` | float | Overall percentage score (0-100). |
| `risk_level` | string | "Low", "Medium", or "High". |
| `mandatory_hard_fail` | boolean | True if any mandatory requirement failed. |
| `failed_mandatory_requirements` | array of strings | List of requirement IDs that caused the hard fail. |
| `recommendation` | string | Human-readable conclusion. |
| `human_override_applicable` | boolean | True if any item requires human review. |
| `line_items` | array of `LineItem` | The detailed evaluation results per clause. |

---

## `LineItem`

Represents the evaluation of a single tender requirement against the bidder's submission.

| Field | Type | Required | Description |
|---|---|---|---|
| `requirement_id` | string | Yes | The ID of the clause (e.g., "REQ-001"). |
| `verdict` | string | Yes | Enum: `COMPLIANT`, `NON_COMPLIANT`, `INCONCLUSIVE`, `NOT_EVALUATED`. |
| `criticality` | string | No | Enum: `mandatory`, `scoring`. |
| `reason` | string | No | Plaintext explanation of the AI's reasoning. |
| `review_reason` | string | No | Why human review is required (if applicable). |
| `requires_human_review` | boolean | No | True if the item was flagged for manual review. |
| `evidence` | object | No | The `Evidence` object containing tender and bidder context. |
| `ai_verdict` | string | No | Original verdict before human override (if applicable). |

---

## `Evidence`

Contains the source text and metadata used to reach the verdict.

| Field | Type | Required | Description |
|---|---|---|---|
| `tender` | object | No | Details about the requirement in the tender document. |
| `bidder` | object | No | Details about the extracted claim from the bidder document. |

### `tender` Object
| Field | Type | Required | Description |
|---|---|---|---|
| `text` | string | No | The exact text snippet extracted from the tender. |
| `page` | integer | No | 1-indexed page number in the tender document. |

### `bidder` Object
| Field | Type | Required | Description |
|---|---|---|---|
| `text` | string | No | The exact text snippet extracted from the bidder document. |
| `page` | integer | No | 1-indexed page number in the bidder document. |
| `method` | string | No | Extraction method (e.g., `regex`, `llm_fallback`). |
| `extracted_value` | float | No | For numeric requirements: the extracted number. |
| `required_value` | float | No | For numeric requirements: the threshold number. |
| `unit` | string | No | For numeric requirements: the unit of measurement. |
| `document_found` | boolean | No | For document presence requirements. |
| `llm_judgment` | string | No | For semantic requirements: `SATISFIES`, `DOES_NOT_SATISFY`, `UNCLEAR`. |
| `llm_reasoning` | string | No | For semantic requirements: explanation from the LLM. |
| `llm_confidence` | float | No | Confidence score (0.0 - 1.0) returned by the LLM. |
| `confidence_threshold`| float | No | The floor threshold required for compliance (e.g., 0.7). |
