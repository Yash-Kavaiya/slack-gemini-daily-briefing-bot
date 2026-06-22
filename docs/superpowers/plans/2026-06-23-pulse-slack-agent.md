# Pulse — Slack Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Pulse — a production-grade Slack agent powered by Google Gemini (with native Google Search grounding), MCP client+server integration, a scheduled daily briefing, and thread-based conversation memory.

**Architecture:** A single shared TypeScript core (config, logger, Gemini agent, MCP client) consumed by two entrypoints — a Slack app (Bolt Socket Mode + in-process cron) and a stdio MCP server. No database; conversation memory is reconstructed from Slack threads.

**Tech Stack:** TypeScript (strict, ESM, NodeNext), Node 22, `@slack/bolt` v4, `@google/genai`, `@modelcontextprotocol/sdk`, `node-cron`, `zod`, `pino`, `vitest`, ESLint + Prettier, Docker, GitHub Actions.

## Global Constraints

- Node: `>=20` (developed on Node 22). Module system: **ESM** (`"type": "module"`), `moduleResolution: NodeNext`. Import paths between local modules use the `.js` extension.
- TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- License: **MIT**. Author: **Yash Kavaiya**.
- All secrets via environment only; never hardcoded, never logged (pino redaction).
- Every network dependency (Slack, Gemini, MCP) is mocked in tests; the suite needs no live credentials.
- Test runner: `vitest`. Tests co-located as `*.test.ts` next to the module under test.
- Commit style: Conventional Commits; every commit ends with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Project tooling foundation

**Files:**

- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `eslint.config.js`
- Create: `.prettierrc.json`
- Create: `vitest.config.ts`
- Create: `LICENSE`
- Modify: `.gitignore`
- Create: `src/sanity.test.ts` (temporary, deleted in Step 6)

**Interfaces:**

- Produces: working `npm run typecheck | lint | test | build` on an otherwise empty project; ESM + strict TS baseline every later task depends on.

- [ ] **Step 1: Rewrite `package.json`**

```json
{
  "name": "pulse-slack-agent",
  "version": "1.0.0",
  "description": "Pulse — a Slack agent powered by Google Gemini with real-time Google Search grounding, MCP integration, and scheduled daily briefings.",
  "type": "module",
  "engines": { "node": ">=20" },
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "mcp": "tsx src/mcp/server.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["slack", "gemini", "mcp", "ai-agent", "bot"],
  "author": "Yash Kavaiya",
  "license": "MIT",
  "dependencies": {
    "@google/genai": "^0.3.0",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "@slack/bolt": "^4.7.3",
    "dotenv": "^17.4.2",
    "node-cron": "^3.0.3",
    "pino": "^9.5.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/node-cron": "^3.0.11",
    "@typescript-eslint/eslint-plugin": "^8.18.0",
    "@typescript-eslint/parser": "^8.18.0",
    "eslint": "^9.17.0",
    "pino-pretty": "^13.0.0",
    "prettier": "^3.4.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

Then install: `npm install`. Pin `@google/genai` to the latest published version `npm` resolves if `^0.3.0` is unavailable (the API surface used — `new GoogleGenAI({apiKey})`, `ai.models.generateContent`, `response.text`, `response.functionCalls`, `candidate.groundingMetadata`) is stable across recent versions).

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": false,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create `eslint.config.js`, `.prettierrc.json`, `vitest.config.ts`**

`eslint.config.js`:

```js
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: false, ecmaVersion: 2022, sourceType: 'module' },
      globals: { process: 'readonly', console: 'readonly' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
```

Add `@eslint/js` to devDependencies during install if ESLint flat config requires it.

`.prettierrc.json`:

```json
{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all" }
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'], globals: false },
});
```

- [ ] **Step 4: Create `LICENSE` (MIT) and update `.gitignore`**

`LICENSE`: standard MIT text, `Copyright (c) 2026 Yash Kavaiya`.

Append to `.gitignore`:

```
coverage/
*.tsbuildinfo
```

- [ ] **Step 5: Add a sanity test to prove the toolchain runs**

`src/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
describe('toolchain', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Verify toolchain, then remove sanity test**

Run: `npm run typecheck && npm run lint && npm test`
Expected: typecheck clean, lint clean, 1 test passes.
Then delete `src/sanity.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: set up TypeScript/ESM toolchain, lint, format, vitest, MIT license"
```

---

### Task 2: Config module (`src/config.ts`)

**Files:**

- Create: `src/config.ts`
- Create: `src/config.test.ts`

**Interfaces:**

- Produces: `export interface Config { slack: {botToken,appToken,signingSecret}; gemini: {apiKey,model}; briefing: {channel?: string; cron: string; topics: string[]}; mcpServers: McpServerConfig[]; logLevel: string; healthPort: number }`
- Produces: `export function loadConfig(env: NodeJS.ProcessEnv): Config` (throws `ConfigError` on invalid input)
- Produces: `export interface McpServerConfig { name: string; command: string; args: string[] }`

- [ ] **Step 1: Write the failing test** — `src/config.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { loadConfig } from './config.js';

const base = {
  SLACK_BOT_TOKEN: 'xoxb-1',
  SLACK_APP_TOKEN: 'xapp-1',
  SLACK_SIGNING_SECRET: 'secret',
  GEMINI_API_KEY: 'key',
};

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig(base);
    expect(c.gemini.model).toBe('gemini-2.0-flash');
    expect(c.briefing.cron).toBe('0 9 * * *');
    expect(c.healthPort).toBe(3000);
    expect(c.briefing.channel).toBeUndefined();
  });

  it('parses topics and mcp servers', () => {
    const c = loadConfig({
      ...base,
      BRIEFING_TOPICS: 'ai, markets ,sports',
      MCP_SERVERS: JSON.stringify([{ name: 'fs', command: 'npx', args: ['-y', 'srv'] }]),
    });
    expect(c.briefing.topics).toEqual(['ai', 'markets', 'sports']);
    expect(c.mcpServers[0]?.name).toBe('fs');
  });

  it('throws when a required var is missing', () => {
    expect(() => loadConfig({ ...base, GEMINI_API_KEY: '' })).toThrow(/GEMINI_API_KEY/);
  });

  it('throws on invalid MCP_SERVERS json', () => {
    expect(() => loadConfig({ ...base, MCP_SERVERS: 'not json' })).toThrow(/MCP_SERVERS/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run src/config.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `src/config.ts`**

```ts
import { z } from 'zod';

export class ConfigError extends Error {}

const mcpServerSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
});
export type McpServerConfig = z.infer<typeof mcpServerSchema>;

const schema = z.object({
  SLACK_BOT_TOKEN: z.string().min(1),
  SLACK_APP_TOKEN: z.string().min(1),
  SLACK_SIGNING_SECRET: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  BRIEFING_CHANNEL: z.string().optional(),
  BRIEFING_CRON: z.string().default('0 9 * * *'),
  BRIEFING_TOPICS: z.string().default('top world news,technology,AI'),
  MCP_SERVERS: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
  HEALTH_PORT: z.coerce.number().int().positive().default(3000),
});

