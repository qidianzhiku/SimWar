import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(command, ["playwright", "test", "--grep", "@m2-p2-real"], {
  env: {
    ...process.env,
    SIMWAR_PLAYWRIGHT_M2_PROJECT_LIBRARY: "true",
    SIMWAR_PLAYWRIGHT_M2_MARKET_WORLD: "false",
    SIMWAR_PLAYWRIGHT_W3: "false"
  },
  shell: process.platform === "win32",
  stdio: "inherit"
});

child.on("error", (error) => {
  console.error(`Failed to start dedicated M2-P2 browser runner: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Dedicated M2-P2 browser runner stopped by ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
