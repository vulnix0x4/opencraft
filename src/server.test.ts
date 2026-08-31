import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { McpServer } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, type OpenCraftApiClient } from "./server.js";
import type { OpenCraftConfig, ExarotonServer } from "./types.js";

const guardedConfig: OpenCraftConfig = {
  version: 1,
  apiToken: "test-token-that-is-long-enough",
  serverId: "server/id",
  serverName: "Test Realm",
  safetyMode: "guarded",
  allowRawCommands: true,
  createdAt: "2026-01-01T00:00:00.000Z"
};

const serverInfo: ExarotonServer = {
  id: "server/id",
  name: "Test Realm",
  address: "test.exaroton.me",
  motd: "hello",
  status: 1,
  host: "example.test",
  port: 25565,
  players: { max: 20, count: 1, list: ["LukeTheDuke10117"] },
  software: { id: "fabric", name: "Fabric", version: "26.2" },
  shared: false
};

function fakeApiClient(): OpenCraftApiClient {
  return {
    getServer: vi.fn().mockResolvedValue(serverInfo),
    getLogs: vi.fn().mockResolvedValue({ content: "[Server thread/INFO]: Luke joined the game" }),
    getRam: vi.fn().mockResolvedValue({ ram: 4 }),
    setMotd: vi.fn().mockImplementation(async (_serverId: string, motd: string) => ({ motd })),
    start: vi.fn().mockResolvedValue(null),
    stop: vi.fn().mockResolvedValue(null),
    restart: vi.fn().mockResolvedValue(null),
    runCommand: vi.fn().mockResolvedValue(null),
    listPlayerLists: vi.fn().mockResolvedValue(["ops", "whitelist"]),
    getPlayerList: vi.fn().mockResolvedValue(["LukeTheDuke10117"]),
    addPlayerListEntries: vi.fn().mockResolvedValue(["LukeTheDuke10117"]),
    removePlayerListEntries: vi.fn().mockResolvedValue([]),
    getFileInfo: vi.fn().mockResolvedValue({
      path: "server.properties",
      name: "server.properties",
      isTextFile: true,
      isConfigFile: true,
      isDirectory: false,
      isLog: false,
      isReadable: true,
      isWritable: true,
      size: 42
    }),
    readFile: vi.fn().mockResolvedValue("motd=hello\n"),
    getConfig: vi.fn().mockResolvedValue([{
      key: "motd",
      label: "MOTD",
      type: "string" as const,
      value: "hello"
    }]),
    updateConfig: vi.fn().mockResolvedValue([{
      key: "motd",
      label: "MOTD",
      type: "string" as const,
      value: "slimed"
    }])
  };
}

const openClients: Client[] = [];
const openServers: McpServer[] = [];

afterEach(async () => {
  await Promise.allSettled(openClients.splice(0).map((client) => client.close()));
  await Promise.allSettled(openServers.splice(0).map((server) => server.close()));
});