export interface Config {
  slack: { botToken: string; appToken: string; signingSecret: string };
  gemini: { apiKey: string; model: string };
  briefing: { channel?: string; cron: string; topics: string[] };
  mcpServers: McpServerConfig[];
  logLevel: string;
  healthPort: number;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigError(`Invalid configuration: ${msg}`);
  }
  const e = parsed.data;

  let mcpServers: McpServerConfig[] = [];
  if (e.MCP_SERVERS) {
    try {
      mcpServers = z.array(mcpServerSchema).parse(JSON.parse(e.MCP_SERVERS));
    } catch (err) {
      throw new ConfigError(`Invalid MCP_SERVERS: ${(err as Error).message}`);
    }
  }

  return {
    slack: {
      botToken: e.SLACK_BOT_TOKEN,
      appToken: e.SLACK_APP_TOKEN,
      signingSecret: e.SLACK_SIGNING_SECRET,
    },
    gemini: { apiKey: e.GEMINI_API_KEY, model: e.GEMINI_MODEL },
    briefing: {
      channel: e.BRIEFING_CHANNEL,
      cron: e.BRIEFING_CRON,
      topics: e.BRIEFING_TOPICS.split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    },
    mcpServers,
    logLevel: e.LOG_LEVEL,
    healthPort: e.HEALTH_PORT,
  };
}
```

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run src/config.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add src/config.ts src/config.test.ts && git commit -m "feat: add zod-validated config loader"`

---

### Task 3: Logger (`src/logger.ts`)

**Files:**

- Create: `src/logger.ts`
- Create: `src/logger.test.ts`

**Interfaces:**

- Produces: `export function createLogger(level: string): Logger` (pino `Logger` type re-exported as `export type { Logger } from 'pino'`)

- [ ] **Step 1: Write the failing test** — `src/logger.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  it('creates a logger at the requested level and redacts tokens', () => {
    const log = createLogger('debug');
    expect(log.level).toBe('debug');
    expect(typeof log.info).toBe('function');
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — `npx vitest run src/logger.test.ts`.

- [ ] **Step 3: Implement `src/logger.ts`**

```ts
import pino from 'pino';
export type { Logger } from 'pino';

export function createLogger(level: string): pino.Logger {
  return pino({
    level,
    redact: {
      paths: [
        '*.token',
        '*.botToken',
        '*.appToken',
        '*.apiKey',
        '*.signingSecret',
        'headers.authorization',
      ],
      censor: '[REDACTED]',
    },
  });
}
```

- [ ] **Step 4: Run to verify PASS.**

- [ ] **Step 5: Commit** — `git commit -am "feat: add pino logger with secret redaction"`

---

### Task 4: Agent types (`src/agent/types.ts`)

**Files:**

- Create: `src/agent/types.ts`

**Interfaces:**

- Produces:

```ts
export interface Citation {
  title: string;
  uri: string;
}
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
export interface AgentResponse {
  text: string;
  citations: Citation[];
}
export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  call(args: Record<string, unknown>): Promise<string>;
}
```

- [ ] **Step 1: Create `src/agent/types.ts`** with exactly the interfaces above (no logic, no test needed — types only).

- [ ] **Step 2: Verify it typechecks** — `npm run typecheck` → clean.

- [ ] **Step 3: Commit** — `git add src/agent/types.ts && git commit -m "feat: add shared agent types"`

---

### Task 5: Gemini agent (`src/agent/gemini.ts`)

**Files:**

- Create: `src/agent/gemini.ts`
- Create: `src/agent/gemini.test.ts`

**Interfaces:**

- Consumes: `Config['gemini']`, `Logger`, `ChatMessage`, `AgentTool`, `AgentResponse`, `Citation`.
- Produces: `export class GeminiAgent { constructor(cfg, logger, deps?); ask(history: ChatMessage[], tools?: AgentTool[]): Promise<AgentResponse> }`
- Produces: `export interface GeminiDeps { client: GeminiClient }` and `export interface GeminiClient { generateContent(req): Promise<GeminiResult> }` so tests inject a fake client instead of hitting the network.

**Note for implementer:** `@google/genai` real client is wrapped behind `GeminiClient` so it is mockable. The wrapper around the real SDK lives in this file (`createRealClient(apiKey)`); tests pass a fake. The agent runs a bounded tool-call loop (max 5 iterations): send contents → if the result has function calls, execute matching `AgentTool`s, append `functionResponse` parts, loop; else return text + citations. Google Search grounding is always enabled via the `googleSearch` tool; citations come from `candidate.groundingMetadata.groundingChunks[].web`.

- [ ] **Step 1: Write the failing test** — `src/agent/gemini.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { GeminiAgent } from './gemini.js';
import type { GeminiClient } from './gemini.js';
import { createLogger } from '../logger.js';

const cfg = { apiKey: 'k', model: 'gemini-2.0-flash' };
const log = createLogger('silent');

function clientReturning(results: any[]): GeminiClient {
  const calls = [...results];
  return { generateContent: vi.fn(async () => calls.shift()) };
}

