import { describe, it, expect } from 'vitest';
import { formatAnswer, formatBriefing, chunkText } from './format.js';

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

  it('splits a long answer into multiple section blocks instead of truncating', () => {
    const long = 'word '.repeat(2000).trim(); // ~10000 chars
    const out = formatAnswer({ text: long, citations: [] });
    const sections = (out.blocks as { type: string; text?: { text: string } }[]).filter(
      (b) => b.type === 'section',
    );
    expect(sections.length).toBeGreaterThan(1);
    for (const s of sections) expect(s.text!.text.length).toBeLessThanOrEqual(2900);
    // No content is dropped (no ellipsis truncation).
    expect(JSON.stringify(out.blocks)).not.toContain('…');
  });
});

describe('chunkText', () => {
  it('returns a single chunk when within the limit', () => {
    expect(chunkText('short', 100)).toEqual(['short']);
  });

  it('breaks on whitespace boundaries and preserves all words', () => {
    const parts = chunkText('aaaa bbbb cccc dddd', 10);
    expect(parts.every((p) => p.length <= 10)).toBe(true);
    expect(parts.join(' ').split(/\s+/)).toEqual(['aaaa', 'bbbb', 'cccc', 'dddd']);
  });
});

describe('formatBriefing', () => {
  it('includes a header and topics', () => {
    const out = formatBriefing(['ai'], { text: 'Briefing body', citations: [] });
    expect(JSON.stringify(out.blocks)).toContain('Daily Briefing');
    expect(out.text).toContain('Briefing body');
  });
});
