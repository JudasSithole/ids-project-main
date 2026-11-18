"use client";
import { detectorKeys, type Flow } from "@/lib/types";
import { revealSummary, type AudienceGuess, type GuidedCase } from "@/lib/presentation";
import { Icon } from "./Icons";

type PresentationProps = {
  cases: GuidedCase[]; current: Flow | undefined; activeCase: GuidedCase | undefined;
  guided: boolean; revealed: boolean; blocking: boolean; guess: AudienceGuess | null;
  onCase: (index: number) => void; onGuess: (guess: AudienceGuess) => void;
  hideNotes?: boolean;
};

export default function PresentationCases({ cases, current, activeCase, guided, revealed, blocking, guess, onCase, onGuess, hideNotes }: PresentationProps) {
  return <section className="presentation-section" aria-labelledby="presentation-title">
    <div className="history-heading"><h2 id="presentation-title">Presentation cases <span>{cases.length.toString().padStart(2, "0")}</span></h2><span className="micro">REAL RECORDED FLOWS / CHOOSE A TALKING POINT</span></div>
    <div className="case-grid">{cases.map((c, i) => <button key={c.key} className={`case-button ${guided && activeCase?.key === c.key ? "selected" : ""}`} aria-pressed={guided && activeCase?.key === c.key} onClick={() => onCase(i)}><span className="case-number">0{i + 1}</span><span>{c.title}</span><Icon name="arrow"/></button>)}</div>
    {!cases.length && <p className="no-cases">Guided cases need verified matching examples. No cases were invented from missing evidence.</p>}
    {!hideNotes && <AudienceDiscussion current={current} activeCase={activeCase} revealed={revealed} blocking={blocking} guess={guess} onGuess={onGuess}/>}
  </section>;
}

export function AudienceDiscussion({ current, activeCase, revealed, blocking, guess, onGuess }: Pick<PresentationProps, "current" | "activeCase" | "revealed" | "blocking" | "guess" | "onGuess">) {
  if (!current) return null;
  return <div className="audience-panel"><div className="audience-question"><span className="eyebrow">{revealed ? "AFTER THE REVEAL" : "ASK YOUR AUDIENCE"}</span><h3>{revealed ? current.label === "attack" ? `Recorded attack · ${current.category}` : "Recorded benign traffic" : activeCase?.question ?? "Alert or allow: what do you think the actual label will be?"}</h3><p data-testid="case-discussion">{revealed ? revealSummary(current, blocking) : `${detectorKeys.filter(k => current.decisions[k].flagged === true).length} recorded alerts${detectorKeys.some(k => current.decisions[k].flagged === null) ? `; ${detectorKeys.filter(k => current.decisions[k].flagged === null).length} unavailable decisions` : ""}. Make a prediction, then reveal the recorded label.`}</p>{revealed && activeCase && <p className="case-lesson">{activeCase.lesson}</p>}</div>
      <div className="audience-vote"><span className="micro">AUDIENCE PREDICTION</span><div role="group" aria-label="Audience prediction">{(["benign", "attack", "unsure"] as const).map(value => <button key={value} className={guess === value ? "selected" : ""} aria-pressed={guess === value} disabled={revealed} onClick={() => onGuess(value)}>{value === "benign" ? "Benign" : value === "attack" ? "Attack" : "Unsure"}</button>)}</div><p data-testid="audience-feedback">{revealed ? guess && guess !== "unsure" ? guess === current.label ? "Audience prediction matches the recorded label." : "Audience prediction differs from the recorded label." : "Use the revealed label to discuss the decisions." : guess ? `Prediction saved: ${guess}. The actual label stays hidden.` : "Optional discussion prompt, not a detector or a research result."}</p></div>
    </div>;
}