describe('GeminiAgent.ask', () => {
  it('returns text and parsed citations from grounding metadata', async () => {
    const client = clientReturning([
      {
        text: 'Paris is the capital of France.',
        functionCalls: [],
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [{ web: { title: 'France', uri: 'https://x' } }],
            },
          },
        ],
      },
    ]);
    const agent = new GeminiAgent(cfg, log, { client });
    const res = await agent.ask([{ role: 'user', text: 'capital of France?' }]);
    expect(res.text).toContain('Paris');
    expect(res.citations).toEqual([{ title: 'France', uri: 'https://x' }]);
  });

  it('executes a tool call then returns the final answer', async () => {
    const client = clientReturning([
      { text: '', functionCalls: [{ name: 'weather', args: { city: 'NYC' } }], candidates: [] },
      { text: 'It is 20C in NYC.', functionCalls: [], candidates: [] },
    ]);
    const tool = {
      name: 'weather',
      description: 'get weather',
      parameters: { type: 'object', properties: { city: { type: 'string' } } },
      call: vi.fn(async () => '20C'),
    };
    const agent = new GeminiAgent(cfg, log, { client });
    const res = await agent.ask([{ role: 'user', text: 'weather in NYC?' }], [tool]);
    expect(tool.call).toHaveBeenCalledWith({ city: 'NYC' });
    expect(res.text).toContain('20C');
  });

  it('stops after max iterations to avoid infinite tool loops', async () => {
    const looping = { text: '', functionCalls: [{ name: 'x', args: {} }], candidates: [] };
    const client = clientReturning(Array(10).fill(looping));
    const tool = {
      name: 'x',
      description: 'x',
      parameters: { type: 'object' },
      call: vi.fn(async () => 'ok'),
    };
    const agent = new GeminiAgent(cfg, log, { client });
    const res = await agent.ask([{ role: 'user', text: 'loop' }], [tool]);
    expect(res.text).toMatch(/couldn.t complete|unable/i);
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — `npx vitest run src/agent/gemini.test.ts`.

- [ ] **Step 3: Implement `src/agent/gemini.ts`**

```ts
import { GoogleGenAI } from '@google/genai';
import type { Logger } from '../logger.js';
import type { AgentResponse, AgentTool, ChatMessage, Citation } from './types.js';

const MAX_TOOL_ITERATIONS = 5;

export interface GeminiResult {
  text: string;
  functionCalls: { name: string; args: Record<string, unknown> }[];
  candidates: {
    groundingMetadata?: { groundingChunks?: { web?: { title?: string; uri?: string } }[] };
  }[];
}

export interface GeminiClient {
  generateContent(req: {
    model: string;
    contents: unknown[];
    config: Record<string, unknown>;
  }): Promise<GeminiResult>;
}

export function createRealClient(apiKey: string): GeminiClient {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async generateContent(req) {
      const r = await ai.models.generateContent(req as never);
      return {
        text: r.text ?? '',
        functionCalls: (r.functionCalls ?? []).map((f) => ({
          name: f.name ?? '',
          args: (f.args ?? {}) as Record<string, unknown>,
        })),
        candidates: (r.candidates ?? []) as GeminiResult['candidates'],
      };
    },
  };
}

export interface GeminiDeps {
  client: GeminiClient;
}

export class GeminiAgent {
  private readonly client: GeminiClient;
  constructor(
    private readonly cfg: { apiKey: string; model: string },
    private readonly logger: Logger,
    deps?: GeminiDeps,
  ) {
    this.client = deps?.client ?? createRealClient(cfg.apiKey);
  }

  async ask(history: ChatMessage[], tools: AgentTool[] = []): Promise<AgentResponse> {
    const contents: unknown[] = history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
    const toolMap = new Map(tools.map((t) => [t.name, t]));

    const toolConfig: Record<string, unknown>[] = [{ googleSearch: {} }];
    if (tools.length > 0) {
      toolConfig.push({
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      });
    }

    const citations: Citation[] = [];
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const result = await this.client.generateContent({
        model: this.cfg.model,
        contents,
        config: { tools: toolConfig },
      });
      this.collectCitations(result, citations);

      if (result.functionCalls.length > 0 && toolMap.size > 0) {
        contents.push({
          role: 'model',
          parts: result.functionCalls.map((fc) => ({ functionCall: fc })),
        });
        for (const fc of result.functionCalls) {
          const tool = toolMap.get(fc.name);
          const output = tool ? await this.safeCall(tool, fc.args) : `Unknown tool: ${fc.name}`;
          contents.push({
            role: 'user',
            parts: [{ functionResponse: { name: fc.name, response: { result: output } } }],
          });
        }
        continue;
      }
      return {
        text: result.text || 'I could not produce an answer.',
        citations: dedupe(citations),
      };
    }
    return {
      text: "I couldn't complete this request — too many tool steps. Please rephrase.",
      citations: dedupe(citations),
    };
  }

  private async safeCall(tool: AgentTool, args: Record<string, unknown>): Promise<string> {
    try {
      return await tool.call(args);
    } catch (err) {
      this.logger.warn({ tool: tool.name, err: (err as Error).message }, 'tool call failed');
      return `Tool ${tool.name} failed: ${(err as Error).message}`;
    }
  }

  private collectCitations(result: GeminiResult, into: Citation[]): void {
    for (const c of result.candidates) {
      for (const chunk of c.groundingMetadata?.groundingChunks ?? []) {
        if (chunk.web?.uri)
          into.push({ title: chunk.web.title ?? chunk.web.uri, uri: chunk.web.uri });
      }
    }
  }
}

function dedupe(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((c) => (seen.has(c.uri) ? false : (seen.add(c.uri), true)));
}
```

- [ ] **Step 4: Run to verify PASS.** Adjust the `createRealClient` cast only if the installed `@google/genai` types differ; the `GeminiClient` interface and loop logic are what the tests exercise.

- [ ] **Step 5: Commit** — `git add src/agent && git commit -m "feat: add Gemini agent with search grounding and tool loop"`

---

### Task 6: MCP client (`src/mcp/client.ts`)

**Files:**

- Create: `src/mcp/client.ts`
- Create: `src/mcp/client.test.ts`

**Interfaces:**

- Consumes: `McpServerConfig`, `Logger`, `AgentTool`.
- Produces: `export class McpClientManager { constructor(servers: McpServerConfig[], logger: Logger, deps?: McpClientDeps); connectAll(): Promise<void>; tools(): AgentTool[]; close(): Promise<void> }`
- Produces: `export interface McpConnection { listTools(): Promise<{name:string;description?:string;inputSchema:Record<string,unknown>}[]>; callTool(name:string,args:Record<string,unknown>): Promise<string>; close(): Promise<void> }` and `export interface McpClientDeps { connect(cfg: McpServerConfig): Promise<McpConnection> }`

**Note for implementer:** The real `connect` (using `@modelcontextprotocol/sdk` `Client` + `StdioClientTransport`) lives in this file as `createRealConnect()`; tests inject a fake `connect`. A server that fails to connect is logged and skipped (graceful degradation) — never throws out of `connectAll`. Each external tool becomes an `AgentTool` whose `call` delegates to `connection.callTool`.

- [ ] **Step 1: Write the failing test** — `src/mcp/client.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { McpClientManager } from './client.js';
import type { McpConnection } from './client.js';
import { createLogger } from '../logger.js';

const log = createLogger('silent');

function fakeConn(tools: any[]): McpConnection {
  return {
    listTools: vi.fn(async () => tools),
    callTool: vi.fn(async (_n, _a) => 'tool-result'),
    close: vi.fn(async () => {}),
  };
}

describe('McpClientManager', () => {
  it('exposes external tools as AgentTools', async () => {
    const conn = fakeConn([{ name: 'echo', description: 'echo', inputSchema: { type: 'object' } }]);
    const mgr = new McpClientManager([{ name: 's', command: 'x', args: [] }], log, {
      connect: async () => conn,
    });
    await mgr.connectAll();
    const tools = mgr.tools();
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('echo');
    expect(await tools[0]?.call({ a: 1 })).toBe('tool-result');
  });

  it('skips servers that fail to connect', async () => {
    const mgr = new McpClientManager([{ name: 'bad', command: 'x', args: [] }], log, {
      connect: async () => {
        throw new Error('boom');
      },
    });
    await mgr.connectAll();
    expect(mgr.tools()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Implement `src/mcp/client.ts`**

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpServerConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { AgentTool } from '../agent/types.js';

export interface McpConnection {
  listTools(): Promise<
    { name: string; description?: string; inputSchema: Record<string, unknown> }[]
  >;
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

export interface McpClientDeps {
  connect(cfg: McpServerConfig): Promise<McpConnection>;
}

export function createRealConnect(): McpClientDeps['connect'] {
  return async (cfg) => {
    const client = new Client({ name: 'pulse', version: '1.0.0' });
    const transport = new StdioClientTransport({ command: cfg.command, args: cfg.args });
    await client.connect(transport);
    return {
      async listTools() {
        const r = await client.listTools();
        return r.tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: (t.inputSchema ?? { type: 'object' }) as Record<string, unknown>,
        }));
      },
      async callTool(name, args) {
        const r = await client.callTool({ name, arguments: args });
        const content = (r.content ?? []) as { type: string; text?: string }[];
        return (
          content
            .filter((c) => c.type === 'text')
            .map((c) => c.text ?? '')
            .join('\n') || JSON.stringify(r)
        );
      },
      async close() {
        await client.close();
      },
    };
  };
}

export class McpClientManager {
  private readonly connections: McpConnection[] = [];
  private readonly agentTools: AgentTool[] = [];
  private readonly connect: McpClientDeps['connect'];

  constructor(
    private readonly servers: McpServerConfig[],
    private readonly logger: Logger,
    deps?: McpClientDeps,
  ) {
    this.connect = deps?.connect ?? createRealConnect();
  }

  async connectAll(): Promise<void> {
    for (const srv of this.servers) {
      try {
        const conn = await this.connect(srv);
        this.connections.push(conn);
        const tools = await conn.listTools();
        for (const t of tools) {
          this.agentTools.push({
            name: t.name,
            description: t.description ?? t.name,
            parameters: t.inputSchema,
            call: (args) => conn.callTool(t.name, args),
          });
        }
        this.logger.info({ server: srv.name, tools: tools.length }, 'connected to MCP server');
      } catch (err) {
        this.logger.warn(
          { server: srv.name, err: (err as Error).message },
          'MCP server unavailable — skipping',
        );
      }
    }
  }

  tools(): AgentTool[] {
    return this.agentTools;
  }

  async close(): Promise<void> {
    await Promise.allSettled(this.connections.map((c) => c.close()));
  }
}
```

- [ ] **Step 4: Run to verify PASS.**

- [ ] **Step 5: Commit** — `git add src/mcp/client.ts src/mcp/client.test.ts && git commit -m "feat: add MCP client manager with graceful degradation"`

---

### Task 7: Slack thread memory (`src/slack/thread.ts`)

**Files:**

- Create: `src/slack/thread.ts`
- Create: `src/slack/thread.test.ts`

**Interfaces:**

- Consumes: `ChatMessage`.
- Produces: `export function messagesToHistory(messages: SlackMsg[], botUserId: string): ChatMessage[]` where `export interface SlackMsg { user?: string; bot_id?: string; text?: string; ts?: string }`. Bot's own messages map to role `model`; everyone else to `user`. Empty-text messages are dropped. `@mention` of the bot is stripped from text.

- [ ] **Step 1: Write the failing test** — `src/slack/thread.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { messagesToHistory } from './thread.js';

describe('messagesToHistory', () => {
  it('maps bot messages to model and others to user, stripping mentions', () => {
    const history = messagesToHistory(
      [
        { user: 'U1', text: '<@UBOT> hi there' },
        { bot_id: 'B1', user: 'UBOT', text: 'hello!' },
        { user: 'U1', text: 'follow up' },
        { user: 'U1', text: '' },
      ],
      'UBOT',
    );
    expect(history).toEqual([
      { role: 'user', text: 'hi there' },
      { role: 'model', text: 'hello!' },
      { role: 'user', text: 'follow up' },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Implement `src/slack/thread.ts`**

```ts
import type { ChatMessage } from '../agent/types.js';

export interface SlackMsg {
  user?: string;
  bot_id?: string;
  text?: string;
  ts?: string;
}

export function messagesToHistory(messages: SlackMsg[], botUserId: string): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    const text = stripMention(m.text ?? '', botUserId).trim();
    if (!text) continue;
    const isBot = Boolean(m.bot_id) || m.user === botUserId;
    out.push({ role: isBot ? 'model' : 'user', text });
  }
  return out;
}

