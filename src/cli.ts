#!/usr/bin/env node

import { confirm, password, select } from "@inquirer/prompts";
import pc from "picocolors";
import { getConfigPath, loadConfig, publicConfig, saveConfig } from "./config.js";
import { ExarotonClient } from "./exaroton.js";
import { main as runMcp } from "./server.js";
import { connectOpenCraft } from "./setup.js";
import type { OpenCraftConfig, SafetyMode } from "./types.js";

function banner(): void {
  process.stdout.write(`\n${pc.bold(pc.green("◆ OpenCraft"))}\n${pc.dim("  AI server admin for Minecraft, powered by Exaroton")}\n\n`);
}

async function setup(): Promise<void> {
  banner();
  process.stdout.write(`${pc.bold("Let's connect your server.")} Your token is validated directly with Exaroton and saved only on this computer.\n`);
  process.stdout.write(`${pc.yellow("Never paste an API token into chat, screenshots, or a Git repository.")}\n\n`);

  const apiToken = (await password({
    message: "Exaroton API token",
    mask: "•",
    validate: (value) => value.trim().length >= 20 || "Paste the fresh token generated in Exaroton account settings."
  })).trim();

  const spinnerFrames = ["◐", "◓", "◑", "◒"];
  let frame = 0;
  process.stdout.write(`${pc.dim(`${spinnerFrames[frame]} Verifying with Exaroton...`)}`);
  const timer = setInterval(() => {
    frame = (frame + 1) % spinnerFrames.length;
    process.stdout.write(`\r${pc.dim(`${spinnerFrames[frame]} Verifying with Exaroton...`)}`);
  }, 90);

  let servers;
  try {
    servers = await new ExarotonClient(apiToken).listServers();
  } finally {
    clearInterval(timer);
    process.stdout.write(`\r${" ".repeat(44)}\r`);
  }

  if (!servers.length) throw new Error("This Exaroton account does not have access to any servers.");
  process.stdout.write(`${pc.green("✓")} Token verified. Found ${servers.length} server${servers.length === 1 ? "" : "s"}.\n\n`);

  const serverId = servers.length === 1
    ? servers[0]!.id
    : await select({
      message: "Which server should Codex manage?",
      choices: servers.map((server) => ({
        name: `${server.name}  ${pc.dim(server.address)}`,
        value: server.id,
        description: `${server.players.count}/${server.players.max} players · ${server.software?.name ?? "Unknown software"} ${server.software?.version ?? ""}`
      }))
    });
  const selected = servers.find((server) => server.id === serverId)!;
  if (servers.length === 1) process.stdout.write(`${pc.green("✓")} Selected ${pc.bold(selected.name)} (${selected.address})\n`);

  const safetyMode = await select<SafetyMode>({
    message: "Choose a safety mode",
    default: "guarded",
    choices: [
      {
        name: "Guarded (recommended)",
        value: "guarded",
        description: "Reads freely; actions require typed validation and explicit confirmation."
      },
      {
        name: "Read-only",
        value: "read-only",
        description: "Status, logs, diagnostics, players, and configuration reads only."
      }
    ]
  });

  const allowRawCommands = safetyMode === "guarded"
    ? await confirm({
      message: "Enable the advanced raw-console-command tool?",
      default: true
    })
    : false;

  const config: OpenCraftConfig = {
    version: 1,
    apiToken,
    serverId: selected.id,
    serverName: selected.name,
    safetyMode,
    allowRawCommands,
    createdAt: new Date().toISOString()
  };
  const destination = await saveConfig(config);

  process.stdout.write(`\n${pc.green(pc.bold("✓ OpenCraft is ready."))}\n`);
  process.stdout.write(`${pc.dim(`  Credentials: ${destination} (owner-only permissions)`)}\n`);
  process.stdout.write(`${pc.dim(`  Server:      ${selected.name} · ${selected.address}`)}\n`);
  process.stdout.write(`${pc.dim(`  Safety:      ${safetyMode}${allowRawCommands ? " + raw commands" : ""}`)}\n\n`);
  process.stdout.write(`${pc.bold("Try asking Codex:")}\n`);
  process.stdout.write(`  “Who is online and is the server healthy?”\n`);
  process.stdout.write(`  “Read the last 300 log lines and diagnose the crash.”\n`);
  process.stdout.write(`  “Give Luke 32 firework rockets.”\n\n`);
}

async function doctor(): Promise<void> {
  banner();
  const config = await loadConfig();
  const client = new ExarotonClient(config.apiToken);
  const info = await client.getServer(config.serverId);
  process.stdout.write(`${pc.green("✓")} Configuration loaded from ${getConfigPath()}\n`);
  process.stdout.write(`${pc.green("✓")} Exaroton authentication succeeded\n`);
  process.stdout.write(`${pc.green("✓")} Server resolved: ${info.name} (${info.address})\n`);
  process.stdout.write(`${pc.dim(JSON.stringify(publicConfig(config), null, 2))}\n`);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function connect(): Promise<void> {
  const apiToken = option("--token")?.trim();
  if (!apiToken) throw new Error("The connect command requires --token <EXAROTON_API_TOKEN>.");
  const mode = option("--mode") ?? "guarded";
  if (mode !== "guarded" && mode !== "read-only") {
    throw new Error("--mode must be guarded or read-only.");
  }
  const raw = option("--raw") ?? "true";
  if (raw !== "true" && raw !== "false") throw new Error("--raw must be true or false.");

  const result = await connectOpenCraft({
    apiToken,
    server: option("--server"),
    safetyMode: mode,
    allowRawCommands: raw === "true"
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function help(): void {
  banner();
  process.stdout.write("Usage: opencraft <command>\n\n");
  process.stdout.write("  setup    Connect an Exaroton account and choose safety settings\n");
  process.stdout.write("  connect  Non-interactive setup for AI coding agents\n");
  process.stdout.write("  doctor   Verify configuration and API access\n");
  process.stdout.write("  mcp      Start the MCP server over stdio\n");
}

const command = process.argv[2] ?? "help";
try {
  if (command === "setup") await setup();
  else if (command === "connect") await connect();
  else if (command === "doctor") await doctor();
  else if (command === "mcp") await runMcp();
  else help();
} catch (error) {
  if (error instanceof Error && error.name === "ExitPromptError") {
    process.stdout.write(`\n${pc.dim("Setup cancelled. No credentials were changed.")}\n`);
  } else {
    process.stderr.write(`\n${pc.red("Error:")} ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
