#!/usr/bin/env python3
"""Analyze independent held-out JournalGuard claim labels (Python standard library).

Usage: python research/journalguard/evaluate.py PATH_TO_ADJUDICATED_PREDICTIONS.csv
The supplied template is deliberately EMPTY and cannot generate a score.
"""
import collections
import csv
import json
import math
import sys

LABELS = {"supported", "contradicted", "unknown", "not_applicable"}
REQUIRED = {"case_id", "claim_id", "gold_label", "prediction_label",
            "adjudicator_a_label", "adjudicator_b_label", "gold_evidence_url",
            "prediction_commit", "claim_schema"}

def wilson(count, total):
    if not total:
        return None
    z = 1.959963984540054
    p = count / total
    denom = 1 + z*z/total
    center = (p + z*z/(2*total)) / denom
    half = z * math.sqrt(p*(1-p)/total + z*z/(4*total*total)) / denom
    return {"estimate": round(p, 6), "lower95": round(center-half, 6),
            "upper95": round(center+half, 6), "numerator": count, "denominator": total}

def summarize(items):
    decidable = [x for x in items if x["gold_label"] in ("supported", "contradicted")]
    decisive = [x for x in decidable if x["prediction_label"] in ("supported", "contradicted")]
    supported = [x for x in decidable if x["gold_label"] == "supported"]
    contradictory = [x for x in decidable if x["gold_label"] == "contradicted"]
    predicted_contradictions = [x for x in decisive if x["prediction_label"] == "contradicted"]
    wrong = sum(x["gold_label"] != x["prediction_label"] for x in decisive)
    true_positives = sum(x["gold_label"] == "contradicted" and
                         x["prediction_label"] == "contradicted" for x in decidable)
    false_accusations = sum(x["prediction_label"] == "contradicted" for x in supported)
    confusion = {gold: {pred: sum(x["gold_label"] == gold and
                                   x["prediction_label"] == pred for x in items)
                         for pred in sorted(LABELS)}
                 for gold in sorted(LABELS)}
    return {
        "total_claim_rows": len(items),
        "reference_decidable": len(decidable),
        "reference_unknown": sum(x["gold_label"] == "unknown" for x in items),
        "annotation_agreement": wilson(
            sum(x["adjudicator_a_label"] == x["adjudicator_b_label"] for x in items),
            len(items)),
        "coverage": wilson(len(decisive), len(decidable)),
        "selective_error": wilson(wrong, len(decisive)),
        "contradiction_precision": wilson(true_positives, len(predicted_contradictions)),
        "contradiction_recall_abstentions_as_misses": wilson(true_positives, len(contradictory)),
        "false_accusation_rate_abstentions_in_denominator": wilson(false_accusations, len(supported)),
        "prediction_unknown_fraction": wilson(sum(x["prediction_label"] == "unknown" for x in items), len(items)),
        "confusion_counts": confusion,
    }

def main(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not REQUIRED <= set(reader.fieldnames or ()):
            raise SystemExit("Missing columns: " + ", ".join(sorted(REQUIRED - set(reader.fieldnames or ()))))
        rows = list(reader)
    if not rows:
        raise SystemExit("NO EVALUATION RESULTS: input is an empty template, not empirical data.")
    observed = set()
    for row in rows:
        key = (row["case_id"].strip(), row["claim_id"].strip())
        if not all(key) or key in observed:
            raise SystemExit("Missing or repeated (case_id,claim_id): " + repr(key))
        observed.add(key)
        for field in ("gold_label", "prediction_label", "adjudicator_a_label", "adjudicator_b_label"):
            if row[field] not in LABELS:
                raise SystemExit("Invalid or missing " + field + " at " + repr(key))
        if not row["gold_evidence_url"].strip() or not row["prediction_commit"].strip():
            raise SystemExit("Missing authoritative evidence URL or frozen prediction commit at " + repr(key))
        if row["claim_schema"] != "journalguard.claims.v1":
            raise SystemExit("Unsupported claim schema at " + repr(key))
    claims = sorted(set(x["claim_id"] for x in rows))
    report = {
        "status": "EMPIRICAL_RAW_LABELS_PRESENT_NOT_INDEPENDENTLY_VERIFIED_BY_SCRIPT",
        "source_path": path, "distinct_cases": len(set(x["case_id"] for x in rows)),
        "overall": summarize(rows),
        "by_claim": {claim: summarize([x for x in rows if x["claim_id"] == claim]) for claim in claims},
        "uncertainty_note": "Wilson intervals shown are descriptive only and DO NOT adjust for correlated claims within a journal. Primary publication intervals require journal-cluster bootstrap.",
    }
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python research/journalguard/evaluate.py labeled_predictions.csv")
    main(sys.argv[1])
