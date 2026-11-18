import { defineConfig } from "@playwright/test";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
mkdirSync(".qa", { recursive: true });
// Synthetic unknown evidence is confined to a second, test-only server.
const unknown = { schemaVersion: 1, label: "Demo sample", status: "partial", thresholds: { rf: .6, xgb: .7, nn: .7 }, selection: "Automated test fixture, not research data", missing: ["Automated test: no detector evidence"], flows: [{ id: "TEST-UNKNOWN", label: "benign", category: "Benign", decisions: Object.fromEntries(["rf", "xgb", "nn", "snort"].map(k => [k, { score: null, flagged: null }])) }] };
writeFileSync(".qa/unavailable-replay.json", JSON.stringify(unknown));
const cache = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData/Local"), "ms-playwright");
const cached = existsSync(cache) ? readdirSync(cache).filter(n => /^chromium-\d+$/.test(n)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1])).map(n => path.join(cache, n, "chrome-win64/chrome.exe")).find(p => existsSync(p)) : undefined;
export default defineConfig({
  testDir: "./tests", fullyParallel: false, workers: 1, retries: 0,
  timeout: 45000, reporter: "list",
  use: { baseURL: "http://127.0.0.1:4173", viewport: { width: 1366, height: 768 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || cached },
    screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: [
    { command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 4173", url: "http://127.0.0.1:4173", reuseExistingServer: false, env: { NEXT_TELEMETRY_DISABLED: "1" } },
    { command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 4174", url: "http://127.0.0.1:4174", reuseExistingServer: false, env: { NEXT_TELEMETRY_DISABLED: "1", IDS_REPLAY_FILE: path.resolve(".qa/unavailable-replay.json"), IDS_RESULTS_FILE: path.resolve(".qa/results-missing.json") } }
  ]
});
