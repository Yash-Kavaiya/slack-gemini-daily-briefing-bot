import bolt from '@slack/bolt';
import type { Config } from '../config.js';
import type { GeminiAgent } from '../agent/gemini.js';
import type { McpClientManager } from '../mcp/client.js';
import type { Logger } from '../logger.js';
import { respondToThread, type RespondDeps } from './handlers/respond.js';
import type { SlackMsg } from './thread.js';

const { App, LogLevel } = bolt;

const ERROR_REPLY = '⚠️ I hit an error, please try again.';

/**
 * Builds and wires the Slack Bolt app (Socket Mode). Resolves the bot's own
 * user id up front via `auth.test` so thread history can attribute messages
 * correctly. Returns the ready-to-start App.
 */
export async function createSlackApp(
  cfg: Config,
  agent: GeminiAgent,
  mcp: McpClientManager,
  logger: Logger,
): Promise<bolt.App> {
  const app = new App({
    token: cfg.slack.botToken,
    appToken: cfg.slack.appToken,
    signingSecret: cfg.slack.signingSecret,
    socketMode: true,
    logLevel: LogLevel.INFO,
  });

  const auth = await app.client.auth.test({ token: cfg.slack.botToken });
  const botUserId = (auth.user_id as string | undefined) ?? '';
  logger.info({ botUserId }, 'resolved bot identity');

  const fetchThread = async (channel: string, threadTs: string): Promise<SlackMsg[]> => {
    const r = await app.client.conversations.replies({ channel, ts: threadTs, limit: 30 });
    return (r.messages ?? []) as SlackMsg[];
  };
  const deps: RespondDeps = {
    agent,
    tools: () => mcp.tools(),
    fetchThread,
    botUserId,
    logger,
  };

  app.event('app_mention', async ({ event, say }) => {
    const threadTs = event.thread_ts ?? event.ts;
    try {
      const out = await respondToThread(deps, {
        channel: event.channel,
        threadTs,
        text: event.text,
        ...(event.user ? { user: event.user } : {}),
      });
      await say({ ...out, thread_ts: threadTs });
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'app_mention failed');
      await say({ text: ERROR_REPLY, thread_ts: threadTs });
    }
  });

  app.command('/pulse', async ({ command, ack, respond }) => {
    await ack();
    try {
      const out = await respondToThread(deps, {
        channel: command.channel_id,
        text: command.text,
        user: command.user_id,
      });
      await respond({ ...out, response_type: 'in_channel' });
    } catch (err) {
      logger.error({ err: (err as Error).message }, '/pulse failed');
      await respond({ text: ERROR_REPLY });
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
      const out = await respondToThread(deps, {
        channel: m.channel ?? '',
        ...(m.thread_ts ? { threadTs: m.thread_ts } : {}),
        text: m.text,
        ...(m.user ? { user: m.user } : {}),
      });
      await say({ ...out, ...(m.thread_ts ? { thread_ts: m.thread_ts } : {}) });
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'DM failed');
      await say({ text: ERROR_REPLY });
    }
  });

  return app;
}
