"use client";
import type { Scenario } from "@/lib/types";
import { Icon } from "./Icons";
export type ControlsProps = {
  playing: boolean; blocking: boolean; speed: number; scenario: Scenario; guided?: boolean;
  disabled: boolean; atEnd: boolean; onNext: () => void; onPlay: () => void;
  onReset: () => void; onBlock: () => void; onSpeed: (speed: number) => void;
  onScenario: (scenario: Scenario) => void; onEnterGuided?: () => void;
};
export default function ReplayControls(p: ControlsProps) {
  return <section className="controls" aria-label="Presenter controls">
    <div className="transport">
      <button className="button primary" onClick={p.onNext} disabled={p.disabled || p.atEnd} aria-keyshortcuts="ArrowRight N"><Icon name="next"/>Next flow <kbd>→</kbd></button>
      <button className="button" onClick={p.onPlay} disabled={p.disabled || p.atEnd} aria-keyshortcuts="Space"><Icon name={p.playing ? "pause" : "play"}/>{p.playing ? "Pause" : "Play"}</button>
      <button className="button reset-button" onClick={p.onReset} aria-keyshortcuts="R"><Icon name="reset"/>Reset</button>
    </div>
    <label className="select-label">Speed<select value={p.speed} onChange={e => p.onSpeed(Number(e.target.value))} aria-label="Animation speed"><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
    <label className="select-label scenario-label">Scenario<select value={p.guided ? "guided" : p.scenario} onChange={e => { if (e.target.value === "guided" && !p.guided) { p.onEnterGuided?.(); } else if (e.target.value !== "guided") p.onScenario(e.target.value as Scenario); }} aria-label="Scenario"><option value="guided">Guided walkthrough</option><option value="mixed">Mixed sample</option><option value="disagreement">Detector disagreement</option><option value="benign">Benign traffic</option><option value="ddos">DDoS</option><option value="port-scan">Port scanning</option><option value="missed">Missed attacks</option><option value="false-alarm">False alarms</option></select></label>
    <button className="policy-control" role="switch" aria-checked={p.blocking} onClick={p.onBlock} aria-keyshortcuts="B"><span className={`switch ${p.blocking ? "on" : ""}`}><span/></span><span>Simulate blocking</span><span className="policy-value">{p.blocking ? "ON" : "OFF"}</span></button>
  </section>;
}