function stripMention(text: string, botUserId: string): string {
  return text.replace(new RegExp(`<@${botUserId}>`, 'g'), '').replace(/\s+/g, ' ');
}
```

- [ ] **Step 4: Run to verify PASS.**

- [ ] **Step 5: Commit** — `git add src/slack/thread.ts src/slack/thread.test.ts && git commit -m "feat: map Slack thread messages to agent history"`

---

### Task 8: Slack Block Kit formatting (`src/slack/format.ts`)

**Files:**

- Create: `src/slack/format.ts`
- Create: `src/slack/format.test.ts`

**Interfaces:**

- Consumes: `AgentResponse`, `Citation`.
- Produces: `export function formatAnswer(res: AgentResponse): { text: string; blocks: unknown[] }` and `export function formatBriefing(topics: string[], res: AgentResponse): { text: string; blocks: unknown[] }`. Citations render as a numbered "Sources" context block; answers truncate to Slack's section limit (~2900 chars) safely.

- [ ] **Step 1: Write the failing test** — `src/slack/format.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { formatAnswer, formatBriefing } from './format.js';

describe('formatAnswer', () => {
  it('includes the answer and a sources block', () => {
    const out = formatAnswer({ text: 'Answer.', citations: [{ title: 'A', uri: 'https://a' }] });
    expect(out.text).toContain('Answer.');
    const json = JSON.stringify(out.blocks);
    expect(json).toContain('Answer.');
    expect(json).toContain('https://a');
    expect(json).toContain('Sources');
  });

  it('omits sources block when there are no citations', () => {
    const out = formatAnswer({ text: 'No sources.', citations: [] });
    expect(JSON.stringify(out.blocks)).not.toContain('Sources');
  });
});

describe('formatBriefing', () => {
  it('includes a header and topics', () => {
    const out = formatBriefing(['ai'], { text: 'Briefing body', citations: [] });
    expect(JSON.stringify(out.blocks)).toContain('Daily Briefing');
    expect(out.text).toContain('Briefing body');
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Implement `src/slack/format.ts`**

```ts
import type { AgentResponse, Citation } from '../agent/types.js';

const MAX_SECTION = 2900;

function truncate(s: string): string {
  return s.length <= MAX_SECTION ? s : `${s.slice(0, MAX_SECTION - 1)}…`;
}

function sourcesBlock(citations: Citation[]): unknown[] {
  if (citations.length === 0) return [];
  const lines = citations
    .slice(0, 10)
    .map((c, i) => `${i + 1}. <${c.uri}|${c.title}>`)
    .join('  ');
  return [{ type: 'context', elements: [{ type: 'mrkdwn', text: `*Sources:* ${lines}` }] }];
}

export function formatAnswer(res: AgentResponse): { text: string; blocks: unknown[] } {
  return {
    text: res.text,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: truncate(res.text) } },
      ...sourcesBlock(res.citations),
    ],
  };
}

export function formatBriefing(
  topics: string[],
  res: AgentResponse,
): { text: string; blocks: unknown[] } {
  return {
    text: `Daily Briefing: ${res.text}`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '📈 Daily Briefing' } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Topics: ${topics.join(', ')}` }] },
      { type: 'section', text: { type: 'mrkdwn', text: truncate(res.text) } },
      ...sourcesBlock(res.citations),
    ],
  };
}
```

- [ ] **Step 4: Run to verify PASS.**

- [ ] **Step 5: Commit** — `git add src/slack/format.ts src/slack/format.test.ts && git commit -m "feat: add Block Kit formatting for answers and briefings"`

---

### Task 9: Briefing builder (`src/briefing/briefing.ts`)

**Files:**

- Create: `src/briefing/briefing.ts`
- Create: `src/briefing/briefing.test.ts`

**Interfaces:**

- Consumes: `GeminiAgent` (only its `ask` method — typed as `Pick<GeminiAgent, 'ask'>`), `AgentResponse`.
- Produces: `export async function buildBriefing(agent: Pick<GeminiAgent,'ask'>, topics: string[]): Promise<AgentResponse>`

- [ ] **Step 1: Write the failing test** — `src/briefing/briefing.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { buildBriefing } from './briefing.js';

