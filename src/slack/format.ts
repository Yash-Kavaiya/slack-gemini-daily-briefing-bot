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
