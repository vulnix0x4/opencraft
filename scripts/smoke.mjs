import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "opencraft-smoke-"));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.resolve("dist/server.js")],
  env: {
    ...process.env,
    OPENCRAFT_CONFIG_PATH: path.join(temporaryDirectory, "missing-config.json"),
    EXAROTON_API_TOKEN: "",
    EXAROTON_SERVER_ID: ""
  },
  stderr: "pipe"
});
const client = new Client({ name: "opencraft-smoke", version: "0.1.0" });
const expectedTools = [
  "minecraft_diagnose",
  "minecraft_file_info",
  "minecraft_get_player_list",
  "minecraft_get_players",
  "minecraft_give_item",
  "minecraft_list_player_lists",
  "minecraft_read_config",
  "minecraft_read_file",
  "minecraft_read_logs",
  "minecraft_restart_server",
  "minecraft_run_command",
  "minecraft_send_message",
  "minecraft_server_status",
  "minecraft_set_gamemode",
  "minecraft_set_gamerule",
  "minecraft_set_motd",
  "minecraft_set_time",
  "minecraft_set_weather",
  "minecraft_start_server",
  "minecraft_stop_server",
  "minecraft_teleport",
  "minecraft_update_config",
  "minecraft_update_player_list",
  "opencraft_connect",
  "opencraft_setup_status"
].sort();

try {
  await client.connect(transport);
  const result = await client.listTools();
  const actualTools = result.tools.map((tool) => tool.name).sort();
  if (JSON.stringify(actualTools) !== JSON.stringify(expectedTools)) {
    throw new Error(`MCP tool mismatch. Expected ${expectedTools.join(", ")}; received ${actualTools.join(", ")}.`);
  }
  const setup = await client.callTool({ name: "opencraft_setup_status", arguments: {} });
  if (!setup.isError) throw new Error("An unconfigured smoke test should return the safe setup instruction.");
  const text = setup.content.find((block) => block.type === "text")?.text ?? "";
  if (!text.includes("one-sentence setup") || !text.includes("opencraft setup")) {
    throw new Error("The setup-status response did not include both supported setup paths.");
  }
  process.stdout.write(`MCP smoke test passed: ${result.tools.length} tools discovered.\n`);
} finally {
  await client.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