describe('buildBriefing', () => {
  it('asks the agent with the configured topics', async () => {
    const ask = vi.fn(async () => ({ text: 'digest', citations: [] }));
    const res = await buildBriefing({ ask }, ['ai', 'markets']);
    expect(res.text).toBe('digest');
    const prompt = ask.mock.calls[0][0][0].text as string;
    expect(prompt).toContain('ai');
    expect(prompt).toContain('markets');
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Implement `src/briefing/briefing.ts`**

```ts
import type { GeminiAgent } from '../agent/gemini.js';
import type { AgentResponse } from '../agent/types.js';

export async function buildBriefing(
  agent: Pick<GeminiAgent, 'ask'>,
  topics: string[],
): Promise<AgentResponse> {
  const prompt =
    `Produce a concise daily briefing covering these topics: ${topics.join(', ')}. ` +
    `Use current, real information from search. For each topic give 2-3 bullet points with the most ` +
    `important recent developments. Keep it under 250 words and use Slack mrkdwn (e.g. *bold*).`;
  return agent.ask([{ role: 'user', text: prompt }]);
}
```

- [ ] **Step 4: Run to verify PASS.**

- [ ] **Step 5: Commit** — `git add src/briefing/briefing.ts src/briefing/briefing.test.ts && git commit -m "feat: add daily briefing builder"`

---

### Task 10: Briefing scheduler (`src/briefing/scheduler.ts`)

**Files:**

- Create: `src/briefing/scheduler.ts`
- Create: `src/briefing/scheduler.test.ts`

**Interfaces:**

- Consumes: `GeminiAgent`, `Logger`, `buildBriefing`, `formatBriefing`, a minimal Slack poster `interface Poster { postMessage(args: { channel: string; text: string; blocks: unknown[] }): Promise<unknown> }`, `node-cron`.
- Produces: `export class BriefingScheduler { constructor(opts); start(): void; stop(): void; runOnce(): Promise<void> }` where `opts = { cron: string; channel?: string; topics: string[]; agent: Pick<GeminiAgent,'ask'>; poster: Poster; logger: Logger; scheduleFn?: typeof cron.schedule }`.

**Note for implementer:** `runOnce()` builds the briefing and posts it. `start()` registers the cron job (no-op + warn if `channel` is undefined). `scheduleFn` is injectable so tests don't wait on real time. Test calls `runOnce()` directly.

- [ ] **Step 1: Write the failing test** — `src/briefing/scheduler.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { BriefingScheduler } from './scheduler.js';
import { createLogger } from '../logger.js';

const log = createLogger('silent');

describe('BriefingScheduler', () => {
  it('runOnce builds and posts a briefing to the channel', async () => {
    const postMessage = vi.fn(async () => ({ ok: true }));
    const agent = { ask: vi.fn(async () => ({ text: 'digest', citations: [] })) };
    const sched = new BriefingScheduler({
      cron: '0 9 * * *',
      channel: 'C1',
      topics: ['ai'],
      agent,
      poster: { postMessage },
      logger: log,
    });
    await sched.runOnce();
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][0].channel).toBe('C1');
  });

  it('runOnce does nothing without a channel', async () => {
    const postMessage = vi.fn(async () => ({}));
    const agent = { ask: vi.fn(async () => ({ text: 'd', citations: [] })) };
    const sched = new BriefingScheduler({
      cron: '0 9 * * *',
      topics: ['ai'],
      agent,
      poster: { postMessage },
      logger: log,
    });
    await sched.runOnce();
    expect(postMessage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Implement `src/briefing/scheduler.ts`**

```ts
import cron from 'node-cron';
import type { GeminiAgent } from '../agent/gemini.js';
import type { Logger } from '../logger.js';
import { buildBriefing } from './briefing.js';
import { formatBriefing } from '../slack/format.js';

export interface Poster {
  postMessage(args: { channel: string; text: string; blocks: unknown[] }): Promise<unknown>;
}

export interface SchedulerOptions {
  cron: string;
  channel?: string;
  topics: string[];
  agent: Pick<GeminiAgent, 'ask'>;
  poster: Poster;
  logger: Logger;
  scheduleFn?: typeof cron.schedule;
}

export class BriefingScheduler {
  private task?: cron.ScheduledTask;
  constructor(private readonly opts: SchedulerOptions) {}

  start(): void {
    if (!this.opts.channel) {
      this.opts.logger.warn('BRIEFING_CHANNEL not set — daily briefing disabled');
      return;
    }
    const schedule = this.opts.scheduleFn ?? cron.schedule;
    this.task = schedule(this.opts.cron, () => {
      void this.runOnce();
    });
    this.opts.logger.info(
      { cron: this.opts.cron, channel: this.opts.channel },
      'briefing scheduled',
    );
  }

  stop(): void {
    this.task?.stop();
  }

  async runOnce(): Promise<void> {
    if (!this.opts.channel) return;
    try {
      const res = await buildBriefing(this.opts.agent, this.opts.topics);
      const { text, blocks } = formatBriefing(this.opts.topics, res);
      await this.opts.poster.postMessage({ channel: this.opts.channel, text, blocks });
      this.opts.logger.info('daily briefing posted');
    } catch (err) {
      this.opts.logger.error({ err: (err as Error).message }, 'briefing failed');
    }
  }
}
```

- [ ] **Step 4: Run to verify PASS.**

- [ ] **Step 5: Commit** — `git add src/briefing/scheduler.ts src/briefing/scheduler.test.ts && git commit -m "feat: add cron-based briefing scheduler"`

---

### Task 11: Slack app + handlers (`src/slack/app.ts`, `src/slack/handlers/*`)

**Files:**

- Create: `src/slack/handlers/respond.ts` (shared respond helper)
- Create: `src/slack/handlers/respond.test.ts`
- Create: `src/slack/app.ts`

**Interfaces:**

- Consumes: `GeminiAgent`, `McpClientManager`, `Logger`, `messagesToHistory`, `formatAnswer`, `@slack/bolt`.
- Produces: `export async function respondToThread(deps, ctx): Promise<{text:string;blocks:unknown[]}>` — the testable core that fetches thread history, calls the agent, and returns formatted output. `deps = { agent: Pick<GeminiAgent,'ask'>; tools: () => AgentTool[]; fetchThread: (channel,ts) => Promise<SlackMsg[]>; botUserId: string; logger: Logger }`, `ctx = { channel: string; threadTs?: string; text: string; user?: string }`.
- Produces: `export function createSlackApp(cfg, agent, mcp, logger): App` wiring `app_mention`, `/pulse`, and DM `message` events to `respondToThread` (App from `@slack/bolt`, Socket Mode).

**Note for implementer:** Keep all Gemini/formatting logic in `respondToThread` so it is unit-tested without Bolt. `app.ts` is thin glue: acknowledge fast, call `respondToThread`, post the reply in-thread, and on error reply with a friendly message. Bolt wiring itself is not unit-tested (integration concern).

- [ ] **Step 1: Write the failing test** — `src/slack/handlers/respond.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { respondToThread } from './respond.js';
import { createLogger } from '../../logger.js';

const log = createLogger('silent');

describe('respondToThread', () => {
  it('builds history from the thread and returns a formatted answer', async () => {
    const agent = { ask: vi.fn(async () => ({ text: 'The answer.', citations: [] })) };
    const fetchThread = vi.fn(async () => [{ user: 'U1', text: '<@UBOT> question?' }]);
    const out = await respondToThread(
      { agent, tools: () => [], fetchThread, botUserId: 'UBOT', logger: log },
      { channel: 'C1', threadTs: '1.1', text: '<@UBOT> question?', user: 'U1' },
    );
    expect(agent.ask).toHaveBeenCalledOnce();
    expect(out.text).toContain('The answer.');
  });

  it('falls back to the inbound text when no thread history is available', async () => {
    const agent = { ask: vi.fn(async () => ({ text: 'ok', citations: [] })) };
    const fetchThread = vi.fn(async () => []);
    await respondToThread(
      { agent, tools: () => [], fetchThread, botUserId: 'UBOT', logger: log },
      { channel: 'C1', text: 'hi', user: 'U1' },
    );
    const history = agent.ask.mock.calls[0][0];
    expect(history).toEqual([{ role: 'user', text: 'hi' }]);
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Implement `src/slack/handlers/respond.ts`**

```ts
import type { GeminiAgent } from '../../agent/gemini.js';
import type { AgentTool } from '../../agent/types.js';
import type { Logger } from '../../logger.js';
import { messagesToHistory, type SlackMsg } from '../thread.js';
import { formatAnswer } from '../format.js';

export interface RespondDeps {
  agent: Pick<GeminiAgent, 'ask'>;
  tools: () => AgentTool[];
  fetchThread: (channel: string, threadTs: string) => Promise<SlackMsg[]>;
  botUserId: string;
  logger: Logger;
}

export interface RespondCtx {
  channel: string;
  threadTs?: string;
  text: string;
  user?: string;
}

export async function respondToThread(
  deps: RespondDeps,
  ctx: RespondCtx,
): Promise<{ text: string; blocks: unknown[] }> {
  let history;
  if (ctx.threadTs) {
    const msgs = await deps.fetchThread(ctx.channel, ctx.threadTs);
    history = messagesToHistory(msgs, deps.botUserId);
  } else {
    history = messagesToHistory([{ user: ctx.user, text: ctx.text }], deps.botUserId);
  }
  if (history.length === 0) history = [{ role: 'user' as const, text: ctx.text }];
  const res = await deps.agent.ask(history, deps.tools());
  return formatAnswer(res);
}
```

- [ ] **Step 4: Run to verify PASS.**

- [ ] **Step 5: Implement `src/slack/app.ts`** (glue; verified by typecheck/build, not unit test)

```ts
import bolt from '@slack/bolt';
import type { Config } from '../config.js';
import type { GeminiAgent } from '../agent/gemini.js';
import type { McpClientManager } from '../mcp/client.js';
import type { Logger } from '../logger.js';
import { respondToThread, type RespondDeps } from './handlers/respond.js';
import type { SlackMsg } from './thread.js';

const { App } = bolt;

export function createSlackApp(
  cfg: Config,
  agent: GeminiAgent,
  mcp: McpClientManager,
  logger: Logger,
): bolt.App {
  const app = new App({
    token: cfg.slack.botToken,
    appToken: cfg.slack.appToken,
    signingSecret: cfg.slack.signingSecret,
    socketMode: true,
    logLevel: bolt.LogLevel.INFO,
  });

  let botUserId = '';
  const fetchThread = async (channel: string, threadTs: string): Promise<SlackMsg[]> => {
    const r = await app.client.conversations.replies({ channel, ts: threadTs, limit: 30 });
    return (r.messages ?? []) as SlackMsg[];
  };
  const deps = (): RespondDeps => ({
    agent,
    tools: () => mcp.tools(),
    fetchThread,
    botUserId,
    logger,
  });

  app.event('app_mention', async ({ event, say }) => {
    try {
      const out = await respondToThread(deps(), {
        channel: event.channel,
        threadTs: event.thread_ts ?? event.ts,
        text: event.text,
        user: event.user,
      });
      await say({ ...out, thread_ts: event.thread_ts ?? event.ts });
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'app_mention failed');
      await say({
        text: '⚠️ I hit an error, please try again.',
        thread_ts: event.thread_ts ?? event.ts,
      });
    }
  });

  app.command('/pulse', async ({ command, ack, respond }) => {
    await ack();
    try {
      const out = await respondToThread(deps(), {
        channel: command.channel_id,
        text: command.text,
        user: command.user_id,
      });
      await respond({ ...out, response_type: 'in_channel' });
    } catch (err) {
      logger.error({ err: (err as Error).message }, '/pulse failed');
      await respond({ text: '⚠️ I hit an error, please try again.' });
    }
  });

  app.message(async ({ message, say }) => {
    const m = message as {
      channel_type?: string;
      text?: string;
      user?: string;
      channel?: string;
      ts?: string;
      thread_ts?: string;
      bot_id?: string;
    };
    if (m.channel_type !== 'im' || m.bot_id || !m.text) return;
    try {
      const out = await respondToThread(deps(), {
        channel: m.channel ?? '',
        threadTs: m.thread_ts,
        text: m.text,
        user: m.user,
      });
      await say({ ...out, thread_ts: m.thread_ts });
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'DM failed');
      await say({ text: '⚠️ I hit an error, please try again.' });
    }
  });

  app.event('app_mention', async () => {}); // placeholder kept minimal
  void (async () => {
    try {
      const auth = await app.client.auth.test();
      botUserId = (auth.user_id as string) ?? '';
    } catch {
      /* set on start */
    }
  })();

  return app;
}
```

(Implementer: resolve `botUserId` reliably by calling `app.client.auth.test()` inside `start()` in `index.ts` and passing it in, if the inline resolution above proves racy. Keep the logic identical; only the timing of `botUserId` assignment may move.)

- [ ] **Step 6: Run `npm run typecheck` and `npm test`** → all green.

- [ ] **Step 7: Commit** — `git add src/slack && git commit -m "feat: add Slack app, handlers, and testable respond core"`

---

### Task 12: Health endpoint (`src/health.ts`)

**Files:**

- Create: `src/health.ts`
- Create: `src/health.test.ts`

**Interfaces:**

- Produces: `export function createHealthServer(port: number, logger: Logger): { start(): Promise<void>; stop(): Promise<void> }` — Node `http` server replying `200 {"status":"ok"}` on `GET /healthz`, `404` otherwise.

- [ ] **Step 1: Write the failing test** — `src/health.test.ts`

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createHealthServer } from './health.js';
import { createLogger } from './logger.js';

const log = createLogger('silent');
let server: { start(): Promise<void>; stop(): Promise<void> };

afterEach(async () => {
  await server?.stop();
});

describe('health server', () => {
  it('responds 200 on /healthz', async () => {
    server = createHealthServer(38123, log);
    await server.start();
    const res = await fetch('http://127.0.0.1:38123/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Implement `src/health.ts`**

```ts
import { createServer, type Server } from 'node:http';
import type { Logger } from './logger.js';

