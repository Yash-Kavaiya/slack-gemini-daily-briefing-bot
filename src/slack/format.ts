import type { AgentResponse, Citation } from '../agent/types.js';

const MAX_SECTION = 2900;

/**
 * Splits text into chunks no larger than `size`, preferring to break at a
 * newline or space boundary so words/lines aren't cut mid-token.
 */
export function chunkText(s: string, size = MAX_SECTION): string[] {
  if (s.length <= size) return [s];
  const chunks: string[] = [];
  let rest = s;
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n', size);
    if (cut < size * 0.5) cut = rest.lastIndexOf(' ', size);
    if (cut < size * 0.5) cut = size;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function sectionBlocks(text: string): unknown[] {
  return chunkText(text).map((part) => ({
    type: 'section',
    text: { type: 'mrkdwn', text: part },
  }));
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
    blocks: [...sectionBlocks(res.text), ...sourcesBlock(res.citations)],
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
      ...sectionBlocks(res.text),
      ...sourcesBlock(res.citations),
    ],
  };
}
