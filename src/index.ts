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
  const app = await createSlackApp(cfg, agent, mcp, logger);
  const health = createHealthServer(cfg.healthPort, logger);

  const scheduler = new BriefingScheduler({
    cron: cfg.briefing.cron,
    ...(cfg.briefing.channel ? { channel: cfg.briefing.channel } : {}),
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
  console.error('fatal startup error:', err);
  process.exit(1);
});