export function createHealthServer(
  port: number,
  logger: Logger,
): { start(): Promise<void>; stop(): Promise<void> } {
  let server: Server | undefined;
  return {
    start: () =>
      new Promise<void>((resolve) => {
        server = createServer((req, res) => {
          if (req.method === 'GET' && req.url === '/healthz') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
          } else {
            res.writeHead(404);
            res.end();
          }
        });
        server.listen(port, () => {
          logger.info({ port }, 'health server listening');
          resolve();
        });
      }),
    stop: () =>
      new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())),
  };
}
```

- [ ] **Step 4: Run to verify PASS.**

- [ ] **Step 5: Commit** — `git add src/health.ts src/health.test.ts && git commit -m "feat: add health endpoint for container probes"`

---

### Task 13: Pulse MCP server (`src/mcp/server.ts`)

**Files:**

- Create: `src/mcp/server.ts`
- Create: `src/mcp/server.test.ts`

**Interfaces:**

- Consumes: `GeminiAgent`, `buildBriefing`, `@modelcontextprotocol/sdk` server APIs.
- Produces: `export function registerPulseTools(server: ToolRegistrar, agent: Pick<GeminiAgent,'ask'>, topics: string[]): void` where `interface ToolRegistrar { tool(name: string, schema: unknown, handler: (args: any) => Promise<{ content: {type:'text';text:string}[] }>): void }`. Tools: `ask` (q→answer+sources), `search` (alias of ask focused on facts), `daily_briefing` (topics→digest). A `main()` (run when invoked directly) wires the real `McpServer` over stdio.

- [ ] **Step 1: Write the failing test** — `src/mcp/server.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { registerPulseTools } from './server.js';

