# OpenCraft AI installation protocol

This file is for a local coding agent acting on this user request:

> Install OpenCraft, connect it to this AI client, and configure it with my supplied Exaroton token and server.

Complete the work without asking the user to run terminal commands. The user's inclusion of a token in this explicit setup request authorizes passing it to OpenCraft for local configuration. Never repeat the token in commentary, output, summaries, logs, or committed files.

## 1. Install

Choose a stable absolute directory outside a temporary folder. Clone `https://github.com/vulnix0x4/opencraft` there, or update an existing clean clone without discarding local changes. From the repository:

```bash
npm ci
npm run build
npm test
```

Node.js 20 or newer is required.

## 2. Configure from the request

Extract the token, exact server name/address/ID, safety mode, and raw-command preference from the user's sentence. Defaults are `guarded` and raw commands enabled. Run:

```bash
npm run connect -- --token "TOKEN_FROM_USER" --server "SERVER_FROM_USER" --mode guarded --raw true
```

If only one server exists, omit `--server`. The command validates the credential directly with Exaroton and stores it in `~/.config/opencraft/config.json` with mode `0600`. Do not place the token in `.mcp.json`, a repository file, or the final response.

## 3. Register the local MCP server

Use absolute paths in the registration command.

For Codex CLI, the Codex desktop app, or the Codex IDE extension:

```bash
codex mcp add opencraft -- node /ABSOLUTE/PATH/TO/opencraft/dist/server.js
```

For Claude Code:

```bash
claude mcp add opencraft --scope user -- node /ABSOLUTE/PATH/TO/opencraft/dist/server.js
```

Before adding, inspect the client's existing MCP list and avoid creating a duplicate. If OpenCraft already exists and points to the correct entry file, keep it.

## 4. Verify and finish

Run `npm run doctor`, then verify that the client lists OpenCraft. Tell the user only:

- OpenCraft is installed and configured;
- the selected server name and safety mode;
- whether a client restart/reconnect is required before the new tools appear.

Do not include the token. A newly added local MCP server may require restarting or reconnecting the client before it can be called in the current chat.

## 5. Companion behavior

Once connected, treat OpenCraft like a capable Minecraft co-admin rather than a command reference:

- Inspect status, players, logs, files, and configuration whenever that resolves missing context.
- Infer the server software/version and exact command syntax; do not ask the user to write commands for you.
- Prefer typed tools for common actions. Use `minecraft_run_command` for custom, modded, or advanced actions that typed tools cannot express.
- Keep replies brief, casual, direct, and lightly playful. Skip process narration and long explanations unless the user asks.
- For a mutation, state the exact effect and request any required confirmation in one short sentence. Do not add extra questionnaires.
- Never reveal credentials, broaden the selected server scope, or claim a backup was created.
