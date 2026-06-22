import { describe, it, expect, vi } from 'vitest';
import { McpClientManager } from './client.js';
import type { McpConnection } from './client.js';
import { createLogger } from '../logger.js';

const log = createLogger('silent');

function fakeConn(
  tools: { name: string; description?: string; inputSchema: Record<string, unknown> }[],
): McpConnection {
  return {
    listTools: vi.fn(async () => tools),
    callTool: vi.fn(async () => 'tool-result'),
    close: vi.fn(async () => {}),
  };
}

describe('McpClientManager', () => {
  it('exposes external tools as AgentTools', async () => {
    const conn = fakeConn([{ name: 'echo', description: 'echo', inputSchema: { type: 'object' } }]);
    const mgr = new McpClientManager([{ name: 's', command: 'x', args: [] }], log, {
      connect: async () => conn,
    });
    await mgr.connectAll();
    const tools = mgr.tools();
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('echo');
    expect(await tools[0]?.call({ a: 1 })).toBe('tool-result');
  });

  it('skips servers that fail to connect', async () => {
    const mgr = new McpClientManager([{ name: 'bad', command: 'x', args: [] }], log, {
      connect: async () => {
        throw new Error('boom');
      },
    });
    await mgr.connectAll();
    expect(mgr.tools()).toHaveLength(0);
  });
});
