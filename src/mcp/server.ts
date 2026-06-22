import { fileURLToPath } from 'node:url';
import type { ZodTypeAny } from 'zod';
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

/**
 * Registers Pulse's capabilities as MCP tools on any registrar. Kept free of
 * the concrete SDK so it can be unit-tested with a fake registrar.
 */
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

  const inputSchemas: Record<string, Record<string, ZodTypeAny>> = {
    ask: { question: z.string() },
    search: { query: z.string() },
    daily_briefing: { topics: z.array(z.string()).optional() },
  };

  const reg: ToolRegistrar = {
    tool: (name, _schema, handler) => {
      server.registerTool(
        name,
        { inputSchema: inputSchemas[name] ?? {} },
        async (args: Record<string, unknown>) => (await handler(args)) as never,
      );
    },
  };

  registerPulseTools(reg, agent, cfg.briefing.topics);
  await server.connect(new StdioServerTransport());
  logger.info('Pulse MCP server listening on stdio');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
