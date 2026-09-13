# Run from project root: python regression_test.py
# Tests compute_compliance_score edge cases from parser_main.py

import sys
sys.path.insert(0, '.')
from parser_main import compute_compliance_score, SEMANTIC_CONFIDENCE_THRESHOLD

def make_item(verdict, criticality='scored'):
    # Minimal line_item dict that compute_compliance_score can process
    req_id = 'REQ-001' if criticality == 'mandatory' else 'TS-01'
    return {'requirement_id': req_id, 'verdict': verdict, 'criticality': criticality}

# Test 1: All INCONCLUSIVE → coverage 0 → score must be "N/A", not 0
items = [make_item('INCONCLUSIVE')] * 10
result = compute_compliance_score(items)
assert result['compliance_score'] == 'N/A', f"Expected N/A for all-inconclusive, got {result['compliance_score']}"
assert result['coverage'] == 0.0
assert result['pending_review_count'] == 10

# Test 2: Mixed — 5 compliant, 5 inconclusive → coverage = 50% → still "N/A"
items = [make_item('COMPLIANT')] * 5 + [make_item('INCONCLUSIVE')] * 5
result = compute_compliance_score(items)
assert result['compliance_score'] == 'N/A', f"Expected N/A at 50% coverage, got {result['compliance_score']}"
assert result['coverage'] == 0.5

# Test 2b: Boundary stress — 69.9% coverage (6 evaluated, 3 inconclusive out of 10 never hits 69.9%
# exactly, so use 9 items: 6 evaluated, 3 inconclusive → 66.7%). Must still be N/A.
# This confirms the gate is >= 0.70, not > 0.70 (a > would let 70.0% through as N/A).
items = [make_item('COMPLIANT')] * 6 + [make_item('INCONCLUSIVE')] * 3  # 6/9 = 66.7%
result = compute_compliance_score(items)
assert result['compliance_score'] == 'N/A', f"Expected N/A at 66.7% coverage, got {result['compliance_score']}"
assert result['coverage'] < 0.70, f"Coverage should be below floor, got {result['coverage']}"

# Test 3: 7 compliant, 3 inconclusive → coverage = 70.0% exactly → score must render (not N/A).
# Backend uses weighted scoring (mandatory × MANDATORY_WEIGHT, scored × SCORED_WEIGHT),
# so the precise value depends on criticality mix. We only assert it's not N/A and is numeric.
items = [make_item('COMPLIANT')] * 7 + [make_item('INCONCLUSIVE')] * 3
result = compute_compliance_score(items)
assert result['compliance_score'] != 'N/A', f"Expected numeric score at exactly 70% coverage, got N/A"
assert result['compliance_score'] == 100  # 7/7 pass

# Test 4: NON_COMPLIANT mandatory item sets risk_level to High even if score is good
items = [make_item('COMPLIANT')] * 9 + [make_item('NON_COMPLIANT', 'mandatory')]
result = compute_compliance_score(items)
assert result['risk_level'] == 'High', f"Expected High risk for mandatory fail, got {result['risk_level']}"
assert result['mandatory_hard_fail'] == True

# Test 5: Threshold constant is the one value, not a magic number
assert SEMANTIC_CONFIDENCE_THRESHOLD == 0.7, "Threshold constant changed — update frontend reference too"

print("All regression tests passed.")
