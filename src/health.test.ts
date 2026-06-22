import { describe, it, expect, afterEach } from 'vitest';
import { createHealthServer } from './health.js';
import { createLogger } from './logger.js';

const log = createLogger('silent');
let server: { start(): Promise<void>; stop(): Promise<void> };

afterEach(async () => {
  await server?.stop();
});

describe('health server', () => {
  it('responds 200 on /healthz', async () => {
    server = createHealthServer(38123, log);
    await server.start();
    const res = await fetch('http://127.0.0.1:38123/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
