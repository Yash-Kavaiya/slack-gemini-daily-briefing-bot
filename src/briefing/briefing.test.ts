import { describe, it, expect, vi } from 'vitest';
import { buildBriefing } from './briefing.js';

describe('buildBriefing', () => {
  it('asks the agent with the configured topics', async () => {
    const ask = vi.fn(async () => ({ text: 'digest', citations: [] }));
    const res = await buildBriefing({ ask }, ['ai', 'markets']);
    expect(res.text).toBe('digest');
    const prompt = ask.mock.calls[0]?.[0][0]?.text as string;
    expect(prompt).toContain('ai');
    expect(prompt).toContain('markets');
  });
});
