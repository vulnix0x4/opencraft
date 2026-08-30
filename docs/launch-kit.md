# OpenCraft launch kit

## Positioning

**One line:** I built an AI Minecraft server admin you can install and connect by pasting one sentence into Codex or Claude.

The interesting part is not “AI can send a console command.” It is the loop around that command: inspect current state, find evidence, explain the proposed action, require confirmation, execute a typed operation, and verify the result.

## 35-second screen recording

Record a clean AI chat window and the Minecraft client side-by-side. Use a throwaway token, blur it in the final edit, and hide the server address, player IPs, and private chat.

1. **0–5s:** Paste the one-sentence OpenCraft install and setup prompt, with the token area blurred.
2. **4–11s:** Let Codex return live status, player count, software, and RAM.
3. **11–20s:** Ask: `Give Luke 32 firework rockets.` Show the explicit confirmation step, confirm, then show the inventory update in Minecraft.
4. **20–30s:** Ask: `Why did the last startup fail?` Show the log evidence and a named mod/dependency cause. Do not manufacture a crash; use a real sanitized example or skip this shot.
5. **30–35s:** End on the wordmark and: `One sentence to install · 20+ typed tools · guarded by default · open source`.

Keep cuts tight. The setup sentence is the hook; compress the package-install wait into a jump cut.

## Draft post

> I built OpenCraft: an AI server admin for Minecraft that installs from one sentence.\n\nPaste a prompt into Codex or Claude, and it connects to Exaroton so you can ask who’s online, diagnose crashes, manage players, or restart safely.\n\nOpen source, typed tools, confirmation gates—not blind console access. 🧵

Suggested follow-up:

> v1 has 20+ MCP tools, one-sentence setup, read-only/guarded modes, deterministic crash signals, config inspection, and a raw-command escape hatch that is disabled by default. Built in TypeScript against Exaroton’s API.

## Demo prompts

- `Who is online and is the server healthy?`
- `Read the last 300 log lines and tell me what is actually wrong.`
- `Give Luke 32 firework rockets.`
- `Set the time to day and clear the weather.`
- `Turn keepInventory on, but show me exactly what will change first.`
- `Add Austin to the whitelist.`

## Before posting

- Revoke the token previously shared in chat and run setup with a fresh token.
- Use a test server or tell every online player before disruptive actions.
- Hide the Exaroton token, server ID, private address, IP bans, and unredacted logs.
- Make sure any player names shown are okay being public.
- Run `npm test` and `npm run doctor` immediately before recording.
- Do not imply that OpenCraft creates backups; v1 intentionally makes no such claim.
