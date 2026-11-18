import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const child = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), ...process.argv.slice(2)], {
  cwd: root, stdio: "inherit", windowsHide: true,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }
});
child.on("exit", code => { process.exitCode = code ?? 0; });
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
