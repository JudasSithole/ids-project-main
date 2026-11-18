"use client";
import { useEffect, useRef } from "react";
import { detectorKeys, detectorNames, outcome, type Flow, type ReplayData } from "@/lib/types";
import { decisionReason, policyConsequence, revealSummary } from "@/lib/presentation";
import { Icon } from "./Icons";

export default function DecisionExplanation({ flow, data, revealed, blocking, onClose }: {
  flow: Flow; data: ReplayData; revealed: boolean; blocking: boolean; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const dismiss = () => dialog.current?.close();
  return <dialog ref={dialog} className="explanation-dialog" aria-labelledby="explanation-title" onClick={e => { if (e.target === e.currentTarget) dismiss(); }}>
    <div className="explanation-content"><div className="explanation-heading"><div><span className="eyebrow">RECORDED EVIDENCE / {flow.id}</span><h2 id="explanation-title">Why these decisions?</h2></div><button className="button explanation-close" onClick={dismiss} aria-label="Close explanation"><Icon name="cross"/></button></div>
      <p className="explanation-intro">{revealed ? revealSummary(flow, blocking) : "The actual dataset label is still hidden. These explanations show how each score or recorded match produces its decision."}</p>
      <div className="explanation-cards">{detectorKeys.map(key => {
        const d = flow.decisions[key];
        const scorePct = d.score !== null ? Math.min(Math.max(d.score, 0), 1) * 100 : 0;
        return <article key={key} className="explanation-card" data-testid={`explanation-${key}`}><div className="explanation-card-heading"><h3>{detectorNames[key]}</h3><span className={d.flagged === null ? "unknown" : d.flagged ? "alert" : "allow"}>{d.flagged === null ? "Unavailable" : d.flagged ? "Alert" : "Allow"}</span></div>
          {key !== "snort" && d.score !== null && <div className="score-visual"><div className="score-axis"><span>0</span><span>FIXED THRESHOLD {data.thresholds[key].toFixed(2)}</span><span>1</span></div><div className="score-meter" role="img" aria-label={`Recorded score ${d.score.toFixed(6)}; threshold ${data.thresholds[key].toFixed(2)}`}><span className="score-fill" style={{ width: `${scorePct}%` }}/><i className="score-threshold" style={{ left: `${data.thresholds[key] * 100}%` }}/><i className="score-point" style={{ left: `${scorePct}%` }}/></div></div>}
          <p>{decisionReason(flow, key, data)}</p><div className="explanation-policy"><span>{blocking ? "BLOCKING POLICY ON" : "ALERT-ONLY POLICY"}</span><p>{policyConsequence(flow, key, revealed, blocking)}</p></div>
          <div className="explanation-outcome">{revealed ? outcome(flow, key) : "Actual label hidden · reveal it in the replay"}</div>
        </article>;
      })}</div>
      <p className="explanation-caveat">The score explains the threshold decision; feature-level causes were not exported. Snort results use the study's approximate full-population correlation. Blocking is a visual simulation and changes no recorded prediction or network traffic.</p>
      <button className="button primary explanation-return" onClick={dismiss}>Return to replay<Icon name="arrow"/></button>
    </div>
  </dialog>;
}
