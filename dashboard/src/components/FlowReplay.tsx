"use client";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { detectorKeys, matchesScenario, type ReplayData, type Scenario } from "@/lib/types";
import { guidedCases, type AudienceGuess } from "@/lib/presentation";
import DetectorLanes from "./DetectorLanes";
import ReplayControls from "./ReplayControls";
import DecisionExplanation from "./DecisionExplanation";
import PresentationCases, { AudienceDiscussion } from "./PresentationCases";
import { Icon } from "./Icons";

type Entry = { id: string; revealed: boolean };
type State = { index: number; playing: boolean; revealed: boolean; blocking: boolean; speed: number; scenario: Scenario; history: Entry[]; manual: boolean; mode: "free" | "guided"; guess: AudienceGuess | null };
const initial: State = { index: -1, playing: false, revealed: false, blocking: false, speed: 1, scenario: "mixed", history: [], manual: true, mode: "free", guess: null };
type Action = { type: "next" | "play"; ids: string[] } | { type: "reveal" | "reset" | "block" | "free" } | { type: "speed"; value: number } | { type: "scenario"; value: Scenario } | { type: "case"; index: number; ids: string[] } | { type: "guess"; value: AudienceGuess };
function advance(state: State, ids: string[], manual: boolean): State {
  if (state.index >= ids.length - 1) return { ...state, playing: false };
  const index = state.index + 1;
  return { ...state, index, revealed: false, guess: null, manual: manual || index === ids.length - 1,
    playing: index === ids.length - 1 ? false : state.playing,
    history: [...state.history, { id: ids[index], revealed: false }].slice(-40) };
}
export function replayReducer(state: State, action: Action): State {
  switch (action.type) {
    case "next": return advance(state, action.ids, !state.playing);
    case "play":
      if (state.playing) return { ...state, playing: false, manual: false };
      if (!action.ids.length || state.index === action.ids.length - 1) return state;
      return state.index < 0 ? advance({ ...state, playing: true }, action.ids, false) : { ...state, playing: true, manual: false };
    case "reveal": return state.index < 0 ? state : { ...state, revealed: true, history: state.history.map((e, i) => i === state.history.length - 1 ? { ...e, revealed: true } : e) };
    case "reset": return { ...initial, mode: state.mode, scenario: state.scenario, speed: state.speed, blocking: state.blocking };
    case "block": return { ...state, blocking: !state.blocking };
    case "speed": return { ...state, speed: action.value };
    case "scenario": return { ...initial, scenario: action.value, speed: state.speed, blocking: state.blocking };
    case "free": return { ...initial, speed: state.speed, blocking: state.blocking };
    case "case": {
      const id = action.ids[action.index];
      if (!id) return state;
      return { ...state, mode: "guided", scenario: "mixed", index: action.index,
        playing: false, revealed: false, guess: null, manual: true,
        history: [...(state.mode === "guided" ? state.history : []), { id, revealed: false }].slice(-40) };
    }
    case "guess": return state.revealed || state.index < 0 ? state : { ...state, guess: action.value };
  }
}

