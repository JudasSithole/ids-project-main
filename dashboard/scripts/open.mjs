import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = "http://127.0.0.1:3000";
async function ready() {
  try { const res = await fetch(url, { signal: AbortSignal.timeout(1200) }); return res.ok && (await res.text()).includes("IDS Research | UJ"); }
  catch { return false; }
}
function open() {
  if (process.platform === "win32") spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], { windowsHide: true, detached: true, stdio: "ignore" }).unref();
  else spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { stdio: "ignore" }).unref();
  console.log(`Dashboard: ${url}\nKeep this terminal open during your presentation. Ctrl+C stops the server.`);
}
if (await ready()) { open(); }
else if (!existsSync(path.join(root, ".next/BUILD_ID"))) {
  console.error("Build the dashboard first: npm.cmd run build"); process.exitCode = 1;
} else {
  const server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "3000"], { cwd: root, stdio: "inherit", windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  let exited = false;
  server.on("exit", code => { exited = true; process.exitCode = code ?? 0; });
  process.on("SIGINT", () => { server.kill(); });
  let healthy = false;
  for (let i = 0; i < 100 && !exited; i++) {
    if (await ready()) { healthy = true; break; }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (healthy) open();
  else { console.error("Startup failed. Check whether port 3000 is in use."); server.kill(); process.exitCode = 1; }
}
