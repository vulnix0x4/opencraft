# OpenCraft

> Talk to your Minecraft server.

[![CI](https://github.com/vulnix0x4/opencraft/actions/workflows/ci.yml/badge.svg)](https://github.com/vulnix0x4/opencraft/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-69F0AE.svg)](LICENSE)

OpenCraft is an open-source AI server admin for Minecraft, powered by the Exaroton API. It gives Codex, Claude Code, and other local MCP clients typed tools for status, logs, crash diagnosis, players, configuration, and guarded server actions.

```text
You:   Why did the server crash?
AI:    The log shows a Fabric mixin failure in sodium-extra immediately before
       the tick loop stopped. The installed build targets a different Minecraft
       version. I have not changed or restarted anything.

You:   Give Luke 32 firework rockets.
AI:    This changes Luke's inventory. Confirm the grant?
You:   Yes.
AI:    Done — Exaroton accepted 32 minecraft:firework_rocket for Luke.
```

## One-sentence AI setup

Copy this sentence into Codex or Claude Code, replacing the two placeholders:

```text
Install OpenCraft from https://github.com/vulnix0x4/opencraft, add it to this AI client as a local MCP server, and configure my Exaroton server named SERVER_NAME using API token EXAROTON_API_TOKEN in guarded mode with raw commands enabled.
```

That is the whole user-facing setup. The coding agent should clone the repository, run `npm install` and `npm run build`, register `.mcp.json` with the client, and configure OpenCraft non-interactively with:

The repository includes [INSTALL_FOR_AI.md](INSTALL_FOR_AI.md), a deterministic install runbook for the agent to follow on Codex or Claude Code.

```bash
npm run connect -- --token "EXAROTON_API_TOKEN" --server "SERVER_NAME" --mode guarded --raw true
```

The token is verified directly against Exaroton, written to `~/.config/opencraft/config.json` with owner-only permissions, and omitted from all OpenCraft responses. Some MCP clients require one restart or reconnect after installing a new local server; configuration itself still happens from the original chat request.

Once OpenCraft is already installed, setup is even shorter:

```text
Set up OpenCraft with Exaroton API token EXAROTON_API_TOKEN for server SERVER_NAME in guarded mode with raw commands enabled.
```

The AI calls `opencraft_connect`, so there is no terminal wizard and no follow-up questionnaire. If the account has exactly one server, `SERVER_NAME` can be omitted.

## What works

- Server status, software, address, RAM, and online players
- Recent logs with control-code cleanup
- Deterministic crash, mod, memory, authentication, and tick-lag signals
- Start, stop, and restart with explicit confirmation
- Typed item grants, teleports, game modes, time, weather, game rules, and broadcasts
- Whitelist, operator, and ban-list inspection and updates
- Safe file metadata, text-file reads, and typed configuration updates
- Raw console escape hatch, enabled by default in guarded mode

## Manual setup

Requirements: Node.js 20 or newer and an Exaroton account with API access.

```bash
npm install
npm run build
npm run setup
```

The manual wizard masks the token, verifies it with Exaroton, lets you select a server and safety mode, and writes the same owner-only configuration used by chat setup.

Verify an installation with:

```bash
npm run doctor
npm test
```

## Safety model

OpenCraft is guarded by default. Every input is schema-validated, Minecraft names and resource IDs are constrained, high-impact actions require explicit confirmation, and raw commands are enabled by default but still confirmed and filtered. Read-only mode disables every mutation.

Starting a server can consume Exaroton credits. Restarting or stopping disconnects players. OpenCraft calls those effects out before acting.

OpenCraft does **not** claim to create backups: Exaroton's public API currently has no documented backup endpoint. File deletion and arbitrary file writes are intentionally absent from v1.

## Development

```bash
npm run check
npm test
npm run build
```

Tests use mocked API responses and never touch a real Minecraft server. The MCP transport uses stdout exclusively; diagnostics and process messages go to stderr.

## Architecture

```text
Codex / Claude / MCP client
          │ MCP over stdio
          ▼
      OpenCraft
        ├─ one-sentence setup
        ├─ typed tools + confirmation gates
        ├─ deterministic log diagnostics
        ├─ secret-safe local configuration
        └─ Exaroton REST client
                  │
                  ▼
          Minecraft server
```

## License

MIT. OpenCraft is an independent project and is not affiliated with or endorsed by Exaroton or Mojang Studios.
