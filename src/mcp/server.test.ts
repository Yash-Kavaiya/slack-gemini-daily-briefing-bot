import { describe, it, expect, vi } from 'vitest';
import { registerPulseTools } from './server.js';

describe('registerPulseTools', () => {
  it('registers ask/search/daily_briefing and ask returns text', async () => {
    const handlers = new Map<string, (a: Record<string, unknown>) => Promise<unknown>>();
    const server = {
      tool: (name: string, _s: unknown, h: (a: Record<string, unknown>) => Promise<unknown>) =>
        handlers.set(name, h),
    };
    const agent = {
      ask: vi.fn(async () => ({ text: 'answer', citations: [{ title: 'T', uri: 'https://u' }] })),
    };
    registerPulseTools(server, agent, ['ai']);
    expect([...handlers.keys()].sort()).toEqual(['ask', 'daily_briefing', 'search']);
    const out = (await handlers.get('ask')!({ question: 'q' })) as {
      content: { text: string }[];
    };
    expect(out.content[0]?.text).toContain('answer');
    expect(out.content[0]?.text).toContain('https://u');
  });
});
