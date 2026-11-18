import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReplayData, ResultsData } from "./types";

export async function replayData(): Promise<ReplayData> {
  try {
    return JSON.parse(await readFile(/* turbopackIgnore: true */ process.env.IDS_REPLAY_FILE || path.join(process.cwd(), "public/data/replay.json"), "utf8"));
  } catch {
    return { schemaVersion: 1, label: "Demo sample", status: "unavailable", flows: [],
      missing: ["A readable replay.json export"], thresholds: { rf: 0.6, xgb: 0.7, nn: 0.7 },
      selection: "Replay export missing or unreadable. Run the documented exporter; no flow decisions have been invented." };
  }
}
export async function resultsData(): Promise<ResultsData> {
  return JSON.parse(await readFile(path.join(process.cwd(), "public/data/results.json"), "utf8"));
}
