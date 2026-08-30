import { describe, expect, it } from "vitest";
import { diagnoseLog, tailLog } from "./diagnostics.js";
import { minecraftName, resourceLocation, validateRawCommand } from "./safety.js";
import type { OpenCraftConfig } from "./types.js";

const guarded: OpenCraftConfig = {
  version: 1,
  apiToken: "test-token-that-is-long-enough",
  serverId: "server",
  serverName: "Test",
  safetyMode: "guarded",
  allowRawCommands: true,
  createdAt: "2026-01-01T00:00:00.000Z"
};

describe("command safety", () => {
  it("accepts valid Minecraft names and resources", () => {
    expect(minecraftName("Luke_42")).toBe("Luke_42");
    expect(resourceLocation("firework_rocket")).toBe("minecraft:firework_rocket");
    expect(resourceLocation("create:brass_ingot")).toBe("create:brass_ingot");
  });

  it("rejects command injection and blocked raw commands", () => {
    expect(() => minecraftName("Luke\nstop")).toThrow();
    expect(() => validateRawCommand(guarded, "stop")).toThrow(/blocked/);
    expect(() => validateRawCommand(guarded, "say hello\nstop")).toThrow(/single line/);
  });

  it("blocks all raw commands unless explicitly enabled", () => {
    expect(() => validateRawCommand({ ...guarded, allowRawCommands: false }, "time set day")).toThrow(/disabled/);
  });
});

describe("diagnostics", () => {
  it("strips terminal codes and tails logs", () => {
    expect(tailLog("one\n\u001b[31mtwo\u001b[0m\nthree", 2)).toBe("two\nthree");
  });

  it("detects useful high-confidence patterns", () => {
    const signals = diagnoseLog("[Server thread/WARN]: Can't keep up! Is the server overloaded?\njava.lang.OutOfMemoryError: Java heap space");
    expect(signals.map((signal) => signal.code)).toEqual(["out-of-memory", "tick-lag"]);
  });
});
