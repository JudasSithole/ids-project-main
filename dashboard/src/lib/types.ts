export const detectorKeys = ["rf", "xgb", "nn", "snort"] as const;
export type DetectorKey = (typeof detectorKeys)[number];
export const detectorNames: Record<DetectorKey, string> = {
  rf: "Random Forest", xgb: "XGBoost", nn: "MLP", snort: "Snort 3 Community Rules"
};
export type Decision = { score: number | null; flagged: boolean | null };
export type Flow = {
  id: string; label: "benign" | "attack"; category: string;
  decisions: Record<DetectorKey, Decision>;
};
export type ReplayData = {
  schemaVersion: number; label: string; status: "complete" | "partial" | "unavailable";
  flows: Flow[]; missing: string[]; selection: string;
  thresholds: Record<"rf" | "xgb" | "nn", number>;
  population?: number;
};
export type Matrix = { tn: number; fp: number; fn: number; tp: number };
export type DetectionResult = {
  key: DetectorKey; name: string; threshold: number | null; matrix: Matrix;
  metrics: { precision: number; recall: number; f1: number; fpr: number }; source: string;
};
export type ResourceResult = {
  key: DetectorKey; name: string; cpuPercent: number; peakMemoryMib: number;
  throughput: number; throughputUnit: string; cpuMethod: string; source: string;
};
export type ResultsData = {
  schemaVersion: number; population: number; benign: number; attacks: number;
  evaluationLabel: string; detectors: DetectionResult[]; resources: ResourceResult[];
  notes: string[]; sources: { file: string; sha256: string }[];
};
export type Scenario = "mixed" | "benign" | "ddos" | "port-scan" | "disagreement" | "missed" | "false-alarm";

export function matchesScenario(flow: Flow, scenario: Scenario): boolean {
  const decisions = detectorKeys.map(k => flow.decisions[k].flagged).filter(d => d !== null);
  switch (scenario) {
    case "benign": return flow.label === "benign";
    case "ddos": return flow.category === "DDoS";
    case "port-scan": return flow.category === "Port scan";
    case "disagreement": return decisions.includes(true) && decisions.includes(false);
    case "missed": return flow.label === "attack" && decisions.includes(false);
    case "false-alarm": return flow.label === "benign" && decisions.includes(true);
    default: return true;
  }
}

export function outcome(flow: Flow, key: DetectorKey): string {
  const flagged = flow.decisions[key].flagged;
  if (flagged === null) return "Outcome unknown: evidence unavailable";
  if (flow.label === "attack") return flagged ? "Detected attack" : "Missed attack";
  return flagged ? "False alarm" : "Correctly allowed benign traffic";
}
