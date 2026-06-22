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
