import { detectorKeys, detectorNames, type DetectorKey, type Flow, type ReplayData } from "./types";

export type AudienceGuess = "benign" | "attack" | "unsure";
export type GuidedCase = {
  key: string; title: string; question: string; lesson: string; flow: Flow;
};

const complete = (f: Flow) => detectorKeys.every(k => f.decisions[k].flagged !== null);
const alerts = (f: Flow) => detectorKeys.filter(k => f.decisions[k].flagged === true).length;
const ml = ["rf", "xgb", "nn"] as const;

export function guidedCases(data: ReplayData): GuidedCase[] {
  const definitions = [
    { key: "quiet", title: "A quiet flow", question: "Nobody raises an alert. Does that tell us the actual label?", lesson: "Compare a unanimous allow decision with the recorded label. Agreement alone does not establish correctness.", select: (f: Flow) => complete(f) && f.label === "benign" && alerts(f) === 0 },
    { key: "four-alerts", title: "Four alerts", question: "All four flag the same flow. What changes if blocking is enabled?", lesson: "Separate the detection decision from the response policy: the recorded alert stays the same when blocking is toggled.", select: (f: Flow) => complete(f) && f.label === "attack" && alerts(f) === 4 },
    { key: "ml-snort", title: "ML versus Snort", question: "The ML models agree, but Snort differs. Which decision matches the label?", lesson: "A completed no-match correlation is evidence of this flow's recorded Snort decision. It is different from missing evidence.", select: (f: Flow) => complete(f) && f.label === "attack" && ml.every(k => f.decisions[k].flagged) && f.decisions.snort.flagged === false },
    { key: "lone-alert", title: "A lone alert", question: "One detector disagrees with the other three. Should its alert trigger a block?", lesson: "Use the dataset label to distinguish a useful alert from a false alarm, then consider the consequence of blocking that lane.", select: (f: Flow) => complete(f) && f.label === "benign" && alerts(f) === 1 && ml.some(k => f.decisions[k].flagged) },
    { key: "split-ml", title: "A split ML vote", question: "The tree models and MLP differ. Can the scores explain their decisions?", lesson: "Each model applies its own fixed validation-selected threshold. Compare score with threshold before checking the actual label.", select: (f: Flow) => complete(f) && f.label === "attack" && f.decisions.rf.flagged === true && f.decisions.xgb.flagged === true && f.decisions.nn.flagged === false },
    { key: "opposing", title: "Opposing decisions", question: "Two detectors flag this flow and two allow it. Who gets it right?", lesson: "Every lane evaluates the flow independently. The audience's majority vote and the detector split do not replace the recorded ground truth.", select: (f: Flow) => complete(f) && f.label === "attack" && f.decisions.rf.flagged === false && f.decisions.xgb.flagged === false && f.decisions.nn.flagged === true && f.decisions.snort.flagged === true }
  ];
  return definitions.flatMap(({ select, ...definition }) => {
    const flow = data.flows.find(select);
    return flow ? [{ ...definition, flow }] : [];
  });
}

export function decisionReason(flow: Flow, key: DetectorKey, data: ReplayData): string {
  const d = flow.decisions[key];
  if (d.flagged === null) return "No verified decision was exported for this detector. Its outcome stays unknown under either policy.";
  if (key === "snort") return d.flagged
    ? "The study's completed alert-to-flow correlation matched an alert to this flow, so the recorded decision is to raise an alert."
    : "The study's completed alert-to-flow correlation found no matched alert for this flow, so this lane continues without an alert.";
  if (d.score === null) return "The recorded decision is available, but its score is unavailable.";
  const relation = d.score >= data.thresholds[key] ? "at or above" : "below";
  return `Its recorded attack score (${d.score.toFixed(6)}) is ${relation} its fixed threshold (${data.thresholds[key].toFixed(2)}). This produces ${d.flagged ? "an alert" : "an allow decision"}.`;
}

export function policyConsequence(flow: Flow, key: DetectorKey, revealed: boolean, blocking: boolean): string {
  const flag = flow.decisions[key].flagged;
  if (flag === null) return "Unknown evidence: no block or allow outcome can be claimed.";
  if (!revealed) return flag ? blocking ? "The flagged flow stops at this lane's simulated gate." : "The lane raises an alert and the flow continues." : "The flow continues because this detector did not flag it.";
  if (flow.label === "attack") return flag
    ? blocking ? "This lane would stop the recorded attack." : "This lane detects the attack, but alert-only policy lets it continue."
    : "The recorded attack would continue through this lane under either policy.";
  return flag
    ? blocking ? "This lane would interrupt benign traffic because of a false alarm." : "This lane raises a false alarm, but the benign flow continues."
    : "This lane correctly allows benign traffic under either policy.";
}

export function revealSummary(flow: Flow, blocking: boolean): string {
  const flagged = detectorKeys.filter(k => flow.decisions[k].flagged === true);
  const allowed = detectorKeys.filter(k => flow.decisions[k].flagged === false);
  const unknown = 4 - flagged.length - allowed.length;
  const names = flagged.map(k => detectorNames[k]).join(", ");
  const beginning = flow.label === "attack"
    ? `${flagged.length} detector${flagged.length === 1 ? " detects" : "s detect"} the recorded attack; ${allowed.length} detector${allowed.length === 1 ? " misses" : "s miss"} it.`
    : `${flagged.length} false alarm${flagged.length === 1 ? "" : "s"}; ${allowed.length} detector${allowed.length === 1 ? " correctly allows" : "s correctly allow"} this benign flow.`;
  const policy = flagged.length
    ? blocking ? `${names} would ${flow.label === "attack" ? "stop the attack" : "interrupt benign traffic"}.` : "Alert-only policy lets traffic continue in every lane with an available decision."
    : "No available lane would block this flow.";
  return `${beginning} ${policy}${unknown ? ` ${unknown} outcome${unknown === 1 ? " remains" : "s remain"} unknown.` : ""}`;
}
