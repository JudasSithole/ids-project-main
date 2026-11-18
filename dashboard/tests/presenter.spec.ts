import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { detectorKeys, matchesScenario, type ReplayData, type ResultsData } from "../src/lib/types";
import { guidedCases } from "../src/lib/presentation";
const replay: ReplayData = JSON.parse(readFileSync("public/data/replay.json", "utf8"));
const results: ResultsData = JSON.parse(readFileSync("public/data/results.json", "utf8"));

test("presenter sequence preserves all four recorded decisions and hides labels", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Paused", { exact: true })).toBeVisible();
  await expect(page.getByTestId("flow-id")).toHaveText("AWAITING FLOW");
  await page.getByRole("button", { name: "Next flow" }).click();
  const flow = replay.flows[0];
  await expect(page.getByTestId("flow-id")).toHaveText(flow.id);
  for (const k of detectorKeys) {
    await expect(page.getByTestId(`lane-${k}`)).toHaveAttribute("data-decision", flow.decisions[k].flagged === null ? "unknown" : flow.decisions[k].flagged ? "alert" : "allow");
    await expect(page.getByTestId(`lane-${k}`)).toBeInViewport({ ratio: 1 });
  }
  await expect(page.getByTestId("actual-label")).toContainText("Hidden");
  await page.locator(".session-details>summary").click();
  await expect(page.getByRole("region", { name: "Replay history" })).not.toContainText(flow.category);
  await page.locator(".session-details>summary").click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole("button", { name: "Reveal actual label" })).toBeInViewport({ ratio: 1 });
  const before = await page.locator("[data-decision]").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-decision")));
  await page.getByRole("switch").click();
  for (const k of detectorKeys) if (flow.decisions[k].flagged === true) await expect(page.getByTestId(`lane-${k}`)).toContainText("Simulated block");
  expect(await page.locator("[data-decision]").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-decision")))).toEqual(before);
  await page.getByRole("button", { name: "Reveal actual label" }).click();
  await expect(page.getByTestId("actual-label")).toContainText(flow.category);
  await page.screenshot({ path: ".qa/replay-1366x768.png" });
  await page.getByRole("button", { name: "Next flow" }).click();
  await expect(page.getByTestId("actual-label")).toContainText("Hidden");
  await page.getByRole("switch").click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("flow-id")).toHaveText("AWAITING FLOW");
  await page.locator(".session-details>summary").click();
  await expect(page.getByRole("region", { name: "Replay history" })).toContainText("Advance a flow");
});

test("play, pause, speed, filter, keyboard and end of sample", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByTestId("flow-id")).toHaveText(replay.flows[0].id);
  await page.clock.fastForward(5100);
  await expect(page.getByTestId("flow-id")).toHaveText(replay.flows[1].id);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.fastForward(20000);
  await expect(page.getByTestId("flow-id")).toHaveText(replay.flows[1].id);
  await page.getByRole("combobox", { name: "Animation speed" }).selectOption("2");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.clock.fastForward(2600);
  await expect(page.getByTestId("flow-id")).toHaveText(replay.flows[2].id);
  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("disagreement");
  await expect(page.getByTestId("flow-id")).toHaveText("AWAITING FLOW");
  await expect(page.getByText("Paused", { exact: true })).toBeVisible();
  const filtered = replay.flows.filter(f => matchesScenario(f, "disagreement"));
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("flow-id")).toHaveText(filtered[0].id);
  await page.keyboard.press("l");
  await expect(page.getByTestId("actual-label")).toContainText(filtered[0].category);
  await page.keyboard.press("b");
  await expect(page.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("r");
  for (let i = 0; i < filtered.length; i++) await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Sample complete", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next flow" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeDisabled();
  const lastId = await page.getByTestId("flow-id").textContent();
  await page.clock.fastForward(30000);
  await expect(page.getByTestId("flow-id")).toHaveText(lastId!);
});

