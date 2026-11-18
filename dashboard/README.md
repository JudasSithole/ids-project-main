# UJ IDS research dashboard

Local Next.js + TypeScript presentation dashboard. `/` replays a small **Demo sample**; `/results` shows the **Full Friday evaluation** and **Historical VM benchmarks**. All replay decisions are recorded evidence. Simulated blocking changes the visual policy only. No VM, live detector, packet capture, external API, CDN or internet connection is required during a presentation.

## Windows setup and opening

Use PowerShell and Node.js 20.9 or newer (Node 24 was used here). From the repository root:

```powershell
cd dashboard
npm.cmd ci
npm.cmd run build
npm.cmd run open
```

`open` starts the production server on **http://127.0.0.1:3000** and opens the default browser. Keep the terminal open; Ctrl+C stops the server. If this dashboard is already running on that port, the command opens it. For a server without opening a browser, use `npm.cmd start`. For another port: `npm.cmd start -- --port 3002`.

After this one-time setup, disconnect the internet and leave the research VM switched off. Only this command is needed from `dashboard/`:

```powershell
npm.cmd run open
```

Keep `node_modules/`, `.next/` and `public/data/` on this laptop. Build again after changing application code. Data exports are read at request time; refresh the page after re-exporting. Do not run a package install during the presentation. The server binds only to loopback. All fonts are bundled from the Fontsource packages (OFL licences remain in their installed packages). There is no service worker or stale replay cache. The Next.js command wrapper disables telemetry.

## Presenter sequence

1. Start in **Mixed sample**, paused. Choose **Next flow** to send one recorded input through all four lanes.
2. Compare Random Forest, XGBoost, MLP and Snort. Score ≥ threshold raises an ML alert. Snort reports the original matched-alert outcome.
3. Pause on a disagreement. **Reveal actual label** explains each result: detected attack, missed attack, false alarm, or correctly allowed benign traffic. Advancing hides the new label. History exposes a record's class only after that record is revealed.
4. Toggle **Simulate blocking**. A flagged lane displays **Simulated block**; with policy off it displays **Alert · continues**. The recorded score and decision never change. Unknown evidence always stays unknown.
5. Use **Play/Pause**, speed and scenario filters. Filtering resets the session and pauses it. Category/outcome filters imply labels; use Mixed sample for a blind comparison. Playback stops at the last example; Reset returns to the paused start and preserves the selected filter, speed and blocking policy.

Keyboard shortcuts when focus is outside a form control or link: **→ / N** next, **Space** play/pause, **L** reveal, **B** blocking, **R** reset. Buttons and selects also support normal Tab/Enter/Space interaction. Reduced-motion preferences remove packet animations. Speed controls the illustration, never measured inference latency.

### Guided presentation and audience discussion

Choose **Guided walkthrough** beside the title for a six-case sequence using distinct real records: a quiet flow, four alerts, ML versus Snort, a lone alert, a split ML vote, and opposing decisions. It starts with the first case loaded and paused. **Next flow** advances the story; you can jump directly to a case using the cards below the main comparison. Case titles describe visible decision patterns and do not reveal the actual class. Cases without verified examples are omitted; missing evidence never creates a fictional case. **Free replay** returns to the full curated selection, paused at the start. Choosing a scenario filter also returns to free replay.

The guided discussion question appears beside the label reveal. Below the comparison, ask the audience to choose **Benign**, **Attack** or **Unsure**. This is an optional discussion prediction, not a detector or a research metric. Reveal the label to compare the audience's answer with ground truth and see the case's teaching point. Advancing, jumping, filtering or resetting clears the vote and hides the new record's label.

**Explain decisions** opens a keyboard-accessible panel with all four recorded decisions, score/threshold gauges, the completed Snort alert-match interpretation, and each lane's current policy consequence. Before reveal it preserves the hidden label; after reveal it explains detection errors and whether blocking would stop an attack or interrupt benign traffic. Escape closes it and returns focus to the opening button. The explanation describes score-to-threshold logic, not unexported feature attribution or causal reasons. There is no threshold retuning or prediction rewriting.

