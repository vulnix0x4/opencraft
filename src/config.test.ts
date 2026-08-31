import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getConfigPath, loadConfig, publicConfig, saveConfig } from "./config.js";
import type { OpenCraftConfig } from "./types.js";

const temporaryDirectories: string[] = [];
const originalConfigPath = process.env.OPENCRAFT_CONFIG_PATH;
const originalToken = process.env.EXAROTON_API_TOKEN;
const originalServerId = process.env.EXAROTON_SERVER_ID;

afterEach(async () => {
  if (originalConfigPath === undefined) delete process.env.OPENCRAFT_CONFIG_PATH;
  else process.env.OPENCRAFT_CONFIG_PATH = originalConfigPath;
  if (originalToken === undefined) delete process.env.EXAROTON_API_TOKEN;
  else process.env.EXAROTON_API_TOKEN = originalToken;
  if (originalServerId === undefined) delete process.env.EXAROTON_SERVER_ID;
  else process.env.EXAROTON_SERVER_ID = originalServerId;
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("local configuration", () => {
  it("stores credentials outside the project with owner-only permissions", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencraft-config-test-"));
    temporaryDirectories.push(directory);
    process.env.OPENCRAFT_CONFIG_PATH = path.join(directory, "nested", "config.json");
    delete process.env.EXAROTON_API_TOKEN;
    delete process.env.EXAROTON_SERVER_ID;

    const config: OpenCraftConfig = {
      version: 1,
      apiToken: "test-token-that-is-long-enough",
      serverId: "server-123",
      serverName: "Demo server",
      safetyMode: "guarded",
      allowRawCommands: false,
      createdAt: "2026-01-01T00:00:00.000Z"
    };
    await saveConfig(config);

    expect(getConfigPath()).toBe(process.env.OPENCRAFT_CONFIG_PATH);
    expect((await stat(getConfigPath())).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(getConfigPath(), "utf8"))).toEqual(config);
    await expect(loadConfig()).resolves.toEqual(config);
    expect(publicConfig(config)).not.toHaveProperty("apiToken");
  });

  it("migrates legacy configs that predate the raw-command preference", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencraft-legacy-config-test-"));
    temporaryDirectories.push(directory);
    process.env.OPENCRAFT_CONFIG_PATH = path.join(directory, "config.json");
    delete process.env.EXAROTON_API_TOKEN;
    delete process.env.EXAROTON_SERVER_ID;
    await writeFile(process.env.OPENCRAFT_CONFIG_PATH, JSON.stringify({
      version: 1,
      apiToken: "legacy-token-that-is-long-enough",
      serverId: "legacy-server",
      serverName: "Legacy server",
      safetyMode: "guarded",
      createdAt: "2026-01-01T00:00:00.000Z"
    }));

    await expect(loadConfig()).resolves.toMatchObject({ allowRawCommands: true });
  });

  it("ignores blank environment overrides instead of breaking stored credentials", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencraft-empty-env-test-"));
    temporaryDirectories.push(directory);
    process.env.OPENCRAFT_CONFIG_PATH = path.join(directory, "config.json");
    const config: OpenCraftConfig = {
      version: 1,
      apiToken: "stored-token-that-is-long-enough",
      serverId: "stored-server",
      serverName: "Stored server",
      safetyMode: "guarded",
      allowRawCommands: true,
      createdAt: "2026-01-01T00:00:00.000Z"
    };
    await saveConfig(config);
    process.env.EXAROTON_API_TOKEN = "   ";
    process.env.EXAROTON_SERVER_ID = "";

    await expect(loadConfig()).resolves.toEqual(config);
    expect(publicConfig(config).credentialSource).toBe("local config");
  });
});
