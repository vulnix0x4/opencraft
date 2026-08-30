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

try {
  await client.connect(transport);
  const result = await client.listTools();
  if (result.tools.length < 15) {
    throw new Error(`Expected at least 15 tools, received ${result.tools.length}.`);
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
