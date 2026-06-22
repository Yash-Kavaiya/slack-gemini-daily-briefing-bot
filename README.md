# Pulse — Slack Agent

Pulse is a production-grade Slack agent powered by **Google Gemini** with native
**Google Search grounding**. It answers questions on demand in Slack with cited sources,
posts a scheduled **daily briefing**, integrates with the **Model Context Protocol (MCP)**
as both a client and a server, and keeps conversation context within Slack threads.

## Features

- **On-demand Q&A + real-time search** — mention the bot, DM it, or run `/pulse <question>`.
  Gemini answers grounded with live Google Search results and cites its sources.
- **Daily briefing** — a cron job posts a digest of configured topics to a channel.
- **MCP client** — connects to external MCP servers and exposes their tools to the agent.
- **MCP server** — exposes Pulse's `ask` / `search` / `daily_briefing` tools over stdio so
  other agents (e.g. Claude) can drive it.
- **Thread memory** — follow-up questions in a thread retain context (reconstructed from the
  Slack thread; no database).
- **Enterprise quality** — strict TypeScript, structured logging with secret redaction,
  validated config, resilient error handling, unit tests, lint/format, Docker, and CI.

## Architecture

A single shared core (Gemini agent, MCP client, config, logging) is consumed by two
entrypoints: the **Slack app** (`src/index.ts`, Bolt Socket Mode + in-process cron) and the
**MCP server** (`src/mcp/server.ts`, stdio).

```
src/
  index.ts              # Slack-app entrypoint: wiring + graceful shutdown
  config.ts             # zod-validated environment config
  logger.ts             # pino logger with secret redaction
  health.ts             # GET /healthz for container probes
  agent/
    gemini.ts           # GeminiAgent.ask(history, tools) — search grounding + tool loop
    types.ts            # AgentResponse, Citation, ChatMessage, AgentTool
  mcp/
    client.ts           # connect external MCP servers; expose their tools to Gemini
    server.ts           # Pulse MCP stdio server: ask / search / daily_briefing
  slack/
    app.ts              # Bolt Socket Mode factory
    format.ts           # Block Kit rendering
    thread.ts           # Slack thread -> agent history (memory)
    handlers/respond.ts # testable respond core
  briefing/
    briefing.ts         # buildBriefing() via the agent
    scheduler.ts        # node-cron scheduler
```

**Data flow (Q&A):** Slack event → build thread history → `GeminiAgent.ask()` (Google Search
+ MCP tools, with a bounded tool-call loop) → `{ text, citations }` → Block Kit → threaded reply.

## Prerequisites

- Node.js >= 20 (developed on Node 22)
- A Slack app with **Socket Mode** enabled
- A Google Gemini API key — https://aistudio.google.com/apikey

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your environment file and fill in the values:
   ```bash
   cp .env.example .env
   ```
3. Create the Slack app. The fastest path is to import `slack-app-manifest.yaml`:
   - Go to https://api.slack.com/apps → **Create New App** → **From an app manifest**
   - Paste the contents of `slack-app-manifest.yaml`
   - Install the app to your workspace, then copy:
     - **Bot User OAuth Token** (`xoxb-…`) → `SLACK_BOT_TOKEN`
     - **App-Level Token** with `connections:write` (`xapp-…`) → `SLACK_APP_TOKEN`
     - **Signing Secret** → `SLACK_SIGNING_SECRET`

## Running

Development (auto-reload):
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

Use Pulse in Slack by mentioning it (`@Pulse what changed in the EU AI Act this week?`),
DMing it, or running `/pulse <question>`.

## MCP server

Run Pulse as an MCP server over stdio:
```bash
npm run mcp
```

Example client configuration (e.g. for Claude Desktop / Claude Code):
```json
{
  "mcpServers": {
    "pulse": { "command": "npm", "args": ["run", "mcp"], "cwd": "/path/to/pulse-slack-agent" }
  }
}
```
Tools exposed: `ask` (question → cited answer), `search` (query → factual summary),
`daily_briefing` (optional topics → digest).

## Configuration

| Var | Required | Default | Purpose |
|---|---|---|---|
| `SLACK_BOT_TOKEN` | yes | — | `xoxb-…` bot token |
| `SLACK_APP_TOKEN` | yes | — | `xapp-…` Socket Mode token |
| `SLACK_SIGNING_SECRET` | yes | — | request signing |
| `GEMINI_API_KEY` | yes | — | Google Gen AI key |
| `GEMINI_MODEL` | no | `gemini-2.0-flash` | model id |
| `BRIEFING_CHANNEL` | no | — | channel id for the daily briefing (disabled if unset) |
| `BRIEFING_CRON` | no | `0 9 * * *` | cron schedule (server local time) |
| `BRIEFING_TOPICS` | no | `top world news,technology,AI` | comma-separated topics |
| `MCP_SERVERS` | no | — | JSON array of external MCP servers to consume |
| `LOG_LEVEL` | no | `info` | pino log level |
| `HEALTH_PORT` | no | `3000` | health endpoint port |

## Testing & quality

```bash
npm test         # vitest unit tests
npm run typecheck
npm run lint
npm run format
```

## Docker

```bash
docker build -t pulse-slack-agent .
docker run --rm --env-file .env -p 3000:3000 pulse-slack-agent
```

The image runs as a non-root user and exposes `/healthz` (with a `HEALTHCHECK`).

## Deployment

Deploy as a long-running container (VM, Cloud Run with min-instances 1, Fly.io, Railway,
or a Kubernetes Deployment). Socket Mode needs no public ingress. Point your platform's
health probe at `GET /healthz`. The daily briefing runs in-process; ensure at least one
instance is always running for it to fire.

## License

MIT © Yash Kavaiya
