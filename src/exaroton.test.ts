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
});
