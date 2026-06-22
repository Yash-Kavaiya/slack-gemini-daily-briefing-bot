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
      ...(e.BRIEFING_CHANNEL ? { channel: e.BRIEFING_CHANNEL } : {}),
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
