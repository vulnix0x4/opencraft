import { describe, expect, it, vi } from "vitest";
import { ExarotonApiError, ExarotonClient } from "./exaroton.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("ExarotonClient", () => {
  it("authenticates and unwraps successful responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      success: true,
      error: null,
      data: [{ id: "abc", name: "Demo" }]
    }));
    const client = new ExarotonClient("secret", "https://example.test/v1", fetcher);
    await expect(client.listServers()).resolves.toEqual([{ id: "abc", name: "Demo" }]);
    expect(fetcher).toHaveBeenCalledWith("https://example.test/v1/servers/", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer secret" })
    }));
  });

  it("returns a safe credential error without exposing the token", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ success: false, error: null, data: null }, 401));
    const client = new ExarotonClient("super-secret-token", "https://example.test/v1", fetcher);
    const promise = client.listServers();
    await expect(promise).rejects.toBeInstanceOf(ExarotonApiError);
    await expect(promise).rejects.not.toThrow(/super-secret-token/);
  });

  it("encodes remote file paths without permitting traversal", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("ok", {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" }
    }));
    const client = new ExarotonClient("secret", "https://example.test/v1", fetcher);
    await expect(client.readFile("server", "config/my file.toml")).resolves.toBe("ok");
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.test/v1/servers/server/files/data/config/my%20file.toml/",
      expect.any(Object)
    );
    expect(() => client.readFile("server", "../secret")).toThrow(/cannot contain/);
  });

  it("updates the MOTD through its dedicated server option endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      success: true,
      error: null,
      data: { motd: "join or get slimed" }
    }));
    const client = new ExarotonClient("secret", "https://example.test/v1", fetcher);

    await expect(client.setMotd("server/id", "join or get slimed")).resolves.toEqual({
      motd: "join or get slimed"
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.test/v1/servers/server%2Fid/options/motd/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ motd: "join or get slimed" })
      })
    );
  });

  it("accepts null data from successful action endpoints", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      success: true,
      error: null,
      data: null
    }));
    const client = new ExarotonClient("secret", "https://example.test/v1", fetcher);

    await expect(client.runCommand("server", "say locked in")).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.test/v1/servers/server/command/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ command: "say locked in" })
      })
    );
  });

  const endpointCases: Array<{
    name: string;
    invoke: (client: ExarotonClient) => Promise<unknown>;
    method: string;
    endpoint: string;
    body?: unknown;
    data: unknown;
  }> = [
    { name: "get server", invoke: (client) => client.getServer("server/id"), method: "GET", endpoint: "/servers/server%2Fid", data: { id: "server/id" } },
    { name: "get logs", invoke: (client) => client.getLogs("server/id"), method: "GET", endpoint: "/servers/server%2Fid/logs/", data: { content: "ok" } },
    { name: "get RAM", invoke: (client) => client.getRam("server/id"), method: "GET", endpoint: "/servers/server%2Fid/options/ram/", data: { ram: 4 } },
    { name: "start", invoke: (client) => client.start("server/id"), method: "GET", endpoint: "/servers/server%2Fid/start/", data: null },
    { name: "stop", invoke: (client) => client.stop("server/id"), method: "GET", endpoint: "/servers/server%2Fid/stop/", data: null },
    { name: "restart", invoke: (client) => client.restart("server/id"), method: "GET", endpoint: "/servers/server%2Fid/restart/", data: null },
    { name: "list player lists", invoke: (client) => client.listPlayerLists("server/id"), method: "GET", endpoint: "/servers/server%2Fid/playerlists/", data: ["ops"] },
    { name: "get player list", invoke: (client) => client.getPlayerList("server/id", "white list"), method: "GET", endpoint: "/servers/server%2Fid/playerlists/white%20list/", data: ["Luke"] },
    { name: "add player list entries", invoke: (client) => client.addPlayerListEntries("server/id", "ops", ["Luke"]), method: "PUT", endpoint: "/servers/server%2Fid/playerlists/ops/", body: { entries: ["Luke"] }, data: ["Luke"] },
    { name: "remove player list entries", invoke: (client) => client.removePlayerListEntries("server/id", "ops", ["Luke"]), method: "DELETE", endpoint: "/servers/server%2Fid/playerlists/ops/", body: { entries: ["Luke"] }, data: [] },
    { name: "get file info", invoke: (client) => client.getFileInfo("server/id", "config/mod.json"), method: "GET", endpoint: "/servers/server%2Fid/files/info/config/mod.json/", data: { path: "config/mod.json" } },
    { name: "get config", invoke: (client) => client.getConfig("server/id", "server.properties"), method: "GET", endpoint: "/servers/server%2Fid/files/config/server.properties/", data: [{ key: "motd" }] },
    { name: "update config", invoke: (client) => client.updateConfig("server/id", "server.properties", { motd: "hi" }), method: "POST", endpoint: "/servers/server%2Fid/files/config/server.properties/", body: { motd: "hi" }, data: [{ key: "motd", value: "hi" }] }
  ];

  it.each(endpointCases)("uses the documented endpoint for $name", async ({ invoke, method, endpoint, body, data }) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ success: true, error: null, data }));
    const client = new ExarotonClient("secret", "https://example.test/v1", fetcher);

    await expect(invoke(client)).resolves.toEqual(data);
    expect(fetcher).toHaveBeenCalledWith(
      `https://example.test/v1${endpoint}`,
      expect.objectContaining({
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      })
    );
  });

  it("preserves a safe API error message and status", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      success: false,
      error: "Server is already online.",
      data: null
    }, 409));
    const client = new ExarotonClient("secret", "https://example.test/v1", fetcher);

    await expect(client.start("server")).rejects.toMatchObject({
      name: "ExarotonApiError",
      message: "Server is already online.",
      status: 409
    });
  });

  it("reports unreadable, network, and timeout responses safely", async () => {
    const unreadable = new ExarotonClient("secret", "https://example.test/v1", vi.fn<typeof fetch>()
      .mockResolvedValue(new Response("not-json", { status: 502 })));
    await expect(unreadable.listServers()).rejects.toThrow("unreadable response (HTTP 502)");

    const network = new ExarotonClient("secret", "https://example.test/v1", vi.fn<typeof fetch>()
      .mockRejectedValue(new Error("socket included a secret")));
    await expect(network.listServers()).rejects.toThrow("Could not reach the Exaroton API.");

    const timeoutError = new Error("timed out");
    timeoutError.name = "TimeoutError";
    const timeout = new ExarotonClient("secret", "https://example.test/v1", vi.fn<typeof fetch>()
      .mockRejectedValue(timeoutError));
    await expect(timeout.listServers()).rejects.toThrow("The Exaroton API request timed out.");
  });
});