export default function FlowReplay({ data }: { data: ReplayData }) {
  const [state, dispatch] = useReducer(replayReducer, initial);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [flowAnimate, setFlowAnimate] = useState(false);
  const cases = useMemo(() => guidedCases(data), [data]);
  const caseIds = useMemo(() => cases.map(c => c.flow.id), [cases]);
  const flows = useMemo(() => state.mode === "guided" ? cases.map(c => c.flow) : data.flows.filter(f => matchesScenario(f, state.scenario)), [data.flows, state.scenario, state.mode, cases]);
  const ids = useMemo(() => flows.map(f => f.id), [flows]);
  const current = flows[state.index];
  const activeCase = state.mode === "guided" ? cases[state.index] : undefined;
  const atEnd = flows.length > 0 && state.index === flows.length - 1;
  const next = useCallback(() => dispatch({ type: "next", ids }), [ids]);
  const play = useCallback(() => dispatch({ type: "play", ids }), [ids]);
  useEffect(() => {
    if (!state.playing) return;
    const timer = window.setTimeout(next, 5000 / state.speed);
    return () => window.clearTimeout(timer);
  }, [state.playing, state.speed, state.index, next]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey || (event.target instanceof HTMLElement && (event.target.closest("button, input, select, textarea, a, dialog") || event.target.isContentEditable))) return;
      const key = event.key.toLowerCase();
      if (["arrowright", "n", " ", "r", "l", "b"].includes(key)) event.preventDefault();
      if (key === "arrowright" || key === "n") next();
      if (key === " ") play();
      if (key === "r") dispatch({ type: "reset" });
      if (key === "l") dispatch({ type: "reveal" });
      if (key === "b") dispatch({ type: "block" });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, play]);
  const flags = current ? detectorKeys.filter(k => current.decisions[k].flagged === true).length : 0;
  const known = current ? detectorKeys.filter(k => current.decisions[k].flagged !== null).length : 0;
  const disagreement = current && flags > 0 && flags < known;
  useEffect(() => { setExplanationOpen(false); }, [current?.id]);
  useEffect(() => {
    setFlowAnimate(false);
    requestAnimationFrame(() => setFlowAnimate(true));
  }, [current?.id]);

  return <main id="main" className="replay-page reference-replay">
    <section className="replay-hero" aria-label="Interactive detector replay">
    <div className="hero-meta"><div className="eyebrow"><span className="blue-square"/> CICIDS2017 / FRIDAY · OFFLINE REPLAY</div><div className="hero-meta-right"><span className="offline-badge"><span/>Offline ready</span><div className="replay-mode" role="group" aria-label="Replay mode"><button aria-pressed={state.mode === "free"} onClick={() => dispatch({ type: "free" })}>Free replay</button><button aria-pressed={state.mode === "guided"} disabled={!cases.length} onClick={() => dispatch({ type: "case", index: 0, ids: caseIds })}>Guided walkthrough <span>{cases.length}</span></button></div></div></div>
    <div className="page-heading hero-intro"><div className="hero-title"><h1>One flow.<br/>Four perspectives<span className="blue-text">.</span></h1><span className="hero-title-note">BEHAVIOUR. SIGNATURES. A DIFFERENT POINT OF VIEW.</span></div><div className="hero-console"><p>Send the same recorded network flow through four detectors. Compare their decisions, then reveal the truth.</p><ReplayControls playing={state.playing} blocking={state.blocking} speed={state.speed} scenario={state.scenario} guided={state.mode === "guided"} disabled={flows.length === 0} atEnd={atEnd} onNext={next} onPlay={play} onReset={() => dispatch({ type: "reset" })} onBlock={() => dispatch({ type: "block" })} onSpeed={value => dispatch({ type: "speed", value })} onScenario={value => dispatch({ type: "scenario", value })} onEnterGuided={() => dispatch({ type: "case", index: 0, ids: caseIds })}/></div></div>
    <section className={`comparison-panel ${flowAnimate ? "flow-fade" : ""}`} aria-labelledby="comparison-title">
      <div className="panel-heading"><div><h2 id="comparison-title">Detector comparison</h2><span className={`panel-description ${activeCase ? "guided-description" : ""}`}>{activeCase ? `Case ${state.index + 1} / ${cases.length} · ${activeCase.title}` : state.mode === "guided" ? "Guided walkthrough · advance the first case" : `DEMO SAMPLE / ${data.flows.length} RECORDED FLOWS`}</span></div><div className="comparison-meta"><button className="button explain-button" disabled={!current} onClick={() => setExplanationOpen(true)}><Icon name="unknown"/>Explain decisions</button><span className={`play-state ${state.playing ? "running" : ""}`}><span/>{state.playing ? "Playing" : atEnd ? "Sample complete" : "Paused"}</span><span className="mono">{String(Math.max(state.index + 1, 0)).padStart(2, "0")} <span className="muted">/ {String(flows.length).padStart(2, "0")}</span></span></div></div>
      <DetectorLanes flow={current} data={data} revealed={state.revealed} blocking={state.blocking} speed={state.speed} paused={!state.playing && !state.manual} footer={
        <div className="label-reveal" aria-live="polite"><div className="label-lock"><div><span className="micro">ACTUAL DATASET LABEL</span><strong data-testid="actual-label">{!current ? "Ready when you are" : state.revealed ? current.label === "benign" ? "Benign traffic" : `Attack · ${current.category}` : "Hidden. Compare, then reveal."}</strong></div></div><div className="label-actions"><button className="button reveal-button" onClick={() => dispatch({ type: "reveal" })} disabled={!current || state.revealed} aria-keyshortcuts="L"><Icon name="eye"/>{state.revealed ? "Label revealed" : "Reveal actual label"}<kbd>L</kbd></button></div></div>
      }/>
    </section>
    <div className="replay-caption" aria-live="polite"><span>{!flows.length ? data.flows.length ? "No recorded examples match this scenario. Choose another filter." : "Replay unavailable — original flow evidence has not been exported." : atEnd ? "End of sample. Reset to replay this selection." : disagreement && !state.revealed ? `${flags} of ${known} available detectors flagged this flow. Pause here, then reveal the label.` : current ? `${flags} of ${known} available detectors flagged this flow.` : "Start with Next flow. Playback begins paused."}</span><span><span className="caption-square"/>Animation speed is a presenter control, not detection latency.</span></div>
    {state.scenario !== "mixed" && <p className="filter-note">Category and outcome filters can imply the actual label. Use Mixed sample for a blind comparison.</p>}
    {data.missing.length > 0 && <aside className="evidence-notice"><strong>{data.status === "unavailable" ? "Replay evidence unavailable" : "Some detector evidence is unavailable"}</strong><p>{data.missing.join(". ")}. See dashboard/README.md for the export command.</p></aside>}
    <PresentationCases hideNotes cases={cases} current={current} activeCase={activeCase} guided={state.mode === "guided"} revealed={state.revealed} blocking={state.blocking} guess={state.guess} onCase={index => dispatch({ type: "case", index, ids: caseIds })} onGuess={value => dispatch({ type: "guess", value })}/>
    </section>
    <details className="session-details"><summary>Presenter notes & history <span>{state.history.length ? `${state.history.length} replayed` : "Audience discussion · session log"}</span></summary>
    <AudienceDiscussion current={current} activeCase={activeCase} revealed={state.revealed} blocking={state.blocking} guess={state.guess} onGuess={value => dispatch({ type: "guess", value })}/>
    <section className="history" aria-labelledby="history-title"><div className="history-heading"><h2 id="history-title">Replay history <span>{state.history.length.toString().padStart(2, "0")}</span></h2><span className="micro">RECORDED DECISIONS / SIMULATED POLICY</span></div>{state.history.length ? <ol>{[...state.history].reverse().map((entry, i) => {
      const f = data.flows.find(f => f.id === entry.id)!;
      const alerts = detectorKeys.filter(k => f.decisions[k].flagged === true).length;
      const unavailable = detectorKeys.filter(k => f.decisions[k].flagged === null).length;
      return <li key={`${entry.id}-${i}`}><span className="history-index">{String(state.history.length - i).padStart(2, "0")}</span><span className="mono">{entry.id}</span><span>{alerts} alert{alerts === 1 ? "" : "s"}{unavailable ? ` · ${unavailable} unavailable` : ""}</span><span className={entry.revealed ? "history-label" : "muted"}>{entry.revealed ? `${f.label === "attack" ? "Attack" : "Benign"} · ${f.category}` : "Label hidden"}</span></li>;
    })}</ol> : <div className="history-empty"><Icon name="network"/>Advance a flow to begin your session. Labels stay hidden until revealed.</div>}</section>
    <footer className="replay-footer"><span>UNIVERSITY OF JOHANNESBURG <span>/</span> IDS RESEARCH</span><span><kbd>→</kbd> Next <kbd>Space</kbd> Play / Pause <kbd>L</kbd> Reveal <kbd>B</kbd> Blocking <kbd>R</kbd> Reset</span></footer>
    <details className="sample-method"><summary>Demo sample selection & evidence</summary><p>{data.selection}</p><p>Demo examples explain individual decisions; use Research Results for full-population detection metrics. Blocking is a visual policy; it does not alter recorded predictions or any network traffic.</p></details>
    </details>
    {current && explanationOpen && <DecisionExplanation flow={current} data={data} revealed={state.revealed} blocking={state.blocking} onClose={() => setExplanationOpen(false)}/>}
  </main>;
}
