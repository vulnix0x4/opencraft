# Security

## Credentials

OpenCraft supports intentional one-sentence setup in a private AI coding-agent chat. The agent must pass the token only to `opencraft_connect` or the non-interactive `opencraft connect` command and must never quote it back, log it, commit it, or include it in tool output. The masked `opencraft setup` wizard and `EXAROTON_API_TOKEN` environment variable remain available.

OpenCraft writes its configuration with mode `0600` inside an owner-only directory. Anyone who obtains that file can operate servers available to the token, so protect it like a password.

If a token appears in a public chat, screenshot, terminal history, Git commit, or any place you did not intend, revoke it immediately in Exaroton account settings and generate a new one.

## Reporting

Do not include API tokens, server addresses intended to be private, player IP addresses, or unredacted logs in a security report.
