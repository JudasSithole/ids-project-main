import Link from "next/link";
import { resultsData } from "@/lib/data";
import ConfusionMatrices from "@/components/ConfusionMatrices";
import ResourceComparison from "@/components/ResourceComparison";
import { Icon } from "@/components/Icons";
export const dynamic = "force-dynamic";
export default async function Results() {
  const data = await resultsData();
  return <main id="main" className="results-page"><div className="results-inner">
    <div className="page-heading results-heading"><div><div className="eyebrow"><span className="blue-square"/> FULL FRIDAY EVALUATION</div><h1>From individual flows<br/>to the bigger picture<span className="blue-text">.</span></h1><p>Recorded detection performance on the same held-out traffic.</p></div><Link href="/" className="button results-back">Back to replay<Icon name="arrow"/></Link></div>
    <div className="population-strip"><div><span>HELD-OUT FRIDAY FLOWS</span><strong>{data.population.toLocaleString("en-US")}</strong></div><div><span>ACTUAL BENIGN</span><strong>{data.benign.toLocaleString("en-US")}</strong></div><div><span>ACTUAL ATTACK</span><strong>{data.attacks.toLocaleString("en-US")}</strong></div><div className="population-note"><span>ONE DATASET. FOUR DETECTORS.</span><p>CICIDS2017 · saved test split<br/>Validation-selected ML thresholds</p></div></div>
    <section className="detection-section" aria-labelledby="detection-title"><div className="results-section-heading"><div><span className="eyebrow">01 / FULL FRIDAY EVALUATION</span><h2 id="detection-title">Detection performance.</h2></div><p>Precision, recall and F1: higher is better.<br/>False-positive rate: lower is better.</p></div><div className="metrics-table-wrap"><table className="metrics-table"><thead><tr><th scope="col">Detector</th><th scope="col">Threshold</th><th scope="col">Precision</th><th scope="col">Recall</th><th scope="col">F1 score</th><th scope="col">False-positive rate</th></tr></thead><tbody>{data.detectors.map(d => <tr key={d.key}><th scope="row"><span className={`detector-dot ${d.key === "snort" ? "snort-dot" : ""}`}/>{d.name}</th><td>{d.threshold?.toFixed(2) ?? "Rule match"}</td><td>{d.metrics.precision.toFixed(4)}</td><td>{d.metrics.recall.toFixed(4)}</td><td className="f1-cell">{d.metrics.f1.toFixed(4)}</td><td>{d.metrics.fpr.toFixed(5)}</td></tr>)}</tbody></table></div><p className="table-note">Metrics are proportions (0–1). RF uses the final Friday recomputation at 0.60; older summaries use 0.35. Snort decisions use approximate alert-to-flow correlation.</p></section>
    <ConfusionMatrices detectors={data.detectors}/>
    <ResourceComparison resources={data.resources}/>
    <aside className="research-note"><span className="note-index">RESEARCH CONTEXT</span><div><p>Both benchmarks ran on the same Linux VM. ML used extracted flow features; Snort used packet captures. The historical resource run’s exact loaded Snort rules were not independently confirmed.</p><p>Snort correlation used a +61,260 s offset and ±300 s window. Decoder and layer-2 alerts may not map to flows. Single-core emulation does not establish performance on physical Raspberry Pi hardware.</p></div></aside>
    <details className="sources-details"><summary>Source artifacts & reproducibility</summary><p>Values were exported from retained final reports. Each matrix contains 123,161 flows. The small replay selection is a Demo sample and does not estimate population performance.</p><ul>{data.sources.map(s => <li key={s.file}><span>{s.file}</span><code>SHA-256 {s.sha256}</code></li>)}</ul></details>
    <footer className="results-footer"><span><span className="judas-text">JUDAS SITHOLE</span> / IDS RESEARCH</span><Link href="/">Return to offline replay <Icon name="arrow"/></Link></footer>
  </div></main>;
}
