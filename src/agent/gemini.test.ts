import { describe, it, expect, vi } from 'vitest';
import { GeminiAgent } from './gemini.js';
import type { GeminiClient, GeminiResult } from './gemini.js';
import { createLogger } from '../logger.js';

const cfg = { apiKey: 'k', model: 'gemini-2.0-flash' };
const log = createLogger('silent');

function clientReturning(results: GeminiResult[]): GeminiClient {
  const calls = [...results];
  return { generateContent: vi.fn(async () => calls.shift() as GeminiResult) };
}

describe('GeminiAgent.ask', () => {
  it('returns text and parsed citations from grounding metadata', async () => {
    const client = clientReturning([
      {
        text: 'Paris is the capital of France.',
        functionCalls: [],
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [{ web: { title: 'France', uri: 'https://x' } }],
            },
          },
        ],
      },
    ]);
    const agent = new GeminiAgent(cfg, log, { client });
    const res = await agent.ask([{ role: 'user', text: 'capital of France?' }]);
    expect(res.text).toContain('Paris');
    expect(res.citations).toEqual([{ title: 'France', uri: 'https://x' }]);
  });

  it('executes a tool call then returns the final answer', async () => {
    const client = clientReturning([
      { text: '', functionCalls: [{ name: 'weather', args: { city: 'NYC' } }], candidates: [] },
      { text: 'It is 20C in NYC.', functionCalls: [], candidates: [] },
    ]);
    const tool = {
      name: 'weather',
      description: 'get weather',
      parameters: { type: 'object', properties: { city: { type: 'string' } } },
      call: vi.fn(async () => '20C'),
    };
    const agent = new GeminiAgent(cfg, log, { client });
    const res = await agent.ask([{ role: 'user', text: 'weather in NYC?' }], [tool]);
    expect(tool.call).toHaveBeenCalledWith({ city: 'NYC' });
    expect(res.text).toContain('20C');
  });

  it('stops after max iterations to avoid infinite tool loops', async () => {
    const looping: GeminiResult = {
      text: '',
      functionCalls: [{ name: 'x', args: {} }],
      candidates: [],
    };
    const client = clientReturning(Array(10).fill(looping));
    const tool = {
      name: 'x',
      description: 'x',
      parameters: { type: 'object' },
      call: vi.fn(async () => 'ok'),
    };
    const agent = new GeminiAgent(cfg, log, { client });
    const res = await agent.ask([{ role: 'user', text: 'loop' }], [tool]);
    expect(res.text).toMatch(/couldn.t complete|unable/i);
  });
});
