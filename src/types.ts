export type SafetyMode = "read-only" | "guarded";

export interface OpenCraftConfig {
  version: 1;
  apiToken: string;
  serverId: string;
  serverName: string;
  safetyMode: SafetyMode;
  allowRawCommands: boolean;
  createdAt: string;
}

export interface PlayerSummary {
  max: number;
  count: number;
  list: string[];
}

export interface SoftwareSummary {
  id: string;
  name: string;
  version: string;
}

export interface ExarotonServer {
  id: string;
  name: string;
  address: string;
  motd: string;
  status: number;
  host: string | null;
  port: number | null;
  players: PlayerSummary;
  software: SoftwareSummary | null;
  shared: boolean;
}

export interface ExarotonFileInfo {
  path: string;
  name: string;
  isTextFile: boolean;
  isConfigFile: boolean;
  isDirectory: boolean;
  isLog: boolean;
  isReadable: boolean;
  isWritable: boolean;
  size: number;
  children?: ExarotonFileInfo[];
}

export interface ExarotonConfigOption {
  key: string;
  label: string;
  type: "string" | "integer" | "float" | "boolean" | "multiselect" | "select";
  value: unknown;
  options?: unknown[];
}

export interface ExarotonEnvelope<T> {
  success: boolean;
  error: string | null;
  data: T | null;
}
