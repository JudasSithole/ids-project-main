#!/usr/bin/env python3
"""Independent, read-only checks for the dashboard's public research exports."""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "dashboard/public/data"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def close(a, b):
    if not math.isclose(float(a), float(b), rel_tol=0, abs_tol=1e-12):
        raise AssertionError(f"Numbers differ: {a} vs {b}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact-root", type=Path, help="Optional reproducibility root with saved initial_test prediction arrays")
    args = parser.parse_args()
    replay, results = read(PUBLIC / "replay.json"), read(PUBLIC / "results.json")
    assert sorted(p.name for p in PUBLIC.iterdir()) == ["replay.json", "results.json"]
    with (ROOT / "evaluation_final/detection_metrics_friday_both_thresholds.csv").open(newline="", encoding="utf-8") as stream:
        csv_rows = {row["model"]: row for row in csv.DictReader(stream)}
    for detector in results["detectors"]:
        key, cm = detector["key"], detector["matrix"]
        assert sum(cm.values()) == 123161
        assert cm["tn"] + cm["fp"] == 79144 and cm["fn"] + cm["tp"] == 44017
        values = {"precision": cm["tp"] / (cm["tp"] + cm["fp"]), "recall": cm["tp"] / (cm["tp"] + cm["fn"]),
                  "f1": 2 * cm["tp"] / (2 * cm["tp"] + cm["fp"] + cm["fn"]), "fpr": cm["fp"] / (cm["fp"] + cm["tn"])}
        for metric, value in values.items(): close(value, detector["metrics"][metric])
        if key != "snort":
            original = csv_rows[key]
            for name, n in cm.items(): assert n == int(original["validation_selected_" + name])
            for name, n in detector["metrics"].items(): close(n, original["validation_selected_" + name])
            close(detector["threshold"], original["validation_selected_threshold"])
        else:
            original = read(ROOT / "reports/snort_friday_evaluation_final.json")
            assert cm == original["confusion_matrix"]
            for name, n in detector["metrics"].items(): close(n, original[name])
    for resource in results["resources"]:
        original = read(ROOT / "reports" / resource["source"])
        close(resource["peakMemoryMib"], original["sampled_peak_process_rss_mib"])
        if resource["key"] == "snort":
            close(resource["cpuPercent"], original["sampled_mean_cpu_percent_sum"])
            close(resource["throughput"], original["pcap_mb_per_second"])
            assert resource["throughputUnit"] == "MiB/s PCAP"
        else:
            close(resource["cpuPercent"], 100 * sum(r["cpu_seconds"] for r in original["runs"]) / sum(r["wall_seconds"] for r in original["runs"]))
            close(resource["throughput"], original["rows_per_second_at_median_time"])
    ids = set()
    for flow in replay["flows"]:
        assert set(flow) == {"id", "label", "category", "decisions"}
        assert flow["id"] not in ids
        ids.add(flow["id"])
        for key, decision in flow["decisions"].items():
            assert set(decision) == {"score", "flagged"}
            if key != "snort":
                assert (decision["score"] is None) == (decision["flagged"] is None)
                if decision["score"] is not None:
                    assert 0 <= decision["score"] <= 1
                    assert decision["flagged"] == (decision["score"] >= replay["thresholds"][key])
    if args.artifact_root and replay["flows"]:
        import numpy as np
        verified = 0
        for key in ("rf", "xgb", "nn"):
            with np.load(args.artifact_root / "reports/initial_test" / f"{key}_test_predictions.npz") as saved:
                lookup = {"F-" + hashlib.sha256(f"{replay['datasetSha256']}:{row}".encode()).hexdigest()[:10].upper(): i for i, row in enumerate(saved["cleaned_dataset_row_indices"])}
                for f in replay["flows"]:
                    if f["decisions"][key]["score"] is None: continue
                    i = lookup[f["id"]]
                    assert f["decisions"][key]["score"] == float(saved["attack_probabilities"][i])
                    assert (f["label"] == "attack") == bool(saved["true_labels"][i])
                    verified += 1
        print(f"Independently verified {verified} exported ML scores and labels against saved prediction arrays.")
    # Missing-evidence export is isolated and must not mutate the real exports.
    before = {p.name: p.read_bytes() for p in PUBLIC.iterdir()}
    with tempfile.TemporaryDirectory(prefix="ids-export-check-") as temp:
        subprocess.run([sys.executable, str(ROOT / "tools/export_dashboard_replay.py"), "--results-only", "--output", temp], check=True, capture_output=True)
        empty = read(Path(temp) / "replay.json")
        assert empty["status"] == "unavailable" and empty["flows"] == [] and empty["missing"]
    assert before == {p.name: p.read_bytes() for p in PUBLIC.iterdir()}
    print("PASS: four full-Friday matrices, final CSV/JSON metrics, CPU aggregation, RSS, throughput units, anonymous schema, threshold decisions, and missing-input export.")


if __name__ == "__main__":
    main()
