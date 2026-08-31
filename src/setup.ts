import { saveConfig } from "./config.js";
import { ExarotonClient } from "./exaroton.js";
import type { OpenCraftConfig, ExarotonServer, SafetyMode } from "./types.js";

export interface ConnectOpenCraftInput {
  apiToken: string;
  server?: string | undefined;
  safetyMode?: SafetyMode;
  allowRawCommands?: boolean;
}

interface SetupClient {
  listServers(): Promise<ExarotonServer[]>;
}

export interface ConnectOpenCraftDependencies {
  createClient?: (apiToken: string) => SetupClient;
  persist?: (config: OpenCraftConfig) => Promise<string>;
  now?: () => Date;
}

function safeServerChoices(servers: ExarotonServer[]): string {
  return servers.map((server) => `${server.name} (${server.address})`).join(", ");
}

export function resolveServer(servers: ExarotonServer[], requested?: string): ExarotonServer {
  if (!servers.length) {
    throw new Error("This Exaroton account does not have access to any servers.");
  }

  const query = requested?.trim().toLocaleLowerCase();
  if (!query) {
    if (servers.length === 1) return servers[0]!;
    throw new Error(`More than one server is available. Name one in the setup sentence: ${safeServerChoices(servers)}.`);
  }

  const matches = servers.filter((server) =>
    [server.id, server.name, server.address].some((value) => value.toLocaleLowerCase() === query)
  );
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new Error(`"${requested}" matches more than one server. Use its exact address or ID.`);
  }
  throw new Error(`No accessible server matches "${requested}". Available servers: ${safeServerChoices(servers)}.`);
}

export async function connectOpenCraft(
  input: ConnectOpenCraftInput,
  dependencies: ConnectOpenCraftDependencies = {}
) {
  const apiToken = input.apiToken.trim();
  const createClient = dependencies.createClient ?? ((token: string) => new ExarotonClient(token));
  const persist = dependencies.persist ?? saveConfig;
  const selected = resolveServer(await createClient(apiToken).listServers(), input.server);
  const safetyMode = input.safetyMode ?? "guarded";
  const config: OpenCraftConfig = {
    version: 1,
    apiToken,
    serverId: selected.id,
    serverName: selected.name,
    safetyMode,
    allowRawCommands: safetyMode === "guarded" && (input.allowRawCommands ?? true),
    createdAt: (dependencies.now?.() ?? new Date()).toISOString()
  };
  const configPath = await persist(config);

  return {
    configured: true,
    server: {
      id: selected.id,
      name: selected.name,
      address: selected.address,
      status: selected.status
    },
    safetyMode: config.safetyMode,
    allowRawCommands: config.allowRawCommands,
    credentialStored: true,
    configPath,
    message: "OpenCraft is connected. The API token was verified and will not be shown."
  };
}
