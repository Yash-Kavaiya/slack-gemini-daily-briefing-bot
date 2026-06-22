import { describe, it, expect, vi } from 'vitest';
import { BriefingScheduler } from './scheduler.js';
import { createLogger } from '../logger.js';

const log = createLogger('silent');

describe('BriefingScheduler', () => {
  it('runOnce builds and posts a briefing to the channel', async () => {
    const postMessage = vi.fn(async () => ({ ok: true }));
    const agent = { ask: vi.fn(async () => ({ text: 'digest', citations: [] })) };
    const sched = new BriefingScheduler({
      cron: '0 9 * * *',
      channel: 'C1',
      topics: ['ai'],
      agent,
      poster: { postMessage },
      logger: log,
    });
    await sched.runOnce();
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0]?.[0].channel).toBe('C1');
  });

  it('runOnce does nothing without a channel', async () => {
    const postMessage = vi.fn(async () => ({}));
    const agent = { ask: vi.fn(async () => ({ text: 'd', citations: [] })) };
    const sched = new BriefingScheduler({
      cron: '0 9 * * *',
      topics: ['ai'],
      agent,
      poster: { postMessage },
      logger: log,
    });
    await sched.runOnce();
    expect(postMessage).not.toHaveBeenCalled();
  });
});
