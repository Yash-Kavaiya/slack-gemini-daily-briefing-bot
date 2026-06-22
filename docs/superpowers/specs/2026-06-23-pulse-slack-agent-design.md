# Pulse — Slack Agent (Gemini + MCP + Real-Time Search) — Design

**Date:** 2026-06-23
**Status:** Approved (design); pending spec review
**Author:** Yash Kavaiya

## 1. Summary

Pulse is a production-grade Slack agent powered by Google Gemini with native Google
Search grounding. It answers questions on demand in Slack, posts a scheduled daily
briefing, integrates with the Model Context Protocol (MCP) as both a client and a
server, and maintains conversation context within Slack threads.

The current repository is an empty skeleton (four 0-byte TypeScript files, a minimal
`package.json`, no build/test/CI tooling). This design specifies a full rebuild to an
enterprise-grade standard.

## 2. Goals

- **On-demand Q&A + real-time web search:** A user mentions the bot, DMs it, or runs a
  slash command; Gemini answers grounded with live Google Search results and cites sources.
- **Scheduled daily briefing:** A cron job posts a daily digest to a configured channel.
- **MCP integration (both directions):**
  - *Client:* the agent connects to configured external MCP servers and exposes their
    tools to Gemini via function calling.
  - *Server:* Pulse exposes its own MCP server (stdio) so other agents (e.g. Claude) can
    call `ask` / `search` / `daily_briefing`.
- **Conversation memory:** follow-up questions in a Slack thread retain context.
- **Enterprise quality:** strict TypeScript, structured logging, validated config,
  resilient error handling, tests, lint/format, Docker, and CI.

## 3. Non-Goals (YAGNI)

- No persistent database. Conversation memory is reconstructed by reading the Slack
  thread on each reply (Slack is the source of truth). Cross-thread/long-term memory
  (e.g. Redis) is a deliberate future extension, not built now.
- No multi-LLM abstraction. Gemini only.
- No microservices / queue infrastructure. Single shared core, two entrypoints.
- No serverless deployment. Long-running container.

## 4. Architecture

**Approach: single shared core + two entrypoints.**

A shared `core` (Gemini agent, MCP client, config, logging) is consumed by two runnable
entrypoints:

1. **Slack app** (`src/index.ts`) — Bolt in Socket Mode + in-process `node-cron`
   scheduler for the daily briefing. This is the deployed container.
2. **MCP server** (`src/mcp/server.ts`) — stdio MCP server exposing Pulse's tools,
   runnable via `npm run mcp`, reusing the same core.

```
src/
  index.ts              # Slack-app entrypoint: wire config, logger, app, scheduler, MCP client; graceful shutdown
  config.ts             # zod-validated env (Slack tokens, Gemini key/model, briefing channel + cron)
  logger.ts             # pino factory with secret redaction
  agent/
    gemini.ts           # GeminiAgent.ask(history, tools) -> { text, citations }; Google Search grounding + tool loop
    types.ts            # AgentResponse, Citation, ChatMessage
  mcp/
    client.ts           # connect external MCP servers -> expose tools to Gemini; route tool calls
    server.ts           # Pulse MCP server (stdio): tools = ask / search / daily_briefing
  slack/
    app.ts              # Bolt Socket Mode factory
    format.ts           # Block Kit: answers, citations, briefing
    thread.ts           # read Slack thread -> ChatMessage[] (memory)
    handlers/
      mention.ts        # app_mention -> agent -> threaded reply
      command.ts        # /pulse slash command
      message.ts        # DM / thread follow-ups
  briefing/
    scheduler.ts        # node-cron -> build + post daily briefing
    briefing.ts         # buildBriefing() via agent
  health.ts             # GET /healthz for container probes
```

Each unit has one purpose and a narrow interface: handlers translate Slack events to/from
the agent; `agent/gemini.ts` is the only module that talks to Gemini; `mcp/client.ts` is
the only module that manages external MCP connections; `slack/format.ts` owns all Block
Kit rendering. Modules are testable in isolation by mocking their single dependency.

## 5. Tech Stack

| Concern | Choice |
|---|---|
| Language / runtime | TypeScript (strict, ESM, `NodeNext`), Node 22 |
| Slack | `@slack/bolt` v4, Socket Mode |
| LLM | `@google/genai` (Gemini 2.x), native Google Search grounding + function calling |
| MCP | `@modelcontextprotocol/sdk` (client + stdio server) |
| Scheduling | `node-cron` |
| Config validation | `zod` |
| Logging | `pino` (+ `pino-pretty` for dev), secret redaction |
| Tests | `vitest` |
| Lint / format | ESLint (flat config) + Prettier |
| Container | multi-stage `Dockerfile`, non-root user, `.dockerignore` |
| CI | GitHub Actions: typecheck -> lint -> test -> build -> docker build |

## 6. Data Flow

