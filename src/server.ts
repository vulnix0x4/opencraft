import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as z from "zod/v4";
import { loadConfig, publicConfig } from "./config.js";
import { diagnoseLog, tailLog } from "./diagnostics.js";
import { ExarotonClient } from "./exaroton.js";
import { connectOpenCraft } from "./setup.js";
import {
  minecraftName,
  requireConfirmation,
  requireWrites,
  resourceLocation,
  safeChatMessage,
  validateRawCommand
} from "./safety.js";

const statusNames: Record<number, string> = {
  0: "offline",
  1: "online",
  2: "starting",
  3: "stopping",
  4: "restarting",
  5: "saving",
  6: "loading",
  7: "crashed",
  8: "pending",
  9: "transferring",
  10: "preparing"
};

function textResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }]
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : "An unexpected OpenCraft error occurred.";
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

async function defaultRuntime() {
  const config = await loadConfig();
  return { config, client: new ExarotonClient(config.apiToken), serverId: config.serverId };
}

export type OpenCraftApiClient = Pick<ExarotonClient,
  | "getServer"
  | "getLogs"
  | "getRam"
  | "setMotd"
  | "start"
  | "stop"
  | "restart"
  | "runCommand"
  | "listPlayerLists"
  | "getPlayerList"
  | "addPlayerListEntries"
  | "removePlayerListEntries"
  | "getFileInfo"
  | "readFile"
  | "getConfig"
  | "updateConfig"
>;

export interface OpenCraftRuntime {
  config: Awaited<ReturnType<typeof loadConfig>>;
  client: OpenCraftApiClient;
  serverId: string;
}

export interface OpenCraftServerDependencies {
  runtime?: () => Promise<OpenCraftRuntime>;
  connect?: typeof connectOpenCraft;
}

function confirmedActionSchema() {
  return z.object({
    confirmed: z.boolean().default(false).describe("True only after the user explicitly confirms this action.")
  });
}