async function harness(config = guardedConfig, api = fakeApiClient()) {
  const connect = vi.fn().mockResolvedValue({ configured: true, server: { name: "Test Realm" } });
  const mcpServer = createServer({
    runtime: async () => ({ config, client: api, serverId: config.serverId }),
    connect
  });
  const client = new Client({ name: "opencraft-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await mcpServer.connect(serverTransport);
  await client.connect(clientTransport);
  openServers.push(mcpServer);
  openClients.push(client);
  return { client, api, connect };
}

async function expectSuccess(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError, `${name} returned an MCP error`).not.toBe(true);
  expect(result.content.some((block) => block.type === "text"), `${name} returned no text`).toBe(true);
  return result;
}

describe("OpenCraft MCP tools", () => {
  it("registers and successfully executes every tool against a mocked Exaroton server", async () => {
    const { client, api, connect } = await harness();
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
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
    ]);

    await expectSuccess(client, "opencraft_connect", {
      apiToken: "replacement-token-that-is-long-enough",
      server: "Test Realm"
    });
    await expectSuccess(client, "opencraft_setup_status");
    await expectSuccess(client, "minecraft_server_status");
    await expectSuccess(client, "minecraft_get_players");
    await expectSuccess(client, "minecraft_set_motd", { motd: "join or get slimed", confirmed: true });
    await expectSuccess(client, "minecraft_read_logs", { lines: 100 });
    await expectSuccess(client, "minecraft_diagnose", { lines: 100 });
    await expectSuccess(client, "minecraft_start_server", { confirmed: true });
    await expectSuccess(client, "minecraft_stop_server", { confirmed: true });
    await expectSuccess(client, "minecraft_restart_server", { confirmed: true });
    await expectSuccess(client, "minecraft_send_message", { message: "locked in" });
    await expectSuccess(client, "minecraft_give_item", { player: "LukeTheDuke10117", item: "diamond", amount: 2, confirmed: true });
    await expectSuccess(client, "minecraft_teleport", { player: "LukeTheDuke10117", destinationPlayer: "Steve", confirmed: true });
    await expectSuccess(client, "minecraft_set_gamemode", { player: "LukeTheDuke10117", mode: "survival", confirmed: true });
    await expectSuccess(client, "minecraft_set_time", { time: "day", confirmed: true });
    await expectSuccess(client, "minecraft_set_weather", { weather: "clear", durationSeconds: 60, confirmed: true });
    await expectSuccess(client, "minecraft_set_gamerule", { rule: "keepInventory", value: true, confirmed: true });
    await expectSuccess(client, "minecraft_run_command", { command: "/effect give LukeTheDuke10117 speed 30 1", confirmed: true });
    await expectSuccess(client, "minecraft_list_player_lists");
    await expectSuccess(client, "minecraft_get_player_list", { list: "ops" });
    await expectSuccess(client, "minecraft_update_player_list", { list: "whitelist", operation: "add", entries: ["LukeTheDuke10117"], confirmed: true });
    await expectSuccess(client, "minecraft_update_player_list", { list: "whitelist", operation: "remove", entries: ["LukeTheDuke10117"], confirmed: true });
    await expectSuccess(client, "minecraft_file_info", { path: "server.properties" });
    await expectSuccess(client, "minecraft_read_file", { path: "server.properties", maxCharacters: 1000 });
    await expectSuccess(client, "minecraft_read_config", { path: "server.properties" });
    await expectSuccess(client, "minecraft_update_config", { path: "server.properties", changes: { motd: "slimed" }, confirmed: true });

    expect(connect).toHaveBeenCalledOnce();
    expect(api.start).toHaveBeenCalledWith("server/id");
    expect(api.stop).toHaveBeenCalledWith("server/id");
    expect(api.restart).toHaveBeenCalledWith("server/id");
    expect(api.runCommand).toHaveBeenCalledWith("server/id", "effect give LukeTheDuke10117 speed 30 1");
    expect(api.addPlayerListEntries).toHaveBeenCalledWith("server/id", "whitelist", ["LukeTheDuke10117"]);
    expect(api.removePlayerListEntries).toHaveBeenCalledWith("server/id", "whitelist", ["LukeTheDuke10117"]);
  });

  it("enforces confirmation, read-only mode, raw-command switches, and config keys", async () => {
    const guarded = await harness();
    const unconfirmed = await guarded.client.callTool({
      name: "minecraft_run_command",
      arguments: { command: "say nope", confirmed: false }
    });
    expect(unconfirmed.isError).toBe(true);
    expect(guarded.api.runCommand).not.toHaveBeenCalled();

    const disabled = await harness({ ...guardedConfig, allowRawCommands: false });
    const rawDisabled = await disabled.client.callTool({
      name: "minecraft_run_command",
      arguments: { command: "say nope", confirmed: true }
    });
    expect(rawDisabled.isError).toBe(true);

    const readOnly = await harness({ ...guardedConfig, safetyMode: "read-only" });
    const blocked = await readOnly.client.callTool({
      name: "minecraft_run_command",
      arguments: { command: "say nope", confirmed: false }
    });
    expect(blocked.isError).toBe(true);
    expect(blocked.content.find((block) => block.type === "text")).toMatchObject({
      text: expect.stringContaining("read-only mode")
    });

    const unknownConfig = await guarded.client.callTool({
      name: "minecraft_update_config",
      arguments: { changes: { definitelyNotReal: true }, confirmed: true }
    });
    expect(unknownConfig.isError).toBe(true);
    expect(guarded.api.updateConfig).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ definitelyNotReal: true })
    );
  });

  it("turns downstream API failures into safe MCP errors", async () => {
    const api = fakeApiClient();
    vi.mocked(api.getServer).mockRejectedValue(new Error("Exaroton is temporarily unavailable."));
    const { client } = await harness(guardedConfig, api);

    const result = await client.callTool({ name: "minecraft_get_players", arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.content.find((block) => block.type === "text")).toMatchObject({
      text: "Exaroton is temporarily unavailable."
    });
  });
});
