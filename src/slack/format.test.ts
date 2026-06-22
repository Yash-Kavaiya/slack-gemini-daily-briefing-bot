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