export function createServer(dependencies: OpenCraftServerDependencies = {}): McpServer {
  const getRuntime = dependencies.runtime ?? defaultRuntime;
  const connect = dependencies.connect ?? connectOpenCraft;
  const server = new McpServer(
    {
      name: "opencraft",
      title: "OpenCraft",
      version: "0.1.0",
      description: "Safety-first Minecraft server administration through Exaroton."
    },
    {
      instructions: "You are OpenCraft, a locked-in Minecraft co-admin and fun, concise companion. Act only on the selected server. Be proactive: inspect status, players, logs, files, and config when useful; infer software/version, player names, and exact command syntax yourself. Never make the user translate intent into commands or repeat context you can inspect. Use typed tools when they fit and minecraft_run_command for custom, modded, or advanced actions they cannot express. Keep replies short, casual, and direct—no essays or process narration. Mutations need an explicit user request; honor every confirmation gate and state the exact effect in one sentence. Starting costs credits; stopping or restarting disconnects players. Never reveal credentials or claim a backup exists."
    }
  );

  server.registerTool(
    "opencraft_connect",
    {
      title: "Connect OpenCraft",
      description: "Complete OpenCraft setup from one chat request. Use only when the user intentionally provides an Exaroton API token and asks to configure OpenCraft. Verify the token, select the named server, and save owner-only local configuration. Never repeat the token in a response.",
      inputSchema: z.object({
        apiToken: z.string().trim().min(20).describe("The Exaroton API token intentionally supplied by the user. Never echo this value."),
        server: z.string().trim().min(1).optional().describe("Exact Exaroton server name, address, or ID. May be omitted when only one server is available."),
        safetyMode: z.enum(["read-only", "guarded"]).default("guarded").describe("Guarded permits confirmed typed actions; read-only blocks all changes."),
        allowRawCommands: z.boolean().default(true).describe("Whether to enable the advanced raw console tool. Defaults to true in guarded mode; set false to disable it.")
      })
    },
    async (input) => {
      try {
        return textResult(await connect(input));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "opencraft_setup_status",
    {
      title: "OpenCraft setup status",
      description: "Check whether OpenCraft is locally configured without revealing credentials.",
      inputSchema: z.object({})
    },
    async () => {
      try {
        const { config } = await getRuntime();
        return textResult({ configured: true, ...publicConfig(config) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_server_status",
    {
      title: "Minecraft server status",
      description: "Get server state, address, software, and online player summary.",
      inputSchema: z.object({})
    },
    async () => {
      try {
        const { client, serverId } = await getRuntime();
        const [serverInfo, ram] = await Promise.all([client.getServer(serverId), client.getRam(serverId)]);
        return textResult({
          ...serverInfo,
          statusName: statusNames[serverInfo.status] ?? "unknown",
          configuredRamGb: ram.ram
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_get_players",
    {
      title: "Players online",
      description: "Get the current online player count and names when Exaroton exposes them.",
      inputSchema: z.object({})
    },
    async () => {
      try {
        const { client, serverId } = await getRuntime();
        const info = await client.getServer(serverId);
        return textResult(info.players);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_set_motd",
    {
      title: "Set server MOTD",
      description: "Change the server-list message through Exaroton's dedicated MOTD option. Requires explicit confirmation.",
      inputSchema: z.object({
        motd: z.string().trim().min(1).max(160).refine((value) => !/[\r\n\0]/.test(value), "MOTD must be a single line."),
        confirmed: z.boolean().default(false).describe("True only after the user explicitly confirms the MOTD change.")
      })
    },
    async ({ motd, confirmed }) => {
      try {
        const { config, client, serverId } = await getRuntime();
        requireWrites(config);
        requireConfirmation(confirmed, `change the server MOTD to \"${motd}\"`);
        const result = await client.setMotd(serverId, motd);
        return textResult({ accepted: true, motd: result.motd, server: config.serverName });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_read_logs",
    {
      title: "Read server logs",
      description: "Read the latest server log lines with ANSI control codes removed.",
      inputSchema: z.object({ lines: z.number().int().min(1).max(500).default(200) })
    },
    async ({ lines }) => {
      try {
        const { client, serverId } = await getRuntime();
        const log = await client.getLogs(serverId);
        return textResult(log.content ? tailLog(log.content, lines) : "No server log is currently available.");
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_diagnose",
    {
      title: "Diagnose server health",
      description: "Collect server state and scan recent logs for crash, mod, memory, authentication, and tick-lag signals.",
      inputSchema: z.object({ lines: z.number().int().min(50).max(500).default(500) })
    },
    async ({ lines }) => {
      try {
        const { client, serverId } = await getRuntime();
        const [info, log] = await Promise.all([client.getServer(serverId), client.getLogs(serverId)]);
        const content = log.content ? tailLog(log.content, lines) : "";
        const signals = diagnoseLog(content);
        return textResult({
          server: { name: info.name, status: statusNames[info.status] ?? "unknown", players: info.players },
          signals,
          summary: signals.length ? `${signals.length} diagnostic signal(s) detected.` : "No known high-confidence error patterns detected."
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  for (const [name, title, verb, action] of [
    ["minecraft_start_server", "Start server", "start", "start the server and begin consuming Exaroton credits"],
    ["minecraft_stop_server", "Stop server", "stop", "stop the server"],
    ["minecraft_restart_server", "Restart server", "restart", "restart the server and disconnect current players"]
  ] as const) {
    server.registerTool(
      name,
      {
        title,
        description: `${title}. Requires guarded mode and explicit confirmation.`,
        inputSchema: confirmedActionSchema()
      },
      async ({ confirmed }) => {
        try {
          const { config, client, serverId } = await getRuntime();
          requireWrites(config);
          requireConfirmation(confirmed, action);
          await client[verb](serverId);
          return textResult({ accepted: true, action: verb, server: config.serverName });
        } catch (error) {
          return errorResult(error);
        }
      }
    );
  }

  server.registerTool(
    "minecraft_send_message",
    {
      title: "Send server message",
      description: "Broadcast a short message to everyone on the server.",
      inputSchema: z.object({ message: z.string().min(1).max(240) })
    },
    async ({ message }) => {
      try {
        const { config, client, serverId } = await getRuntime();
        requireWrites(config);
        await client.runCommand(serverId, `say ${safeChatMessage(message)}`);
        return textResult({ sent: true, message });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_give_item",
    {
      title: "Give player an item",
      description: "Give a validated Minecraft item to a player.",
      inputSchema: z.object({
        player: z.string(),
        item: z.string(),
        amount: z.number().int().min(1).max(2304).default(1),
        confirmed: z.boolean().default(false).describe("True only after the user explicitly confirms the item grant.")
      })
    },
    async ({ player, item, amount, confirmed }) => {
      try {
        const { config, client, serverId } = await getRuntime();
        requireWrites(config);
        requireConfirmation(confirmed, `give ${amount} ${item} to ${player}`);
        const target = minecraftName(player);
        const resource = resourceLocation(item);
        await client.runCommand(serverId, `give ${target} ${resource} ${amount}`);
        return textResult({ accepted: true, player: target, item: resource, amount });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_teleport",
    {
      title: "Teleport player",
      description: "Teleport one player to another player. Requires explicit confirmation.",
      inputSchema: z.object({
        player: z.string(),
        destinationPlayer: z.string(),
        confirmed: z.boolean().default(false)
      })
    },
    async ({ player, destinationPlayer, confirmed }) => {
      try {
        const { config, client, serverId } = await getRuntime();
        requireWrites(config);
        requireConfirmation(confirmed, `teleport ${player} to ${destinationPlayer}`);
        const target = minecraftName(player);
        const destination = minecraftName(destinationPlayer, "destination player");
        await client.runCommand(serverId, `teleport ${target} ${destination}`);
        return textResult({ accepted: true, player: target, destinationPlayer: destination });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_set_gamemode",
    {
      title: "Set player game mode",
      description: "Set a player's Minecraft game mode. Requires explicit confirmation.",
      inputSchema: z.object({
        player: z.string(),
        mode: z.enum(["survival", "creative", "adventure", "spectator"]),
        confirmed: z.boolean().default(false)
      })
    },
    async ({ player, mode, confirmed }) => {
      try {
        const { config, client, serverId } = await getRuntime();
        requireWrites(config);
        requireConfirmation(confirmed, `set ${player}'s game mode to ${mode}`);
        const target = minecraftName(player);
        await client.runCommand(serverId, `gamemode ${mode} ${target}`);
        return textResult({ accepted: true, player: target, mode });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_set_time",
    {
      title: "Set world time",
      description: "Set the Minecraft world time to day, noon, night, or midnight. Requires explicit confirmation.",
      inputSchema: z.object({
        time: z.enum(["day", "noon", "night", "midnight"]),
        confirmed: z.boolean().default(false)
      })
    },
    async ({ time, confirmed }) => {
      try {
        const { config, client, serverId } = await getRuntime();
        requireWrites(config);
        requireConfirmation(confirmed, `set the world time to ${time}`);
        await client.runCommand(serverId, `time set ${time}`);
        return textResult({ accepted: true, time });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_set_weather",
    {
      title: "Set world weather",
      description: "Set Minecraft weather to clear, rain, or thunder. Requires explicit confirmation.",
      inputSchema: z.object({
        weather: z.enum(["clear", "rain", "thunder"]),
        durationSeconds: z.number().int().min(1).max(1_000_000).optional(),
        confirmed: z.boolean().default(false)
      })
    },
    async ({ weather, durationSeconds, confirmed }) => {
      try {
        const { config, client, serverId } = await getRuntime();
        requireWrites(config);
        requireConfirmation(confirmed, `set the weather to ${weather}`);
        const command = `weather ${weather}${durationSeconds === undefined ? "" : ` ${durationSeconds}`}`;
        await client.runCommand(serverId, command);
        return textResult({ accepted: true, weather, durationSeconds: durationSeconds ?? null });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_set_gamerule",
    {
      title: "Set game rule",
      description: "Change a named Minecraft game rule. Requires explicit confirmation.",
      inputSchema: z.object({
        rule: z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,63}$/),
        value: z.union([z.string().regex(/^[A-Za-z0-9_.+-]{1,64}$/), z.number().int(), z.boolean()]),
        confirmed: z.boolean().default(false)
      })
    },
    async ({ rule, value, confirmed }) => {
      try {
        const { config, client, serverId } = await getRuntime();
        requireWrites(config);
        requireConfirmation(confirmed, `set gamerule ${rule} to ${value}`);
        await client.runCommand(serverId, `gamerule ${rule} ${value}`);
        return textResult({ accepted: true, rule, value });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_run_command",
    {
      title: "Run advanced console command",
      description: "Run one custom, modded, or advanced console command when typed tools do not cover the user's intent. Infer the exact syntax from available server context. Enabled by default in guarded mode and always requires confirmation.",
      inputSchema: z.object({ command: z.string(), confirmed: z.boolean().default(false) })
    },
    async ({ command, confirmed }) => {
      try {
        const { config, client, serverId } = await getRuntime();
        const validated = validateRawCommand(config, command);
        requireConfirmation(confirmed, `run the raw console command \"${validated.slice(0, 80)}\"`);
        await client.runCommand(serverId, validated);
        return textResult({ accepted: true, command: validated });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_list_player_lists",
    {
      title: "List player lists",
      description: "List available server-managed lists such as whitelist, ops, and bans.",
      inputSchema: z.object({})
    },
    async () => {
      try {
        const { client, serverId } = await getRuntime();
        return textResult(await client.listPlayerLists(serverId));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_get_player_list",
    {
      title: "Read player list",
      description: "Read one available player list by name.",
      inputSchema: z.object({ list: z.string().regex(/^[a-z0-9-]{1,40}$/) })
    },
    async ({ list }) => {
      try {
        const { client, serverId } = await getRuntime();
        return textResult({ list, entries: await client.getPlayerList(serverId, list) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_update_player_list",
    {
      title: "Update player list",
      description: "Add or remove entries from an available player list. Requires explicit confirmation.",
      inputSchema: z.object({
        list: z.string().regex(/^[a-z0-9-]{1,40}$/),
        operation: z.enum(["add", "remove"]),
        entries: z.array(z.string().min(1).max(100)).min(1).max(50),
        confirmed: z.boolean().default(false)
      })
    },
    async ({ list, operation, entries, confirmed }) => {
      try {
        const { config, client, serverId } = await getRuntime();
        requireWrites(config);
        requireConfirmation(confirmed, `${operation} ${entries.join(", ")} ${operation === "add" ? "to" : "from"} ${list}`);
        const result = operation === "add"
          ? await client.addPlayerListEntries(serverId, list, entries)
          : await client.removePlayerListEntries(serverId, list, entries);
        return textResult({ list, operation, entries: result });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_file_info",
    {
      title: "Inspect server file",
      description: "Inspect safe Exaroton metadata for a server file or directory.",
      inputSchema: z.object({ path: z.string().min(1).max(500) })
    },
    async ({ path }) => {
      try {
        const { client, serverId } = await getRuntime();
        return textResult(await client.getFileInfo(serverId, path));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_read_file",
    {
      title: "Read server text file",
      description: "Read a text file exposed as readable by Exaroton. The tool never writes or deletes files.",
      inputSchema: z.object({ path: z.string().min(1).max(500), maxCharacters: z.number().int().min(100).max(100_000).default(20_000) })
    },
    async ({ path, maxCharacters }) => {
      try {
        const { client, serverId } = await getRuntime();
        const info = await client.getFileInfo(serverId, path);
        if (!info.isReadable || !info.isTextFile) throw new Error("Exaroton does not expose this path as a readable text file.");
        const content = await client.readFile(serverId, path);
        return textResult({ path: info.path, truncated: content.length > maxCharacters, content: content.slice(0, maxCharacters) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_read_config",
    {
      title: "Read server configuration",
      description: "Read typed configuration options from an Exaroton-supported config file.",
      inputSchema: z.object({ path: z.string().min(1).max(500).default("server.properties") })
    },
    async ({ path }) => {
      try {
        const { client, serverId } = await getRuntime();
        return textResult({ path, options: await client.getConfig(serverId, path) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "minecraft_update_config",
    {
      title: "Update server configuration",
      description: "Update typed options in an Exaroton-supported config file. Does not restart the server. Requires confirmation.",
      inputSchema: z.object({
        path: z.string().min(1).max(500).default("server.properties"),
        changes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
          .refine((value) => Object.keys(value).length > 0, "At least one config change is required."),
        confirmed: z.boolean().default(false)
      })
    },
    async ({ path, changes, confirmed }) => {
      try {
        const { config, client, serverId } = await getRuntime();
        requireWrites(config);
        requireConfirmation(confirmed, `update ${path} with ${Object.keys(changes).join(", ")}`);
        const before = await client.getConfig(serverId, path);
        const allowed = new Set(before.map((option) => option.key));
        const unknown = Object.keys(changes).filter((key) => !allowed.has(key));
        if (unknown.length) throw new Error(`Unknown config option(s): ${unknown.join(", ")}. Read the config first and use returned keys.`);
        const after = await client.updateConfig(serverId, path, changes);
        return textResult({ updated: true, path, changedKeys: Object.keys(changes), options: after });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  return server;
}

export async function main(): Promise<void> {
  await serveStdio(() => createServer());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
