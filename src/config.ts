import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod/v4";
import type { OpenCraftConfig, SafetyMode } from "./types.js";

const configSchema = z.object({
  version: z.literal(1),
  apiToken: z.string().min(20),
  serverId: z.string().min(1),
  serverName: z.string().min(1),
  safetyMode: z.enum(["read-only", "guarded"]),
  allowRawCommands: z.boolean(),
  createdAt: z.string()
});

export class OpenCraftConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenCraftConfigError";
  }
}

export function getConfigPath(): string {
  if (process.env.OPENCRAFT_CONFIG_PATH) return path.resolve(process.env.OPENCRAFT_CONFIG_PATH);
  const base = process.env.XDG_CONFIG_HOME
    ? path.resolve(process.env.XDG_CONFIG_HOME)
    : path.join(os.homedir(), ".config");
  return path.join(base, "opencraft", "config.json");
}

function envSafetyMode(value: string | undefined): SafetyMode | undefined {
  return value === "read-only" || value === "guarded" ? value : undefined;
}

export async function loadConfig(): Promise<OpenCraftConfig> {
  let stored: OpenCraftConfig | undefined;
  try {
    const raw = await readFile(getConfigPath(), "utf8");
    stored = configSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        throw new OpenCraftConfigError(`OpenCraft configuration is invalid. Run \"opencraft setup\" to repair it.`);
      }
      throw error;
    }
  }

  const apiToken = process.env.EXAROTON_API_TOKEN ?? stored?.apiToken;
  const serverId = process.env.EXAROTON_SERVER_ID ?? stored?.serverId;
  if (!apiToken || !serverId) {
    throw new OpenCraftConfigError(`OpenCraft is not configured. Paste the one-sentence setup request in chat or run \"opencraft setup\" in a local terminal.`);
  }

  return {
    version: 1,
    apiToken,
    serverId,
    serverName: stored?.serverName ?? serverId,
    safetyMode: envSafetyMode(process.env.OPENCRAFT_SAFETY_MODE) ?? stored?.safetyMode ?? "guarded",
    allowRawCommands: stored?.allowRawCommands ?? true,
    createdAt: stored?.createdAt ?? new Date().toISOString()
  };
}

export async function saveConfig(config: OpenCraftConfig): Promise<string> {
  const validated = configSchema.parse(config);
  const destination = getConfigPath();
  const directory = path.dirname(destination);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);

  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, destination);
  await chmod(destination, 0o600);
  return destination;
}

export function publicConfig(config: OpenCraftConfig) {
  return {
    serverId: config.serverId,
    serverName: config.serverName,
    safetyMode: config.safetyMode,
    allowRawCommands: config.allowRawCommands,
    credentialSource: process.env.EXAROTON_API_TOKEN ? "environment" : "local config"
  };
}
