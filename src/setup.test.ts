import { describe, expect, it, vi } from "vitest";
import { connectOpenCraft, resolveServer } from "./setup.js";
import type { ExarotonServer } from "./types.js";

function server(id: string, name: string, address: string): ExarotonServer {
  return {
    id,
    name,
    address,
    motd: "",
    status: 1,
    host: null,
    port: null,
    players: { max: 20, count: 0, list: [] },
    software: null,
    shared: false
  };
}

const servers = [
  server("alpha-id", "Alpha Realm", "alpha.exaroton.me"),
  server("beta-id", "Beta Realm", "beta.exaroton.me")
];

describe("chat setup", () => {
  it("resolves a server by exact id, name, or address without case sensitivity", () => {
    expect(resolveServer(servers, "ALPHA REALM").id).toBe("alpha-id");
    expect(resolveServer(servers, "beta.exaroton.me").id).toBe("beta-id");
    expect(resolveServer(servers, "alpha-id").name).toBe("Alpha Realm");
  });

  it("requires a server name when the account has multiple choices", () => {
    expect(() => resolveServer(servers)).toThrow(/More than one server/);
    expect(() => resolveServer(servers, "missing")).toThrow(/Available servers/);
  });

  it("verifies, persists, and returns no credential", async () => {
    const persist = vi.fn().mockResolvedValue("/private/config.json");
    const result = await connectOpenCraft({
      apiToken: "  test-token-that-is-long-enough  ",
      server: "Alpha Realm",
      safetyMode: "read-only",
      allowRawCommands: true
    }, {
      createClient: () => ({ listServers: async () => servers }),
      persist,
      now: () => new Date("2026-08-30T00:00:00.000Z")
    });

    expect(result).not.toHaveProperty("apiToken");
    expect(result.allowRawCommands).toBe(false);
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({
      apiToken: "test-token-that-is-long-enough",
      serverId: "alpha-id",
      safetyMode: "read-only",
      allowRawCommands: false
    }));
  });
});
