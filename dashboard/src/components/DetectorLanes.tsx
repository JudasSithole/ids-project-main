"use client";
import type { CSSProperties, ReactNode } from "react";
import { detectorKeys, detectorNames, outcome, type Flow, type ReplayData } from "@/lib/types";
import { Icon } from "./Icons";

const terminalY = [56, 120, 184, 248];

export default function DetectorLanes({ flow, data, revealed, blocking, speed, paused, footer }: {
  flow: Flow | undefined; data: ReplayData; revealed: boolean; blocking: boolean;
  speed: number; paused: boolean; footer: ReactNode;
}) {
  const seed = flow?.id ?? "IDS-RESEARCH-REPLAY";
  return <div className={`network hero-network ${flow ? "has-flow" : ""} ${paused ? "animation-paused" : ""}`} style={{ "--travel-time": `${1400 / speed}ms`, "--entry-time": `${500 / speed}ms`, "--wire-delay": `${240 / speed}ms` } as CSSProperties}>
    <div className="flow-diagram">
      <div className="input-column">
        <span className="micro input-label">01 / RECORDED INPUT</span>
        <div className="input-card">
          <div className="input-corner corner-tl"/><div className="input-corner corner-br"/>
          <svg key={seed} className="packet-field" viewBox="0 0 190 190" aria-hidden="true">
            {Array.from({ length: 784 }, (_, i) => {
              const n = (i * 73 + seed.charCodeAt(i % seed.length) * 29 + Math.floor(i / 28) * 19) % 101;
              return <rect key={i} x={5 + (i % 28) * 6.5} y={5 + Math.floor(i / 28) * 6.5} width={4.5} height={4.5} className={n < 26 ? "packet-lit" : n < 43 ? "packet-mid" : "packet-dim"} style={{ animationDelay: `${(i % 28) * 12}ms` }}/>
            })}
          </svg>
          <div className="input-identity"><span className="input-caption">ANONYMOUS NETWORK FLOW</span><strong className="flow-id" data-testid="flow-id">{flow?.id ?? "AWAITING FLOW"}</strong><span className="input-status"><span className="small-square"/>{flow ? "Recorded features · 77 inputs" : "Held-out traffic · ready to replay"}</span></div>
        </div>
        <span className="input-footnote">CICIDS2017 / FRIDAY TEST SPLIT</span>
      </div>
      <svg key={seed} className="flow-wires" viewBox="0 0 720 360" preserveAspectRatio="none" aria-hidden="true">
        <g className="feature-feeders"><path d="M191 66H225L330 175H400"/><path d="M191 111H250L330 175"/><path d="M191 175H400"/><path d="M191 220H250L330 175"/><path d="M191 270H225L330 175"/>
          <rect x="223" y="64" width="3" height="3"/><rect x="248" y="109" width="3" height="3"/><rect x="248" y="218" width="3" height="3"/><rect x="223" y="268" width="3" height="3"/>
        </g>
        <path className="input-trunk" d="M191 175H400"/>
        <rect className="input-pulse" x="-3" y="-3" width="6" height="6" style={{ offsetPath: 'path("M191 175H400")' }}/>
        <g className="replay-junction"><rect x="395" y="170" width="10" height="10"/><rect className="junction-outline" x="389" y="164" width="22" height="22"/><text x="400" y="143" textAnchor="middle">SAME RECORDED FLOW</text><text x="400" y="207" textAnchor="middle">04 INDEPENDENT DECISIONS</text></g>
        {detectorKeys.map((key, index) => {
          const d = flow?.decisions[key];
          const y = terminalY[index];
          const route = `M400 175H443L560 ${y}H720`;
          const state = !flow ? "waiting" : d?.flagged === null ? "unknown" : d?.flagged && blocking ? "blocked" : "continues";
          return <g key={key} className={`signal-channel ${state}`} data-detector={key}>
            <path className="signal-wire" d={route}/><rect className="wire-node" x="557" y={y - 3} width="6" height="6"/>
            <rect className="traveller" x="-3" y="-3" width="6" height="6" style={{ offsetPath: `path("${route}")` }}/>
            <path className="signal-arrow" d={`M711 ${y - 4}L715 ${y}L711 ${y + 4}`}/>
            {state === "blocked" && <g className="wire-gate"><path d={`M708 ${y - 12}V${y + 12}`}/><path d={`M715 ${y - 4}l7 8m0-8-7 8`}/></g>}
            <text x="578" y={y - 13}>{String(index + 1).padStart(2, "0")} / {key === "nn" ? "MLP" : key.toUpperCase()}</text>
          </g>;
        })}
      </svg>
      <span className="diagram-footnote"><span/>ONE INPUT. FOUR PATHS. NO LIVE TRAFFIC.</span>
    </div>
    <div className="decision-output">
      <div className="output-heading"><span>DETECTOR OUTPUT</span><span>DECISION / POLICY</span></div>
      <div className="lanes" aria-label="Four independent detector decisions">
        {detectorKeys.map((key, index) => {
          const decision = flow?.decisions[key];
          const unknown = decision?.flagged === null;
          const flagged = decision?.flagged === true;
          const blocked = flagged && blocking;
          const state = !flow ? "waiting" : unknown ? "unknown" : flagged ? "flagged" : "allowed";
          const status = !flow ? "Awaiting flow" : unknown ? "Unavailable" : blocked ? "Simulated block" : flagged ? "Alert · continues" : "Allowed";
          return <article key={key} className={`lane ${state} ${blocked ? "blocked" : ""}`} data-testid={`lane-${key}`} data-decision={!flow ? "waiting" : unknown ? "unknown" : flagged ? "alert" : "allow"}>
            <div className="detector-name"><span className="lane-number">0{index + 1}</span><div><h2>{detectorNames[key]}</h2><span>{key === "snort" ? "SIGNATURE BASELINE" : key === "nn" ? "MULTILAYER PERCEPTRON" : "MACHINE LEARNING"}</span></div></div>
            <div className="score-block">{key === "snort" ? <><span className="score-label">RECORDED MATCH</span><strong className="snort-match">{!flow ? "—" : unknown ? "Unavailable" : flagged ? "Matched alert" : "No matched alert"}</strong></> : <><span className="score-label">SCORE / THRESHOLD</span><strong><span data-testid={`score-${key}`}>{decision?.score == null ? "—" : decision.score.toFixed(4)}</span><span className="threshold"> / {data.thresholds[key].toFixed(2)}</span></strong></>}</div>
            <div className="lane-verdict"><span className={`verdict ${state}`}><Icon name={!flow ? "network" : unknown ? "unknown" : flagged ? blocked ? "cross" : "alert" : "check"}/>{status}</span><span className={`outcome ${revealed ? "revealed" : ""}`}>{flow && revealed ? outcome(flow, key) : !flow ? "Advance a recorded flow" : "Actual label hidden"}</span></div>
          </article>;
        })}
      </div>
      {footer}
    </div>
  </div>;
}