**On-demand Q&A:** Slack event -> handler -> `thread.ts` builds history ->
`GeminiAgent.ask(history, tools=[googleSearch, ...mcpTools])` -> Gemini may emit tool
calls, which are executed via `mcp/client.ts` and fed back in a loop -> final
`{ text, citations }` -> `format.ts` -> threaded Slack reply with sources.

**Daily briefing:** `node-cron` fires -> `buildBriefing()` asks the agent for a digest of
configured topics (grounded with search) -> `format.ts` -> posted to the configured channel.

**MCP server:** external client connects via stdio -> calls `ask` / `search` /
`daily_briefing` -> reuses the same core -> returns structured result.

## 7. Configuration (env, zod-validated)

| Var | Required | Default | Purpose |
|---|---|---|---|
| `SLACK_BOT_TOKEN` | yes | — | `xoxb-…` bot token |
| `SLACK_APP_TOKEN` | yes | — | `xapp-…` Socket Mode token |
| `SLACK_SIGNING_SECRET` | yes | — | request signing |
| `GEMINI_API_KEY` | yes | — | Google Gen AI key |
| `GEMINI_MODEL` | no | `gemini-2.0-flash` | model id |
| `BRIEFING_CHANNEL` | no | — | channel id for daily briefing (briefing disabled if unset) |
| `BRIEFING_CRON` | no | `0 9 * * *` | cron schedule (server local time) |
| `BRIEFING_TOPICS` | no | sensible default list | comma-separated topics |
| `MCP_SERVERS` | no | — | JSON describing external MCP servers to connect as a client |
| `LOG_LEVEL` | no | `info` | pino level |
| `HEALTH_PORT` | no | `3000` | health endpoint port |

Invalid/missing required config fails fast at startup with a clear message.

## 8. Error Handling & Resilience

- **Config:** validated with zod at boot; fail fast.
- **Gemini calls:** timeout + exponential-backoff retry on transient errors; a friendly
  Slack fallback message ("⚠️ I hit an error, please try again") on final failure.
- **MCP client:** graceful degradation — if an external server is unreachable, log and
  continue without its tools rather than crashing.
- **Process:** global `unhandledRejection` / `uncaughtException` logging; graceful
  `SIGTERM` / `SIGINT` shutdown (close Slack socket, stop cron, close MCP, close health server).
- **Slack:** rely on Bolt's built-in rate-limit handling; acknowledge events promptly.

## 9. Security

- Secrets only via environment; documented in `.env.example`; never committed.
- pino redaction for token-like fields.
- Non-root user in the Docker image.
- Least-privilege Slack scopes documented in the README and `slack-app-manifest.yaml`:
  `app_mentions:read`, `chat:write`, `commands`, `im:history`, `im:read`, `im:write`,
  `channels:history`, `groups:history`, plus Socket Mode + relevant event subscriptions.

## 10. Testing Strategy

Vitest unit tests (external dependencies mocked):

- `config.ts` — valid/invalid env, defaults applied.
- `slack/thread.ts` — Slack thread payload -> ordered `ChatMessage[]`, bot/user roles.
- `slack/format.ts` — answer + citations and briefing render to expected Block Kit.
- `briefing/briefing.ts` — `buildBriefing()` with a mocked agent.
- `mcp/client.ts` — external tool list -> Gemini function declarations; tool-call routing.
- `agent/gemini.ts` — response/grounding parsing into `{ text, citations }` with a mocked
  `@google/genai` client.

CI runs: `typecheck` -> `lint` -> `test` -> `build` -> `docker build`.

## 11. Deliverables

- Full `src/` implementation per the layout above.
- `tsconfig.json`, ESLint + Prettier config.
- `package.json` rewritten: correct metadata (author "Yash Kavaiya", MIT license,
  description), `@google/genai` / `node-cron` / `zod` / `pino` deps, scripts
  (`dev`, `build`, `start`, `mcp`, `typecheck`, `lint`, `format`, `test`, `test:watch`).
- `.env.example`, `README.md`, `slack-app-manifest.yaml`.
- `Dockerfile`, `.dockerignore`.
- `.github/workflows/ci.yml`.
- `LICENSE` (MIT).
- Unit tests under `test/` (or co-located `*.test.ts`).

## 12. Delivery / Git

- Work on a feature branch (e.g. `feat/enterprise-rebuild`), commit in logical units.
- Open a Pull Request against `master` on the existing `origin`
  (`github.com/Yash-Kavaiya/slack-gemini-daily-briefing-bot`) rather than pushing to
  `master` directly.

## 13. Open Risks / Assumptions

- Exact `@google/genai` grounding-metadata shape will be confirmed against current docs
  during implementation (the citation parser is isolated in `agent/gemini.ts` to absorb this).
- Tests mock all network calls; no live Slack/Gemini credentials are required to run the
  suite or CI.
- The daily briefing is disabled gracefully when `BRIEFING_CHANNEL` is unset.