describe('registerPulseTools', () => {
  it('registers ask/search/daily_briefing and ask returns text', async () => {
    const handlers = new Map<string, (a: any) => Promise<any>>();
    const server = { tool: (name: string, _s: unknown, h: any) => handlers.set(name, h) };
    const agent = {
      ask: vi.fn(async () => ({ text: 'answer', citations: [{ title: 'T', uri: 'https://u' }] })),
    };
    registerPulseTools(server, agent, ['ai']);
    expect([...handlers.keys()].sort()).toEqual(['ask', 'daily_briefing', 'search']);
    const out = await handlers.get('ask')!({ question: 'q' });
    expect(out.content[0].text).toContain('answer');
    expect(out.content[0].text).toContain('https://u');
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Implement `src/mcp/server.ts`**

```ts
import type { GeminiAgent } from '../agent/gemini.js';
import type { AgentResponse } from '../agent/types.js';
import { buildBriefing } from '../briefing/briefing.js';

export interface ToolRegistrar {
  tool(
    name: string,
    schema: unknown,
    handler: (
      args: Record<string, unknown>,
    ) => Promise<{ content: { type: 'text'; text: string }[] }>,
  ): void;
}

function render(res: AgentResponse): string {
  const sources = res.citations.length
    ? `\n\nSources:\n${res.citations.map((c, i) => `${i + 1}. ${c.title} — ${c.uri}`).join('\n')}`
    : '';
  return `${res.text}${sources}`;
}

export function registerPulseTools(
  server: ToolRegistrar,
  agent: Pick<GeminiAgent, 'ask'>,
  topics: string[],
): void {
  const text = (s: string) => ({ content: [{ type: 'text' as const, text: s }] });

  server.tool('ask', { question: 'string' }, async (args) => {
    const res = await agent.ask([{ role: 'user', text: String(args.question ?? '') }]);
    return text(render(res));
  });

  server.tool('search', { query: 'string' }, async (args) => {
    const res = await agent.ask([
      {
        role: 'user',
        text: `Search the web and give a factual, cited summary for: ${String(args.query ?? '')}`,
      },
    ]);
    return text(render(res));
  });

  server.tool('daily_briefing', { topics: 'string[] (optional)' }, async (args) => {
    const t = Array.isArray(args.topics) && args.topics.length ? (args.topics as string[]) : topics;
    const res = await buildBriefing(agent, t);
    return text(render(res));
  });
}
```

Then add a runnable `main()` at the bottom guarded so it only runs when executed directly (not imported by the test):

```ts
import { fileURLToPath } from 'node:url';

async function main(): Promise<void> {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { z } = await import('zod');
  const dotenv = await import('dotenv');
  dotenv.config();
  const { loadConfig } = await import('../config.js');
  const { createLogger } = await import('../logger.js');
  const { GeminiAgent } = await import('../agent/gemini.js');

  const cfg = loadConfig(process.env);
  const logger = createLogger(cfg.logLevel);
  const agent = new GeminiAgent(cfg.gemini, logger);
  const server = new McpServer({ name: 'pulse', version: '1.0.0' });

  const reg: ToolRegistrar = {
    tool: (name, _schema, handler) =>
      server.tool(
        name,
        name === 'daily_briefing'
          ? { topics: z.array(z.string()).optional() }
          : { question: z.string().optional(), query: z.string().optional() },
        async (a: Record<string, unknown>) => handler(a) as never,
      ),
  };
  registerPulseTools(reg, agent, cfg.briefing.topics);
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

(Implementer: the exact `McpServer.tool` schema argument shape may vary by SDK version; the `registerPulseTools` unit test pins the behavior, and `main()` adapts the real SDK to `ToolRegistrar`. Adjust the schema mapping in `reg.tool` to match the installed SDK signature without changing `registerPulseTools`.)

- [ ] **Step 4: Run to verify PASS** (`npx vitest run src/mcp/server.test.ts`) and `npm run typecheck`.

- [ ] **Step 5: Commit** — `git add src/mcp/server.ts src/mcp/server.test.ts && git commit -m "feat: expose Pulse capabilities as an MCP stdio server"`

---

### Task 14: Entrypoint wiring (`src/index.ts`)

**Files:**

- Create: `src/index.ts`

**Interfaces:**

- Consumes: everything above. No new exports (executable entrypoint).

**Note for implementer:** Verified by typecheck + build + a manual smoke note (no unit test for the entrypoint). Load `.env`, build config, logger, MCP client (`connectAll`), agent, Slack app, scheduler, health server; resolve `botUserId` via `app.client.auth.test()`; register global error + graceful-shutdown handlers.

- [ ] **Step 1: Implement `src/index.ts`**

```ts
import dotenv from 'dotenv';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { GeminiAgent } from './agent/gemini.js';
import { McpClientManager } from './mcp/client.js';
import { createSlackApp } from './slack/app.js';
import { BriefingScheduler } from './briefing/scheduler.js';
import { createHealthServer } from './health.js';

dotenv.config();

async function main(): Promise<void> {
  const cfg = loadConfig(process.env);
  const logger = createLogger(cfg.logLevel);
  logger.info('starting Pulse');

  const mcp = new McpClientManager(cfg.mcpServers, logger);
  await mcp.connectAll();

  const agent = new GeminiAgent(cfg.gemini, logger);
  const app = createSlackApp(cfg, agent, mcp, logger);
  const health = createHealthServer(cfg.healthPort, logger);

  const scheduler = new BriefingScheduler({
    cron: cfg.briefing.cron,
    channel: cfg.briefing.channel,
    topics: cfg.briefing.topics,
    agent,
    poster: { postMessage: (args) => app.client.chat.postMessage(args as never) },
    logger,
  });

  await health.start();
  await app.start();
  scheduler.start();
  logger.info('Pulse is running');

  const shutdown = async (sig: string): Promise<void> => {
    logger.info({ sig }, 'shutting down');
    scheduler.stop();
    await Promise.allSettled([app.stop(), health.stop(), mcp.close()]);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
  process.on('uncaughtException', (err) =>
    logger.error({ err: (err as Error).message }, 'uncaughtException'),
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal startup error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run `npm run typecheck && npm run build && npm test`** → typecheck clean, `dist/` produced, all tests green.

- [ ] **Step 3: Commit** — `git add src/index.ts && git commit -m "feat: wire entrypoint with graceful shutdown"`

---

### Task 15: Containerization (`Dockerfile`, `.dockerignore`)

**Files:**

- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
dist
.git
.env
*.log
coverage
docs
```

- [ ] **Step 2: Create multi-stage `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN useradd --user-group --create-home --shell /usr/sbin/nologin pulse
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER pulse
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+(process.env.HEALTH_PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
```

- [ ] **Step 3: Verify the image builds** — `docker build -t pulse-slack-agent .`
      Expected: build succeeds through all stages. (If Docker is unavailable locally, note it and rely on CI to verify in Task 16.)

- [ ] **Step 4: Commit** — `git add Dockerfile .dockerignore && git commit -m "build: add multi-stage Dockerfile with non-root user and healthcheck"`

---

### Task 16: CI workflow (`.github/workflows/ci.yml`)

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: CI
on:
  push:
    branches: [master, 'feat/**']
  pull_request:
    branches: [master]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
  docker:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t pulse-slack-agent .
```

- [ ] **Step 2: Validate YAML locally** — confirm indentation parses (e.g. open in editor or `npx js-yaml .github/workflows/ci.yml` if available).

- [ ] **Step 3: Commit** — `git add .github && git commit -m "ci: add GitHub Actions pipeline (typecheck, lint, test, build, docker)"`

---

### Task 17: Documentation (`README.md`, `.env.example`, `slack-app-manifest.yaml`)

**Files:**

- Create: `.env.example`
- Create: `slack-app-manifest.yaml`
- Create: `README.md`

- [ ] **Step 1: Create `.env.example`**

```dotenv
# Slack (create an app at https://api.slack.com/apps, enable Socket Mode)
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret

# Google Gemini (https://aistudio.google.com/apikey)
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.0-flash

# Daily briefing (optional — disabled if BRIEFING_CHANNEL is unset)
BRIEFING_CHANNEL=
BRIEFING_CRON=0 9 * * *
BRIEFING_TOPICS=top world news,technology,AI

# External MCP servers to consume as a client (optional, JSON array)
# MCP_SERVERS=[{"name":"fs","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/data"]}]

LOG_LEVEL=info
HEALTH_PORT=3000
```

- [ ] **Step 2: Create `slack-app-manifest.yaml`**

```yaml
display_information:
  name: Pulse
  description: Gemini-powered Slack agent with real-time search and daily briefings
features:
  bot_user:
    display_name: Pulse
    always_online: true
  slash_commands:
    - command: /pulse
      description: Ask Pulse a question
      usage_hint: '[your question]'
      should_escape: false
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - chat:write
      - commands
      - im:history
      - im:read
      - im:write
      - channels:history
      - groups:history
settings:
  event_subscriptions:
    bot_events:
      - app_mention
      - message.im
  interactivity:
    is_enabled: true
  socket_mode_enabled: true
  org_deploy_enabled: false
  token_rotation_enabled: false
```

- [ ] **Step 3: Create `README.md`** — sections: overview + feature list; architecture (the module tree + data-flow from the spec); prerequisites (Node 22, Slack app, Gemini key); setup (`npm install`, copy `.env.example`, import the manifest); running (`npm run dev`, `npm run build && npm start`); MCP server usage (`npm run mcp` + sample client config); configuration table (mirror the spec's env table); testing (`npm test`, `npm run lint`, `npm run typecheck`); Docker (`docker build`/`run` with env file); deployment notes (long-running container, min 1 instance, `/healthz`). Keep it accurate to the implemented commands.

- [ ] **Step 4: Commit** — `git add README.md .env.example slack-app-manifest.yaml && git commit -m "docs: add README, env example, and Slack app manifest"`

---

### Task 18: Final verification + Pull Request

- [ ] **Step 1: Full green run** — `npm ci && npm run typecheck && npm run lint && npm test && npm run build`. All must pass.
- [ ] **Step 2: Confirm no secrets committed** — `git grep -nE 'xoxb-|xapp-|AIza' -- . ':!*.example' ':!docs'` returns nothing.
- [ ] **Step 3: Push branch** — `git push -u origin feat/enterprise-rebuild`.
- [ ] **Step 4: Open PR** with `gh pr create` — title "feat: enterprise rebuild of Pulse Slack agent", body summarizing capabilities, architecture, testing, and deployment; PR body ends with the Claude Code generated-with line.
- [ ] **Step 5: Report** the PR URL and CI status to the user.

---

## Self-Review

**Spec coverage:**

- On-demand Q&A + search → Tasks 5 (agent + grounding), 11 (handlers). ✓
- Daily briefing → Tasks 9, 10. ✓
- MCP client → Task 6; MCP server → Task 13. ✓
- Conversation memory (thread) → Tasks 7, 11. ✓
- Config validation → Task 2; logging → Task 3; error handling/shutdown → Tasks 5, 10, 11, 14. ✓
- Tests → every core task; CI → Task 16. ✓
- Docker → Task 15; health → Task 12. ✓
- Docs/manifest/.env.example/LICENSE → Tasks 1, 17. ✓
- Git/PR delivery → Task 18. ✓

**Placeholder scan:** No "TBD/implement later". Implementer notes that defer to live SDK signatures (Gemini grounding shape, MCP `tool()` schema arg) are isolated behind tested interfaces (`GeminiClient`, `ToolRegistrar`, `McpConnection`) so behavior is pinned by tests even though the thin real-SDK adapter is typecheck-only. This is intentional, not a gap.

**Type consistency:** `ChatMessage{role:'user'|'model'}`, `AgentResponse{text,citations}`, `Citation{title,uri}`, `AgentTool{name,description,parameters,call}` are defined in Task 4 and used unchanged in Tasks 5–13. `GeminiAgent.ask(history, tools?)` signature consistent across Tasks 5, 9, 10, 11, 13. `McpClientManager.tools()` used in Task 11. ✓
