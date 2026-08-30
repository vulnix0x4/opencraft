import type { OpenCraftConfig } from "./types.js";

export class OpenCraftSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenCraftSafetyError";
  }
}

export function requireWrites(config: OpenCraftConfig): void {
  if (config.safetyMode === "read-only") {
    throw new OpenCraftSafetyError("This action is disabled in read-only mode. Run \"opencraft setup\" to change safety mode.");
  }
}

export function requireConfirmation(confirmed: boolean, action: string): void {
  if (!confirmed) {
    throw new OpenCraftSafetyError(`Confirmation required: explicitly confirm that you want to ${action}.`);
  }
}

export function minecraftName(value: string, label = "player"): string {
  const name = value.trim();
  if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) {
    throw new OpenCraftSafetyError(`${label} must be a valid Minecraft username.`);
  }
  return name;
}

export function resourceLocation(value: string): string {
  const item = value.trim().toLowerCase();
  if (!/^(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+$/.test(item) || item.includes("..")) {
    throw new OpenCraftSafetyError("Item must be a valid Minecraft resource location, such as minecraft:firework_rocket.");
  }
  return item.includes(":") ? item : `minecraft:${item}`;
}

export function safeChatMessage(value: string): string {
  const message = value.trim();
  if (!message || message.length > 240 || /[\r\n\0]/.test(message)) {
    throw new OpenCraftSafetyError("Messages must contain 1–240 characters and no line breaks.");
  }
  return message;
}

export function validateRawCommand(config: OpenCraftConfig, command: string): string {
  requireWrites(config);
  if (!config.allowRawCommands) {
    throw new OpenCraftSafetyError("Raw commands are disabled. Prefer a typed tool or enable raw commands with \"opencraft setup\".");
  }
  const clean = command.trim().replace(/^\//, "");
  if (!clean || clean.length > 500 || /[\r\n\0]/.test(clean)) {
    throw new OpenCraftSafetyError("Raw commands must be a single line no longer than 500 characters.");
  }
  const root = clean.split(/\s+/, 1)[0]?.toLowerCase();
  const blocked = new Set(["stop", "save-off", "op", "deop", "ban-ip", "pardon-ip"]);
  if (root && blocked.has(root)) {
    throw new OpenCraftSafetyError(`The raw command \"${root}\" is blocked. Use a dedicated, auditable tool instead.`);
  }
  return clean;
}