test("flagged traffic stops at its simulated gate and policy never changes scores", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("disagreement");
  await page.getByRole("button", { name: "Next flow" }).click();
  const f = replay.flows.find(f => matchesScenario(f, "disagreement"))!;
  const before = await page.locator(".score-block").allTextContents();
  for (const k of detectorKeys) if (f.decisions[k].flagged) await expect(page.getByTestId(`lane-${k}`)).toContainText("Alert · continues");
  await page.getByRole("switch").click();
  for (const k of detectorKeys) {
    const lane = page.getByTestId(`lane-${k}`);
    await expect(lane).toHaveAttribute("data-decision", f.decisions[k].flagged ? "alert" : "allow");
    if (f.decisions[k].flagged) {
      await expect(lane).toContainText("Simulated block");
      await expect(page.locator(`.signal-channel[data-detector="${k}"] .traveller`)).toHaveCSS("animation-name", "wire-stop");
      await expect(page.locator(`.signal-channel[data-detector="${k}"] .wire-gate`)).toHaveCount(1);
    } else await expect(lane).toContainText("Allowed");
  }
  await page.getByRole("button", { name: "Reveal actual label" }).click();
  expect(await page.locator(".score-block").allTextContents()).toEqual(before);
  await page.screenshot({ path: ".qa/disagreement-1366x768.png" });
  await page.getByRole("switch").click();
  expect(await page.locator(".score-block").allTextContents()).toEqual(before);
  for (const k of detectorKeys) if (f.decisions[k].flagged) await expect(page.getByTestId(`lane-${k}`)).toContainText("Alert · continues");
});

test("all exported flows and full-evaluation metrics match the interface", async ({ page }) => {
  await page.goto("/");
  for (const f of replay.flows) {
    await page.getByRole("button", { name: "Next flow" }).click();
    await expect(page.getByTestId("flow-id")).toHaveText(f.id);
    for (const k of detectorKeys) {
      const d = f.decisions[k];
      await expect(page.getByTestId(`lane-${k}`)).toHaveAttribute("data-decision", d.flagged === null ? "unknown" : d.flagged ? "alert" : "allow");
      if (k !== "snort") await expect(page.getByTestId(`score-${k}`)).toHaveText(d.score === null ? "—" : d.score.toFixed(4));
    }
  }
  await page.getByRole("link", { name: "Research Results", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Detection performance." })).toBeVisible();
  for (const d of results.detectors) {
    const row = page.locator(".metrics-table tbody tr").filter({ hasText: d.name });
    for (const value of [d.metrics.precision.toFixed(4), d.metrics.recall.toFixed(4), d.metrics.f1.toFixed(4), d.metrics.fpr.toFixed(5)]) await expect(row).toContainText(value);
    expect(Object.values(d.matrix).reduce((sum, n) => sum + n, 0)).toBe(123161);
    const table = page.getByRole("table", { name: `${d.name} confusion matrix` });
    for (const n of Object.values(d.matrix)) await expect(table).toContainText(n.toLocaleString("en-US"));
  }
  await page.screenshot({ path: ".qa/results-1366x768.png", fullPage: true });
});

test("unavailable evidence stays unknown when revealed or blocked", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174/");
  await page.getByRole("button", { name: "Next flow" }).click();
  await expect(page.getByTestId("flow-id")).toHaveText("TEST-UNKNOWN");
  await page.getByRole("switch").click();
  await page.getByRole("button", { name: "Reveal actual label" }).click();
  for (const k of detectorKeys) {
    await expect(page.getByTestId(`lane-${k}`)).toHaveAttribute("data-decision", "unknown");
    await expect(page.getByTestId(`lane-${k}`)).toContainText("Unavailable");
    await expect(page.getByTestId(`lane-${k}`)).toContainText("Outcome unknown");
    await expect(page.getByTestId(`lane-${k}`)).not.toContainText("Simulated block");
  }
  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("ddos");
  await expect(page.getByText("No recorded examples match this scenario.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next flow" })).toBeDisabled();
});

