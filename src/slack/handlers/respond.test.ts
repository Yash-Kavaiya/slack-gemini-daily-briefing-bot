import { describe, it, expect, vi } from 'vitest';
import { respondToThread } from './respond.js';
import { createLogger } from '../../logger.js';

const log = createLogger('silent');

describe('respondToThread', () => {
  it('builds history from the thread and returns a formatted answer', async () => {
    const agent = { ask: vi.fn(async () => ({ text: 'The answer.', citations: [] })) };
    const fetchThread = vi.fn(async () => [{ user: 'U1', text: '<@UBOT> question?' }]);
    const out = await respondToThread(
      { agent, tools: () => [], fetchThread, botUserId: 'UBOT', logger: log },
      { channel: 'C1', threadTs: '1.1', text: '<@UBOT> question?', user: 'U1' },
    );
    expect(agent.ask).toHaveBeenCalledOnce();
    expect(out.text).toContain('The answer.');
  });

  it('falls back to the inbound text when no thread history is available', async () => {
    const agent = { ask: vi.fn(async () => ({ text: 'ok', citations: [] })) };
    const fetchThread = vi.fn(async () => []);
    await respondToThread(
      { agent, tools: () => [], fetchThread, botUserId: 'UBOT', logger: log },
      { channel: 'C1', text: 'hi', user: 'U1' },
    );
    const history = agent.ask.mock.calls[0]?.[0];
    expect(history).toEqual([{ role: 'user', text: 'hi' }]);
  });
});