## One-time research export

The checked-in exports contain **24 real anonymous held-out Friday flows**, including benign, DDoS, port-scan, detector disagreements, ML misses, ML false alarms, and Snort no-match examples. No raw features, IP addresses, packet captures, model binaries or alert logs are served. Raw research artifacts remain on `D:\OdinShare`. The original experiments, paper, poster and aggregate results were not modified.

Install exporter dependencies only if re-exporting. From the repository root, with Python 3.12 (the model environment):

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r tools\dashboard-export-requirements.txt
.\.venv\Scripts\python.exe tools\export_dashboard_replay.py `
  --artifact-root "D:\OdinShare\ids_reproducibility_package\reproducibility" `
  --dataset "D:\OdinShare\ids_reproducibility_package\IDS_Reproducibility_Dataset.zip" `
  --alerts "D:\OdinShare\ids_reproducibility_package\IDS_Reproducibility_SnortAlerts.zip" `
  --labelled-dir "D:\OdinShare\GeneratedLabelledFlows\TrafficLabelling"
```

The exporter reads ZIP members directly; it does not extract the dataset or logs into the app. It verifies the dataset SHA-256 against `reports/split_report.json`, the saved split partition, model byte hashes against the retained initial test reports, 77-feature order, fitted MLP StandardScaler, class order and all three full Friday confusion matrices. It independently recomputes predictions and checks every Friday decision against saved prediction arrays when available. The export preserves original recorded scores; Linux/Windows float32 BLAS variation is allowed only up to 0.00001 **and only when every threshold decision is identical**. Observed maximum MLP score difference was 0.00000202656.

It then reuses the study's original tuple/time first-match algorithm over the **entire 123,161-flow Friday evaluation population**, before sampling. It verifies 1,617,388 alerts loaded, 74,638 matched alerts and Snort's full confusion matrix. Offset: +61,260 seconds (subtracted from alert timestamps); tolerance: ±300 seconds. Zero matches after a completed correlation means **No matched alert**. Missing correlation evidence means **Unavailable**.

Sampling is deterministic: take the first three anonymous SHA-256 IDs from each benign, DDoS, port-scan, disagreement, missed-attack, false-alarm, ML-disagreement and ML-false-alarm stratum; include the first attack missed by each ML model and agreement examples; deduplicate in order, fill by ID and cap at 24. Selection details and stratum population counts are in `replay.json`. This deliberately curated sample does not represent traffic prevalence. No prediction is derived from an aggregate matrix.

For separate artifacts, replace `--dataset` with the original `cleaned_flows.pkl`, supply `--splits "E:\research\split_indices.npz"`, and optionally `--models-dir "E:\research\models"`. `--artifact-root` expects `models/` and optional `reports/initial_test/*_test_predictions.npz`. `--alerts` also accepts the original full parsed JSON. `--sample-size` accepts 21–100, default 24.

Existing per-flow Snort evidence can replace correlation with `--snort-matches "E:\research\friday-matches.json"`. That private manifest must contain `complete: true`, `dataset_sha256`, `rows: 123161`, `cleaned_dataset_row_indices` in original Friday test order and `matched`, a boolean per row. The exporter verifies alignment and the final full matrix before sampling. Do not put that full manifest in `public/`.

If originals are missing, this command creates a working results dashboard with an explicit unavailable replay, using only the standard Python library:

```powershell
py tools\export_dashboard_replay.py --results-only
```

With a dataset and split but a missing model, that detector exports null score/decision and the UI displays Unavailable. With no alert evidence, Snort remains Unavailable. Missing inputs are named in `replay.json` and shown on the page. Invalid hashes, inconsistent feature orders, changed predictions or matrix disagreements fail the export without replacing good exports. Never replace missing evidence with made-up scores.

## Source-of-truth decisions

- **RF 0.60**, XGBoost 0.70, MLP 0.70. Detection values come from `evaluation_final/friday_recompute.json` and cross-check against `detection_metrics_friday_both_thresholds.csv`, using `validation_selected_*`. Older README and `friday_ml_tuned_subset.json` RF values use 0.35 and are not displayed.
- Snort counts and metrics: `reports/snort_friday_evaluation_final.json`. Each of the four matrices sums to **123,161** (79,144 benign, 44,017 attack). Detection precision, recall and F1 display to four decimals; FPR to five, matching the final reports' stated rounding.
- **Historical ML CPU**: `100 × sum(cpu_seconds) / sum(wall_seconds)` across the five retained runs. RF **89.21%**, XGBoost **80.00%**, MLP **75.35%**. This is not an unweighted mean of repeat percentages or a current browser measurement.
- **Historical Snort CPU**: retained mean of one-second process-tree CPU samples, **27.84%**. CPU methods are labelled separately. Peak memory is sampled process RSS in **MiB**, including data, libraries and retained allocations.
- ML benchmark workload: **503,881 validation flows**, batch 4096, one core and one thread, five repeats; loading/warmup excluded from inference timing. Throughput remains flows/s. Snort inspected the full **8.84 GB Friday PCAP**, 595.44 s. The original field is `pcap_mb_per_second`, but the original script divides by 1024²; the display correctly labels the unchanged numerical value **14.16 MiB/s PCAP**. These workloads/units do not support a direct efficiency ranking.
- Both historical benchmarks used the same Linux VM with CPU affinity. Physical Raspberry Pi hardware was not tested. The historical Snort resource run's exact loaded rules were not independently confirmed. The UI retains this limitation even though the study's baseline is named Snort 3 Community Rules.

Source filenames and SHA-256 fingerprints are included with the exports. Only the two small anonymous JSON files belong under `public/data/`. Git ignores raw artifacts, Python environments, Node dependencies, build output and captured QA artifacts; the two exports are explicitly unignored.

## Checks

From `dashboard/`:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
```

Independent export checks, from the repository root:

```powershell
.\.venv\Scripts\python.exe tools\verify_dashboard_export.py --artifact-root "D:\OdinShare\ids_reproducibility_package\reproducibility"
```

This compares displayed aggregate inputs with the final CSV/JSON reports, independently checks every exported ML score and actual binary label against saved prediction arrays, and verifies that a missing-input export is empty and does not replace the real data.

Tests use two loopback production servers (ports 4173/4174), a real replay and an isolated synthetic unknown-evidence fixture under ignored `.qa/`. The fixture is never put in `public/data/`. If no Playwright browser is installed, install it once while online: `npx.cmd playwright install chromium`. Tests prefer a cached Windows Chromium and support `PLAYWRIGHT_CHROMIUM_EXECUTABLE` for an explicit browser path.

Coverage includes all exported scores/decisions, label hiding/reveal/history, blocking invariance, pause/resume/speed, filters, keyboard controls, reset, stopping at sample end, unknown evidence, four matrices/metrics, both routes, external-request blocking, browser errors, desktop/tablet/mobile overflow, 1366 × 768 control visibility and reduced motion. It also checks six distinct real guided cases, direct case selection, mode switching, audience-vote resets and prediction invariance, explanation content before/after reveal, modal focus restoration, and guided-case availability with missing evidence. Captured renders are local in `.qa/`.

Validation on 18 November 2026: production build and TypeScript passed; twelve Playwright tests passed; all 72 exported ML scores and binary labels independently matched the saved prediction arrays; all four matrices and resource calculations passed the independent exporter check; production dependency audit reported zero vulnerabilities. Browser tests observed zero external requests. Renders were inspected at 1366 × 768, with additional automated overflow checks at 768 px and 390 px.

Research artifacts were read on Windows; neither the Linux VM nor Snort was rerun. Historical rule loading and physical-device performance cannot be independently verified from these artifacts. No manual classroom projector or physical internet disconnection test is implied by browser automation; outbound browser requests are intercepted and checked by the automated test.