test("an entirely missing replay export has an honest empty state", async ({ page }) => {
  const original = readFileSync(".qa/unavailable-replay.json", "utf8");
  try {
    const empty = JSON.parse(original);
    empty.flows = [];
    empty.status = "unavailable";
    writeFileSync(".qa/unavailable-replay.json", JSON.stringify(empty));
    await page.goto("http://127.0.0.1:4174/");
    await expect(page.getByRole("button", { name: "Next flow" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Reveal actual label" })).toBeDisabled();
    await expect(page.getByText("Replay evidence unavailable", { exact: true })).toBeVisible();
    await expect(page.locator("[data-decision='waiting']")).toHaveCount(4);
    await page.getByRole("switch").click();
    await expect(page.getByText("Simulated block", { exact: true })).toHaveCount(0);
  } finally { writeFileSync(".qa/unavailable-replay.json", original); }
});

test("a missing results export renders an honest empty state instead of crashing", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("http://127.0.0.1:4174/results");
  await expect(page.getByRole("heading", { name: "Detection performance.", exact: true })).toBeVisible();
  await expect(page.locator(".metrics-table tbody tr")).toHaveCount(0);
  await expect(page.getByRole("table", { name: /confusion matrix/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("both routes use only loopback requests and render without browser errors", async ({ page, context }) => {
  const external: string[] = [], errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) { external.push(url.href); return route.abort(); }
    return route.continue();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Next flow" }).click();
  await page.getByRole("button", { name: "Reveal actual label" }).click();
  await page.getByRole("switch").click();
  await page.getByRole("link", { name: "Research Results", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The resource footprint." })).toBeVisible();
  await page.getByRole("link", { name: "Return to offline replay" }).click();
  await expect(page.getByRole("heading", { name: "One flow. Four perspectives." })).toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("responsive layouts and reduced motion", async ({ page }) => {
  for (const width of [1366, 768, 390]) {
    await page.setViewportSize({ width, height: 768 });
    await page.goto("/");
    await page.getByRole("button", { name: "Next flow" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("link", { name: "Research Results", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Next flow" }).click();
  await expect(page.locator(".traveller").first()).toHaveCSS("animation-name", "none");
});

test("guided walkthrough uses six real distinct cases and keeps labels hidden between steps", async ({ page }) => {
  const cases = guidedCases(replay);
  expect(cases).toHaveLength(6);
  expect(new Set(cases.map(c => c.flow.id)).size).toBe(6);
  await page.goto("/");
  await page.getByRole("button", { name: /Guided walkthrough/ }).click();
  for (const [i, c] of cases.entries()) {
    await expect(page.getByTestId("flow-id")).toHaveText(c.flow.id);
    await expect(page.getByTestId("actual-label")).toContainText("Hidden");
    await expect(page.locator(".guided-description")).toHaveText(`Case ${i + 1} / 6 · ${c.title}`);
    await expect(page.getByRole("button", { name: "Reveal actual label" })).toBeInViewport({ ratio: 1 });
    for (const k of detectorKeys) await expect(page.getByTestId(`lane-${k}`)).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: new RegExp(c.title) }).last()).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Reveal actual label" }).click();
    await expect(page.getByTestId("actual-label")).toContainText(c.flow.category);
    await expect(page.getByTestId("case-discussion")).not.toContainText("Make a prediction");
    if (i < cases.length - 1) await page.getByRole("button", { name: "Next flow" }).click();
  }
  await expect(page.getByText("Sample complete", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Free replay", exact: true }).click();
  await expect(page.getByTestId("flow-id")).toHaveText("AWAITING FLOW");
  await page.getByRole("button", { name: "Next flow" }).click();
  await expect(page.getByTestId("flow-id")).toHaveText(replay.flows[0].id);
});

test("audience predictions reset on case change and do not alter recorded decisions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /A lone alert/ }).click();
  await page.locator(".session-details>summary").click();
  const before = await page.locator("[data-decision]").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-decision")));
  await page.getByRole("group", { name: "Audience prediction", exact: true }).getByRole("button", { name: "Attack", exact: true }).click();
  await expect(page.getByTestId("audience-feedback")).toContainText("The actual label stays hidden");
  await expect(page.getByTestId("actual-label")).toContainText("Hidden");
  await page.getByRole("button", { name: "Reveal actual label" }).click();
  await expect(page.getByTestId("audience-feedback")).toContainText("differs from the recorded label");
  await expect(page.getByTestId("case-discussion")).toContainText("false alarm");
  await page.getByRole("switch").click();
  await expect(page.getByTestId("case-discussion")).toContainText("interrupt benign traffic");
  expect(await page.locator("[data-decision]").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-decision")))).toEqual(before);
  await page.getByRole("button", { name: "Next flow" }).click();
  await expect(page.getByTestId("audience-feedback")).toContainText("Optional discussion prompt");
  await expect(page.getByRole("group", { name: "Audience prediction", exact: true }).locator("[aria-pressed=true]")).toHaveCount(0);
});

test("explanations preserve the blind comparison and show the consequence after reveal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /ML versus Snort/ }).click();
  const id = await page.getByTestId("flow-id").textContent();
  await page.getByRole("button", { name: "Explain decisions", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Why these decisions?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText("DDoS");
  await expect(dialog.getByTestId("explanation-snort")).toContainText("completed alert-to-flow correlation found no matched alert");
  await expect(dialog.getByTestId("explanation-rf")).toContainText("fixed threshold (0.60)");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId("flow-id")).toHaveText(id!);
  await expect(page.getByRole("button", { name: "Explain decisions", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Reveal actual label" }).click();
  await page.getByRole("switch").click();
  await page.getByRole("button", { name: "Explain decisions", exact: true }).click();
  await expect(dialog.getByTestId("explanation-snort")).toContainText("Missed attack");
  await expect(dialog.getByTestId("explanation-snort")).toContainText("attack would continue");
  await expect(dialog.getByTestId("explanation-rf")).toContainText("would stop the recorded attack");
  await page.screenshot({ path: ".qa/decision-explanation-1366x768.png" });
  await page.getByRole("button", { name: "Return to replay", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.screenshot({ path: ".qa/guided-walkthrough-1366x768.png", fullPage: true });
});

test("missing evidence creates no guided cases and its explanation stays unknown", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174/");
  await expect(page.getByRole("button", { name: /Guided walkthrough/ })).toBeDisabled();
  await expect(page.locator(".case-button")).toHaveCount(0);
  await page.getByRole("button", { name: "Next flow" }).click();
  await page.getByRole("button", { name: "Explain decisions", exact: true }).click();
  for (const k of detectorKeys) {
    await expect(page.getByTestId(`explanation-${k}`)).toContainText("No verified decision");
    await expect(page.getByTestId(`explanation-${k}`)).toContainText("Unknown evidence");
  }
});

test("hero fits the classroom viewport and animated packets stop before their gates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /ML versus Snort/ }).click();
  await page.getByRole("switch").click();
  await expect(page.locator(".flow-wires .signal-channel")).toHaveCount(4);
  for (const k of detectorKeys) await expect(page.getByTestId(`lane-${k}`)).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: "Reveal actual label" })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: "Next flow" })).toBeInViewport({ ratio: 1 });
  for (const k of ["rf", "xgb", "nn"]) {
    const channel = page.locator(`.signal-channel[data-detector="${k}"]`);
    await expect(channel.locator(".traveller")).toHaveCSS("offset-distance", "96%");
    const token = await channel.locator(".traveller").boundingBox();
    const gate = await channel.locator(".wire-gate").boundingBox();
    expect(token).not.toBeNull();
    expect(gate).not.toBeNull();
    expect(token!.x + token!.width).toBeLessThan(gate!.x + 2);
    expect(Math.abs(token!.y + token!.height / 2 - (gate!.y + gate!.height / 2))).toBeLessThan(8);
  }
  await page.getByRole("button", { name: "Reveal actual label" }).click();
  await page.screenshot({ path: ".qa/reference-hero-1366x768.png" });
});
