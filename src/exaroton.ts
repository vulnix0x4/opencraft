import type {
  ExarotonConfigOption,
  ExarotonEnvelope,
  ExarotonFileInfo,
  ExarotonServer
} from "./types.js";

const DEFAULT_API_BASE = "https://api.exaroton.com/v1";

export class ExarotonApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "ExarotonApiError";
  }
}

function remotePath(value: string): string {
  const normalized = value.trim().replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized.includes("\0")) throw new ExarotonApiError("A non-empty remote path is required.");
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new ExarotonApiError("Remote paths cannot contain empty, '.' or '..' segments.");
  }
  return segments.map(encodeURIComponent).join("/");
}

export class ExarotonClient {
  constructor(
    private readonly token: string,
    private readonly apiBase = DEFAULT_API_BASE,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  private async request<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.apiBase}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" })
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15_000)
      });
    } catch (error) {
      const message = error instanceof Error && error.name === "TimeoutError"
        ? "The Exaroton API request timed out."
        : "Could not reach the Exaroton API.";
      throw new ExarotonApiError(message);
    }

    let envelope: ExarotonEnvelope<T>;
    try {
      envelope = (await response.json()) as ExarotonEnvelope<T>;
    } catch {
      throw new ExarotonApiError(`Exaroton returned an unreadable response (HTTP ${response.status}).`, response.status);
    }

    if (!response.ok || !envelope.success || envelope.data === null) {
      const fallback = response.status === 401 || response.status === 403
        ? "The Exaroton credential was rejected. Run \"opencraft setup\" with a fresh token."
        : `Exaroton request failed (HTTP ${response.status}).`;
      throw new ExarotonApiError(envelope.error || fallback, response.status);
    }
    return envelope.data;
  }

  private async requestText(endpoint: string): Promise<string> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.apiBase}${endpoint}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/octet-stream"
        },
        signal: AbortSignal.timeout(15_000)
      });
    } catch (error) {
      const message = error instanceof Error && error.name === "TimeoutError"
        ? "The Exaroton file request timed out."
        : "Could not reach the Exaroton API.";
      throw new ExarotonApiError(message);
    }

    if (!response.ok) {
      let apiMessage: string | undefined;
      try {
        const envelope = (await response.json()) as ExarotonEnvelope<unknown>;
        apiMessage = envelope.error ?? undefined;
      } catch {
        // The API may return a non-JSON proxy error. Use the safe fallback below.
      }
      const fallback = response.status === 401 || response.status === 403
        ? "The Exaroton credential was rejected. Run \"opencraft setup\" with a fresh token."
        : `Exaroton file request failed (HTTP ${response.status}).`;
      throw new ExarotonApiError(apiMessage || fallback, response.status);
    }
    return response.text();
  }

  listServers(): Promise<ExarotonServer[]> {
    return this.request("GET", "/servers/");
  }

  getServer(serverId: string): Promise<ExarotonServer> {
    return this.request("GET", `/servers/${encodeURIComponent(serverId)}`);
  }

  getLogs(serverId: string): Promise<{ content: string | null }> {
    return this.request("GET", `/servers/${encodeURIComponent(serverId)}/logs/`);
  }

  getRam(serverId: string): Promise<{ ram: number }> {
    return this.request("GET", `/servers/${encodeURIComponent(serverId)}/options/ram/`);
  }

  setMotd(serverId: string, motd: string): Promise<{ motd: string }> {
    return this.request("POST", `/servers/${encodeURIComponent(serverId)}/options/motd/`, { motd });
  }

  start(serverId: string): Promise<unknown> {
    return this.request("GET", `/servers/${encodeURIComponent(serverId)}/start/`);
  }

  stop(serverId: string): Promise<unknown> {
    return this.request("GET", `/servers/${encodeURIComponent(serverId)}/stop/`);
  }

  restart(serverId: string): Promise<unknown> {
    return this.request("GET", `/servers/${encodeURIComponent(serverId)}/restart/`);
  }

  runCommand(serverId: string, command: string): Promise<unknown> {
    return this.request("POST", `/servers/${encodeURIComponent(serverId)}/command/`, { command });
  }

  listPlayerLists(serverId: string): Promise<string[]> {
    return this.request("GET", `/servers/${encodeURIComponent(serverId)}/playerlists/`);
  }

  getPlayerList(serverId: string, list: string): Promise<string[]> {
    return this.request("GET", `/servers/${encodeURIComponent(serverId)}/playerlists/${encodeURIComponent(list)}/`);
  }

  addPlayerListEntries(serverId: string, list: string, entries: string[]): Promise<string[]> {
    return this.request("PUT", `/servers/${encodeURIComponent(serverId)}/playerlists/${encodeURIComponent(list)}/`, { entries });
  }

  removePlayerListEntries(serverId: string, list: string, entries: string[]): Promise<string[]> {
    return this.request("DELETE", `/servers/${encodeURIComponent(serverId)}/playerlists/${encodeURIComponent(list)}/`, { entries });
  }

  getFileInfo(serverId: string, path: string): Promise<ExarotonFileInfo> {
    return this.request("GET", `/servers/${encodeURIComponent(serverId)}/files/info/${remotePath(path)}/`);
  }

  readFile(serverId: string, path: string): Promise<string> {
    return this.requestText(`/servers/${encodeURIComponent(serverId)}/files/data/${remotePath(path)}/`);
  }

  getConfig(serverId: string, path: string): Promise<ExarotonConfigOption[]> {
    return this.request("GET", `/servers/${encodeURIComponent(serverId)}/files/config/${remotePath(path)}/`);
  }

  updateConfig(serverId: string, path: string, changes: Record<string, unknown>): Promise<ExarotonConfigOption[]> {
    return this.request("POST", `/servers/${encodeURIComponent(serverId)}/files/config/${remotePath(path)}/`, changes);
  }
}
