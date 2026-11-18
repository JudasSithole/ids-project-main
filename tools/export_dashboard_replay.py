#!/usr/bin/env python3
"""Export anonymous Friday replay records; never synthesize detector evidence.

Standard-library-only results export works without private research artifacts.
Optional full replay uses the original saved split, feature order and fitted models.
ZIP inputs are streamed, never unpacked into the web application.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from contextlib import contextmanager
from datetime import timedelta
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
KEYS = ("rf", "xgb", "nn", "snort")
NAMES = ("Random Forest", "XGBoost", "MLP", "Snort 3 Community Rules")
THRESHOLDS = {"rf": 0.60, "xgb": 0.70, "nn": 0.70}
FRIDAY_ROWS = 123161


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


@contextmanager
def artifact(path, suffix):
    """Open an explicit file or a unique ZIP member with the required basename."""
    path = Path(path)
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as archive:
            names = [n for n in archive.namelist() if n.endswith("/" + suffix) or n == suffix]
            if len(names) != 1:
                raise ValueError(f"Expected one {suffix} in {path.name}; found {len(names)}")
            with archive.open(names[0]) as stream:
                yield stream
    else:
        with path.open("rb") as stream:
            yield stream


def digest_stream(stream):
    h = hashlib.sha256()
    for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
        h.update(block)
    return h.hexdigest()


def source(path):
    path = Path(path)
    with path.open("rb") as stream:
        return {"file": path.name, "sha256": digest_stream(stream)}


def metrics(cm):
    tn, fp, fn, tp = (cm[k] for k in ("tn", "fp", "fn", "tp"))
    return {"precision": tp / (tp + fp), "recall": tp / (tp + fn),
            "f1": 2 * tp / (2 * tp + fp + fn), "fpr": fp / (fp + tn)}


def check_cm(cm, reported):
    if any(not isinstance(v, int) or v < 0 for v in cm.values()) or sum(cm.values()) != FRIDAY_ROWS:
        raise ValueError("Full Friday confusion matrix must sum to 123,161")
    for k, value in metrics(cm).items():
        if not math.isclose(value, reported[k], abs_tol=1e-12):
            raise ValueError(f"Source metric {k} differs from its confusion matrix")


def export_results():
    final = read_json(ROOT / "evaluation_final/friday_recompute.json")
    rows, resources, sources = [], [], []
    for key, name in zip(KEYS, NAMES):
        if key == "snort":
            path = ROOT / "reports/snort_friday_evaluation_final.json"
            data = read_json(path)
            cm = data["confusion_matrix"]
            row = {"key": key, "name": name, "threshold": None, "matrix": cm,
                   "metrics": {k: data[k] for k in metrics(cm)}, "source": path.name}
        else:
            path = ROOT / "evaluation_final/friday_recompute.json"
            data = final[key]
            assert data["validation_selected_threshold"] == THRESHOLDS[key]
            cm = {k: data["validation_selected_" + k] for k in ("tn", "fp", "fn", "tp")}
            row = {"key": key, "name": name, "threshold": THRESHOLDS[key], "matrix": cm,
                   "metrics": {k: data["validation_selected_" + k] for k in metrics(cm)}, "source": path.name}
        check_cm(row["matrix"], row["metrics"])
        rows.append(row)
        sources.append(source(path))
        bench_path = ROOT / f"reports/benchmark_{key}_constrained_pi4_1core.json"
        bench = read_json(bench_path)
        if key == "snort":
            cpu = bench["sampled_mean_cpu_percent_sum"]
            throughput = bench["pcap_mb_per_second"]
            # Original JSON calls this MB/s; the original script divides by 1024**2.
            unit = "MiB/s PCAP"
            cpu_method = "Mean of one-second process-tree CPU samples"
        else:
            runs = bench["runs"]
            cpu = 100 * sum(r["cpu_seconds"] for r in runs) / sum(r["wall_seconds"] for r in runs)
            throughput = bench["rows_per_second_at_median_time"]
            unit = "flows/s"
            cpu_method = "100 × sum(CPU seconds) / sum(wall seconds), five repeats"
        resources.append({"key": key, "name": name, "cpuPercent": cpu,
                          "peakMemoryMib": bench["sampled_peak_process_rss_mib"],
                          "throughput": throughput, "throughputUnit": unit,
                          "cpuMethod": cpu_method, "source": bench_path.name})
        sources.append(source(bench_path))
    return {"schemaVersion": 1, "population": FRIDAY_ROWS, "benign": 79144, "attacks": 44017,
            "evaluationLabel": "Full Friday evaluation", "detectors": rows,
            "resources": resources, "sources": list({s["file"]: s for s in sources}.values()),
            "notes": [
                "RF uses the final recomputation at 0.60; older summaries use 0.35.",
                "Both benchmarks ran on the same Linux VM, constrained to one core. No physical Raspberry Pi was used.",
                "ML classified 503,881 extracted validation flows; Snort inspected the full 8.84 GB Friday PCAP.",
                "The historical Snort run's exact loaded rules were not independently confirmed.",
                "ML CPU is the ratio of summed CPU seconds to summed wall seconds, not the unweighted mean of repeat percentages.",
                "Snort throughput retains the original binary byte calculation (MiB/s); its JSON field was named pcap_mb_per_second.",
                "Peak RSS includes data, libraries and allocations; model loading and warmup were excluded from ML timing.",
                "Snort detection uses approximate tuple/time correlation: offset +61,260 seconds, tolerance ±300 seconds."
            ]}


def correlate(friday, labelled_dir, alerts_path):
    """Reuse original correlation functions and first-match order on ALL Friday rows."""
    import numpy as np
    import pandas as pd
    import ijson
    spec = importlib.util.spec_from_file_location("study_correlation", ROOT / "src/correlate_snort_friday_fast.py")
    study = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(study)
    frames = []
    required = ["Source IP", "Source Port", "Destination IP", "Destination Port", "Protocol", "Timestamp", "Flow Duration"]
    for name in study.FRIDAY_FILES:
        path = labelled_dir / name
        m = pd.read_csv(path, low_memory=False, usecols=lambda c: c.strip() in required)
        m.columns = [c.strip() for c in m.columns]
        m = m.rename(columns={"Source IP": "src_ip", "Source Port": "src_port", "Destination IP": "dst_ip", "Destination Port": "dst_port", "Protocol": "proto", "Timestamp": "timestamp", "Flow Duration": "flow_duration"})
        m["source_file"] = name
        m["source_row"] = np.arange(1, len(m) + 1)
        frames.append(m)
    meta = pd.concat(frames, ignore_index=True)
    for col in ["src_port", "dst_port", "flow_duration"]:
        meta[col] = pd.to_numeric(meta[col], errors="coerce")
    meta["proto_num"] = meta["proto"].apply(study.norm_proto_to_num)
    # Preserve the study's parser, tuple order, reverse keys and first matching flow.
    meta["start_dt"] = pd.to_datetime(meta["timestamp"], errors="coerce", dayfirst=True)
    meta["end_dt"] = meta["start_dt"] + pd.to_timedelta(meta["flow_duration"].fillna(0), unit="us")
    merged = friday[["source_file", "source_row"]].merge(meta, on=["source_file", "source_row"], how="left", validate="one_to_one", sort=False)
    if len(merged) != FRIDAY_ROWS or merged["start_dt"].isna().any():
        raise ValueError("Friday metadata incomplete; Snort evidence cannot be called no-match")
    flow_index = defaultdict(list)
    for i, row in enumerate(merged.itertuples(index=False)):
        proto = int(row.proto_num) if pd.notna(row.proto_num) else None
        sp = int(row.src_port) if pd.notna(row.src_port) else None
        dp = int(row.dst_port) if pd.notna(row.dst_port) else None
        end = row.end_dt if pd.notna(row.end_dt) else row.start_dt
        for pn in [proto, None]:
            flow_index[(pn, row.src_ip, sp, row.dst_ip, dp)].append((i, row.start_dt, end))
            flow_index[(pn, row.dst_ip, dp, row.src_ip, sp)].append((i, row.start_dt, end))
    flags = np.zeros(len(friday), dtype=bool)
    loaded = matched = 0
    with artifact(alerts_path, "snort_alerts_parsed_full.json") as stream:
        for a in ijson.items(stream, "alerts.item"):
            loaded += 1
            adt = study.parse_alert_ts(a.get("timestamp", ""), year=2017)
            if adt is None:
                continue
            adt -= timedelta(seconds=61260)
            pnum = study.norm_proto_to_num(study.norm_proto(a.get("proto")))
            sip, dip = a.get("src_ip"), a.get("dst_ip")
            try: sp = int(a["src_port"]) if a.get("src_port") is not None else None
            except (ValueError, TypeError): sp = None
            try: dp = int(a["dst_port"]) if a.get("dst_port") is not None else None
            except (ValueError, TypeError): dp = None
            hit = False
            for pn in [pnum, None]:
                for k in [(pn, sip, sp, dip, dp), (pn, dip, dp, sip, sp)]:
                    for fi, start, end in flow_index.get(k, []):
                        if start - timedelta(seconds=300) <= adt <= end + timedelta(seconds=300):
                            flags[fi] = True
                            hit = True
                            break
                    if hit: break
                if hit: break
            matched += int(hit)
    expected = read_json(ROOT / "reports/snort_friday_evaluation_final.json")
    if loaded != expected["alerts_loaded"] or matched != expected["alerts_matched_to_flows"]:
        raise ValueError(f"Correlation counts differ from final report: loaded={loaded}, matched={matched}")
    return flags, {"method": "Original full-population first-match tuple/time correlation", "rows": len(friday), "alertsLoaded": loaded, "matchedAlerts": matched, "offsetSeconds": 61260, "toleranceSeconds": 300}


def calculate_matrix(y, flags):
    return {"tn": int(((y == 0) & ~flags).sum()), "fp": int(((y == 0) & flags).sum()),
            "fn": int(((y == 1) & ~flags).sum()), "tp": int(((y == 1) & flags).sum())}


def prepare_replay(args, results):
    import numpy as np
    import pandas as pd
    dataset = args.dataset
    split_path = args.splits or (dataset if dataset.suffix.lower() == ".zip" else args.artifact_root / "data/processed/split_indices.npz")
    if not dataset.exists() or not split_path.exists():
        return {"flows": [], "status": "unavailable", "missing": ["cleaned_flows.pkl and the original split_indices.npz"], "selection": "No flow-level evidence is available. Aggregate results are never converted into individual predictions."}
    with artifact(dataset, "cleaned_flows.pkl") as stream:
        dataset_hash = digest_stream(stream)
    with artifact(split_path, "split_indices.npz") as stream:
        split_hash = digest_stream(stream)
    hash_checks_path = args.artifact_root / "checks/hash_provenance_checks.json"
    if hash_checks_path.exists():
        if read_json(hash_checks_path)["split_indices_npz"]["computed_sha256"] != split_hash:
            raise ValueError("Split file hash differs from original reproducibility package")
    split_report = read_json(ROOT / "reports/split_report.json")
    if dataset_hash != split_report["dataset_sha256"]:
        raise ValueError("Dataset hash differs from original saved split report")
    print("Dataset fingerprint verified; loading held-out Friday records...", flush=True)
    with artifact(dataset, "cleaned_flows.pkl") as stream:
        data = pd.read_pickle(stream)
    with artifact(split_path, "split_indices.npz") as stream:
        with np.load(stream) as splits:
            train, val, test = [splits[k].copy() for k in ["train", "validation", "test"]]
    combined = np.concatenate([train, val, test])
    if len(np.unique(combined)) != len(data) or not np.array_equal(np.sort(combined), np.arange(len(data))):
        raise ValueError("Saved split indices do not partition this dataset")
    heldout = data.iloc[test]
    mask = heldout["source_file"].str.contains("Friday", case=False, na=False).to_numpy()
    friday = heldout[mask].copy()
    row_indices = test[mask]
    del data, heldout
    if len(friday) != FRIDAY_ROWS:
        raise ValueError("Friday population differs from final evaluation")
    y = friday["target"].to_numpy(dtype=np.uint8)
    features = read_json(ROOT / "reports/cleaning_report.json")["features"]
    X = friday[features].to_numpy(dtype=np.float32)
    if not np.isfinite(X).all():
        raise ValueError("Non-finite feature input")
    decisions, provenance, missing = {}, {}, []
    for key in ("rf", "xgb", "nn"):
        try:
            import joblib
            from threadpoolctl import threadpool_limits
            model_dir = args.models_dir or args.artifact_root / "models"
            model_path = model_dir / {"rf": "random_forest_baseline.joblib", "xgb": "xgboost_baseline.ubj", "nn": "neural_network_baseline.joblib"}[key]
            scaler = None
            if key == "xgb":
                import xgboost as xgb
                metadata = read_json(model_dir / "xgboost_baseline_metadata.json")
                model = xgb.XGBClassifier()
                model.load_model(model_path)
                model.set_params(n_jobs=2, device="cpu")
            else:
                metadata = joblib.load(model_path)
                model = metadata["model"]
                scaler = metadata.get("scaler")
                if key == "rf": model.set_params(n_jobs=2)
                if key == "nn" and scaler is None: raise ValueError("Fitted MLP scaler missing")
            model_source = source(model_path)
            expected_model_hash = read_json(ROOT / f"reports/initial_test/{key}_test.json")["model_sha256"]
            # The original RF bundle contains no dataset hash; the retained evaluation
            # ties its exact model bytes to this verified dataset instead.
            if model_source["sha256"] != expected_model_hash or metadata["features"] != features or (key != "rf" and metadata.get("dataset_sha256") != dataset_hash) or list(model.classes_) != [0, 1]:
                raise ValueError(f"{key} model fingerprint, class order or feature order differs")
            probs = np.empty(len(X), dtype=np.float64)
            with threadpool_limits(limits=2):
                for start in range(0, len(X), 4096):
                    batch = X[start:start + 4096]
                    if scaler is not None: batch = scaler.transform(batch, copy=True)
                    probs[start:start + len(batch)] = model.predict_proba(batch)[:, 1]
            if not np.isfinite(probs).all() or (probs < 0).any() or (probs > 1).any():
                raise ValueError(f"Invalid {key} probabilities")
            flags = probs >= THRESHOLDS[key]
            expected = next(d for d in results["detectors"] if d["key"] == key)["matrix"]
            if calculate_matrix(y, flags) != expected: raise ValueError(f"{key} recomputation differs from final evaluation")
            # Independently cross-check retained scores when the prediction package exists.
            pred_path = args.artifact_root / "reports/initial_test" / f"{key}_test_predictions.npz"
            saved_check = None
            if pred_path.exists():
                with np.load(pred_path) as saved:
                    if not np.array_equal(saved["cleaned_dataset_row_indices"], test) or not np.array_equal(saved["true_labels"][mask], y):
                        raise ValueError(f"{key} saved prediction order differs")
                    recorded = saved["attack_probabilities"][mask]
                    max_delta = float(np.max(np.abs(recorded - probs)))
                    if max_delta > 1e-5 or not np.array_equal(recorded >= THRESHOLDS[key], flags):
                        raise ValueError(f"{key} saved scores differ: maximum absolute delta {max_delta}; decision agreement {np.array_equal(recorded >= THRESHOLDS[key], flags)}")
                    saved_check = {**source(pred_path), "maxInferenceScoreDelta": max_delta, "absoluteTolerance": 1e-5, "allDecisionsIdentical": True}
                    # Preserve the original study's recorded scores after independent
                    # inference verification (Linux/Windows float32 BLAS can differ).
                    probs = recorded.copy()
            decisions[key] = (probs, flags)
            provenance[key] = {"model": model_source, "savedScoresChecked": saved_check, "fullMatrixVerified": True, "threshold": THRESHOLDS[key]}
            print(f"{key}: full Friday matrix and saved scores verified", flush=True)
        except (FileNotFoundError, ImportError) as exc:
            missing.append(f"{key}: {type(exc).__name__}; supply the original model bundle and exporter dependencies")
    correlation = None
    try:
        if args.snort_matches:
            saved = read_json(args.snort_matches)
            if saved.get("complete") is not True or saved.get("dataset_sha256") != dataset_hash or saved.get("rows") != FRIDAY_ROWS:
                raise ValueError("Snort matches must certify a completed full Friday correlation and dataset hash")
            if saved["cleaned_dataset_row_indices"] != row_indices.tolist() or len(saved["matched"]) != FRIDAY_ROWS or any(type(v) is not bool for v in saved["matched"]):
                raise ValueError("Snort per-flow match alignment differs")
            flags = np.array(saved["matched"], dtype=bool)
            correlation = {"method": "Saved complete full-population per-flow matches", "source": source(args.snort_matches)}
        elif args.alerts and args.labelled_dir:
            flags, correlation = correlate(friday, args.labelled_dir, args.alerts)
        else:
            flags = None
            missing.append("Snort: supply --snort-matches or both --alerts and --labelled-dir")
        if flags is not None:
            expected = next(d for d in results["detectors"] if d["key"] == "snort")["matrix"]
            if calculate_matrix(y, flags) != expected: raise ValueError("Snort correlation differs from final Friday matrix")
            decisions["snort"] = (None, flags)
            print("Snort: full Friday correlation and matrix verified", flush=True)
    except (FileNotFoundError, ImportError) as exc:
        missing.append(f"Snort: {type(exc).__name__}; full correlation inputs/dependencies missing")
    # Stable anonymous IDs derive only from saved row identity and dataset digest.
    ids = ["F-" + hashlib.sha256(f"{dataset_hash}:{i}".encode()).hexdigest()[:10].upper() for i in row_indices]
    categories = ["Benign" if int(t) == 0 else ("Port scan" if "portscan" in str(l).lower().replace(" ", "") else "DDoS" if "ddos" in str(l).lower() else str(l)) for t, l in zip(y, friday["original_label"])]
    available = [decisions[k][1] for k in KEYS if k in decisions]
    masks = [("benign", y == 0), ("ddos", np.array([c == "DDoS" for c in categories])),
             ("port_scan", np.array([c == "Port scan" for c in categories]))]
    if available:
        flags = np.array(available)
        masks += [("disagreement", flags.any(axis=0) & ~flags.all(axis=0)),
                  ("missed_attack", (y == 1) & (~flags).any(axis=0)),
                  ("false_alarm", (y == 0) & flags.any(axis=0))]
        ml_flags = np.array([decisions[k][1] for k in ("rf", "xgb", "nn") if k in decisions])
        if len(ml_flags):
            masks.append(("ml_disagreement", ml_flags.any(axis=0) & ~ml_flags.all(axis=0)))
            for key in ("rf", "xgb", "nn"):
                if key in decisions: masks.append((f"{key}_miss", (y == 1) & ~decisions[key][1]))
            masks.append(("ml_false_alarm", (y == 0) & ml_flags.any(axis=0)))
        masks.append(("agreement", flags.all(axis=0) | ~flags.any(axis=0)))
    selected, buckets = [], {}
    for name, eligible in masks:
        candidates = sorted(np.flatnonzero(eligible).tolist(), key=lambda i: ids[i])
        buckets[name] = len(candidates)
        for i in candidates[:1 if name.endswith("_miss") else 3]:
            if i not in selected: selected.append(i)
    # Round-robin categories first, then informative cases; this is curated, not prevalence representative.
    all_indices = sorted(range(len(friday)), key=lambda i: ids[i])
    for i in all_indices:
        if len(selected) >= args.sample_size: break
        if i not in selected: selected.append(i)
    selected = selected[:args.sample_size]
    flows = []
    for i in selected:
        exported = {}
        for key in KEYS:
            pair = decisions.get(key)
            exported[key] = {"score": float(pair[0][i]) if pair is not None and pair[0] is not None else None,
                             "flagged": bool(pair[1][i]) if pair is not None else None}
        flows.append({"id": ids[i], "label": "attack" if y[i] else "benign", "category": categories[i], "decisions": exported})
    return {"status": "complete" if len(decisions) == 4 else "partial", "flows": flows,
            "missing": missing, "datasetSha256": dataset_hash, "splitSha256": split_hash, "population": FRIDAY_ROWS,
            "selection": "Deterministic curated selection: first three anonymous SHA-256 IDs in benign, DDoS, port-scan, disagreement, missed-attack, false-alarm, ML-disagreement, ML-false-alarm and agreement strata, plus first ID missed by each ML detector. Deduplicate in that order, fill by ID, cap at sample size. Not representative of prevalence. No retraining or threshold selection.",
            "strataPopulationCounts": buckets, "provenance": provenance, "correlation": correlation}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact-root", type=Path, default=ROOT)
    parser.add_argument("--dataset", type=Path, help="Original cleaned_flows.pkl or dataset ZIP")
    parser.add_argument("--splits", type=Path, help="Original split_indices.npz or ZIP (defaults to dataset ZIP)")
    parser.add_argument("--models-dir", type=Path)
    parser.add_argument("--alerts", type=Path, help="Parsed full alert JSON or SnortAlerts ZIP")
    parser.add_argument("--labelled-dir", type=Path, help="Friday TrafficLabelling CSV directory")
    parser.add_argument("--snort-matches", type=Path, help="Saved complete full-Friday per-flow match manifest")
    parser.add_argument("--sample-size", type=int, default=24)
    parser.add_argument("--output", type=Path, default=ROOT / "dashboard/public/data")
    parser.add_argument("--results-only", action="store_true", help="Export aggregate results with honest unavailable replay")
    args = parser.parse_args()
    if not 21 <= args.sample_size <= 100: parser.error("sample-size must be between 21 and 100 to retain all strata")
    args.dataset = args.dataset or args.artifact_root / "data/processed/cleaned_flows.pkl"
    results = export_results()
    replay = {"status": "unavailable", "flows": [], "missing": ["Original cleaned_flows.pkl, split_indices.npz, model bundles, and per-flow Snort correlation inputs"], "selection": "Replay unavailable. Full evaluation results remain available; no individual predictions were inferred from them."}
    if not args.results_only:
        try: replay = prepare_replay(args, results)
        except ImportError as exc:
            replay["missing"].append(f"Exporter dependency missing: {exc.name}")
    replay.update({"schemaVersion": 1, "label": "Demo sample", "thresholds": THRESHOLDS})
    # Write only after all evidence checks succeed. No raw rows, tuples, paths or logs are exported.
    args.output.mkdir(parents=True, exist_ok=True)
    for name, payload in [("results", results), ("replay", replay)]:
        (args.output / f"{name}.json").write_text(json.dumps(payload, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Exported {len(replay['flows'])} anonymous flows ({replay['status']}); four verified aggregate matrices.")


if __name__ == "__main__":
    main()
