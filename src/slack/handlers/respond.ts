import type { GeminiAgent } from '../../agent/gemini.js';
import type { AgentTool, ChatMessage } from '../../agent/types.js';
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
  let history: ChatMessage[];
  if (ctx.threadTs) {
    const msgs = await deps.fetchThread(ctx.channel, ctx.threadTs);
    history = messagesToHistory(msgs, deps.botUserId);
  } else {
    history = messagesToHistory(
      [{ ...(ctx.user ? { user: ctx.user } : {}), text: ctx.text }],
      deps.botUserId,
    );
  }
  if (history.length === 0) history = [{ role: 'user', text: ctx.text }];
  const res = await deps.agent.ask(history, deps.tools());
  return formatAnswer(res);
}
