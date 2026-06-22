import { createServer, type Server } from 'node:http';
import type { Logger } from './logger.js';

export function createHealthServer(
  port: number,
  logger: Logger,
): { start(): Promise<void>; stop(): Promise<void> } {
  let server: Server | undefined;
  return {
    start: () =>
      new Promise<void>((resolve) => {
        server = createServer((req, res) => {
          if (req.method === 'GET' && req.url === '/healthz') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
          } else {
            res.writeHead(404);
            res.end();
          }
        });
        server.listen(port, () => {
          logger.info({ port }, 'health server listening');
          resolve();
        });
      }),
    stop: () =>
      new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())),
  };
}
